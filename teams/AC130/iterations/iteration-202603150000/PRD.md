# 产品需求规格说明书 (PRD)

**项目**: AC130 - 流式输出中断问题修复
**版本**: 1.0
**创建日期**: 2026-03-15
**负责人**: AC130 Lead

---

## 1. 问题概述

### 1.1 问题现象
用户在使用"统一客服"智能体发送"你好"消息时，出现以下异常：
- 请求耗时 **112,782ms**（约 112 秒）
- 只收到 **1 个 chunk**，类型为 `unknown`
- 无任何渲染状态（renderStates: []）
- 服务端无日志记录（server: null）

### 1.2 影响范围
- 所有使用流式输出的智能体对话
- 用户体验严重受损：长时间等待无响应

---

## 2. 根因分析

### 2.1 技术分析

#### 现有架构
```
Frontend (AgentChat.tsx)
  ↓ fetch /stream/agents/{name}/chat
Frontend Route (route.ts)
  ↓ fetch http://localhost:20881/api/agents/{name}/chat/stream
Backend (backend.py:chat_stream)
  ↓ async for event in instance.chat_stream()
AgentEngine (agent_engine.py:stream())
  ↓ async for chunk in llm_to_use.astream(messages)
LLM Provider (ZhipuAI/Bailian/Ollama)
```

#### 问题定位

**发现 #1: 后端无日志系统**
- Frontend `DebugLogger` 尝试从 `/api/debug/logs/{request_id}` 获取后端日志
- 后端 `backend.py` **没有实现** `/api/debug/logs/{request_id}` 端点
- 导致 `server: null`，无法诊断后端问题

**发现 #2: 前端 chunk 类型为 unknown**
- Frontend 解析 SSE 数据时，chunk 无法被正确解析
- 表明后端可能没有正确发送 `data: {"type": "...", ...}` 格式的 SSE 数据

**发现 #3: 流式输出超时**
- 112 秒超时表明后端 `chat_stream()` 可能阻塞在某个环节
- 可能的阻塞点：
  1. LLM `astream()` 调用挂起
  2. `AgentEngine.stream()` 异常退出
  3. 网络/代理层问题

### 2.2 可能原因

| 原因 | 可能性 | 证据 |
|------|--------|------|
| LLM 调用失败但未捕获异常 | 高 | 无任何有效输出 |
| SSE 流被中断 | 中 | 只有 1 个 unknown chunk |
| 异常被静默吞噬 | 高 | server: null |

---

## 3. 需求规格

### 3.1 功能需求

#### FR-1: 后端结构化日志系统
**描述**: 实现后端结构化日志系统，与前端 DebugLogger 配合

**验收标准**:
- [ ] 新增 `/api/debug/logs/{request_id}` 端点
- [ ] 使用线程安全的日志存储（按 request_id 隔离）
- [ ] 记录关键事件：请求开始、LLM 调用、工具调用、异常、请求结束
- [ ] 支持日志自动清理（超过 1 小时）

#### FR-2: 流式输出异常处理增强
**描述**: 增强流式输出的异常捕获和错误报告

**验收标准**:
- [ ] 在 `AgentEngine.stream()` 方法中添加 try-catch
- [ ] 捕获 LLM 调用异常并发送 SSE 错误事件
- [ ] 在 `backend.py:chat_stream()` 中添加超时保护
- [ ] 确保 finally 块中发送 metrics 事件

#### FR-3: SSE 连接健康检查
**描述**: 添加 SSE 连接健康检查机制

**验收标准**:
- [ ] 定期发送心跳事件（每 30 秒）
- [ ] 前端检测心跳超时并显示错误提示

---

### 3.2 非功能需求

#### NFR-1: 性能
- 首 token 时延 < 3 秒
- 日志系统开销 < 5ms

#### NFR-2: 可靠性
- 异常情况下必须发送错误事件
- 日志写入失败不应影响主流程

#### NFR-3: 可维护性
- 日志格式统一，便于调试
- 错误信息包含足够的上下文

---

## 4. 技术方案

### 4.1 后端日志系统架构

```python
# 新增文件: src/stream_logger.py

class StreamLogger:
    """流式请求日志记录器"""

    def __init__(self, request_id: str):
        self.request_id = request_id
        self.events = []

    def log_event(self, category: str, data: dict):
        """记录日志事件"""
        self.events.append({
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "data": data
        })

    def get_logs(self) -> dict:
        """获取完整日志"""
        return {
            "request_id": self.request_id,
            "events": self.events
        }

# 全局日志存储
_log_store: Dict[str, StreamLogger] = {}
_log_lock = threading.Lock()

def get_logger(request_id: str) -> StreamLogger:
    """获取或创建日志记录器"""
    with _log_lock:
        if request_id not in _log_store:
            _log_store[request_id] = StreamLogger(request_id)
        return _log_store[request_id]

def cleanup_old_logs():
    """清理超过 1 小时的日志"""
    cutoff = datetime.now() - timedelta(hours=1)
    with _log_lock:
        expired = [rid for rid, logger in _log_store.items()
                   if logger.start_time < cutoff]
        for rid in expired:
            del _log_store[rid]
```

### 4.2 API 端点设计

```python
# backend.py 新增端点

@app.get("/api/debug/logs/{request_id}")
async def get_debug_logs(request_id: str):
    """获取指定请求的调试日志"""
    from src.stream_logger import get_logger

    logger = get_logger(request_id)
    return {
        "meta": {
            "version": "1.0",
            "exportedAt": datetime.now().isoformat(),
            "requestId": request_id
        },
        "server": {
            "logs": logger.get_logs()["events"]
        }
    }
```

### 4.3 流式输出异常处理

```python
# backend.py:chat_stream() 增强

@app.post("/api/agents/{name}/chat/stream")
async def chat_stream(name: str, req: ChatRequest):
    """流式对话 - 增强异常处理"""

    request_id = req.headers.get("X-Request-ID", f"auto-{uuid.uuid4().hex[:8]}")
    logger = get_logger(request_id)

    logger.log_event("request_start", {
        "agentName": name,
        "message": req.message,
        "historyCount": len(req.history) if req.history else 0
    })

    try:
        async def generate():
            try:
                instance = await manager.get_instance(name)
                if not instance:
                    yield error_event("无法加载Agent")
                    return

                logger.log_event("agent_loaded", {"agentName": name})

                async for event in instance.chat_stream(req.message, req.history):
                    logger.log_event("sse_event", {"type": event.get("type")})
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            except asyncio.TimeoutError:
                logger.log_event("timeout", {"duration": "timeout"})
                yield error_event("请求超时，请稍后重试")

            except Exception as e:
                logger.log_event("error", {
                    "type": type(e).__name__,
                    "message": str(e),
                    "traceback": traceback.format_exc()
                })
                yield error_event(f"处理请求时发生错误: {str(e)}")

            finally:
                logger.log_event("request_end", {"status": "completed"})
                cleanup_old_logs()

        return StreamingResponse(generate(), media_type="text/event-stream")

    except Exception as e:
        logger.log_event("endpoint_error", {"message": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

def error_event(message: str) -> str:
    """生成错误事件"""
    return f'data: {json.dumps({"type": "error", "content": message}, ensure_ascii=False)}\n\n'
```

### 4.4 AgentEngine.stream() 异常处理

```python
# src/agent_engine.py:stream() 增强

async def stream(self, user_input: str, history: List[Dict] = None, file_context: str = ""):
    """流式运行Agent - 增强异常处理"""

    try:
        # ... 现有代码 ...

        async for chunk in llm_to_use.astream(messages):
            if chunk.content:
                response_content += chunk.content
                # ... 流式处理逻辑 ...

    except Exception as e:
        # 发送错误事件到前端
        yield {
            "type": "error",
            "content": f"LLM 调用失败: {str(e)}",
            "error_type": type(e).__name__
        }
        raise  # 重新抛出，让后端 logger 记录
```

---

## 5. 测试计划

### 5.1 单元测试
- [ ] `StreamLogger` 并发安全测试
- [ ] 日志清理功能测试
- [ ] `/api/debug/logs/{request_id}` 端点测试

### 5.2 集成测试
- [ ] 正常流式输出场景
- [ ] LLM 超时场景
- [ ] LLM 异常场景
- [ ] 前后端日志合并测试

### 5.3 UAT 测试（User Rep 负责）
- [ ] 在前端发送"你好"消息，验证正常响应
- [ ] 导出调试日志，验证前后端日志完整
- [ ] 模拟网络中断，验证错误提示

---

## 6. 实施计划

| 任务 | 负责人 | 预计时间 |
|------|--------|----------|
| 创建 StreamLogger 类 | Dev | 30 分钟 |
| 添加 /api/debug/logs 端点 | Dev | 20 分钟 |
| 增强 chat_stream 异常处理 | Dev | 40 分钟 |
| 增强 AgentEngine.stream() 异常处理 | Dev | 30 分钟 |
| 前端日志合并验证 | Dev | 20 分钟 |
| UAT 测试 | User Rep | 30 分钟 |
| **总计** | | **~3 小时** |

---

## 7. 验收标准

1. **功能验收**: 后端日志系统正常工作，前端能获取完整日志
2. **异常处理**: 任何异常都能发送错误事件到前端
3. **UAT 通过**: User Rep 使用 Playwright 验证正常对话流程
4. **回归测试**: 现有功能不受影响

---

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 日志存储内存泄漏 | 高 | 定期清理 + LRU 限制 |
| 异常处理影响性能 | 中 | 仅在异常时触发 |
| 并写竞态条件 | 中 | 使用 threading.Lock |

---

## 9. 附录

### 9.1 参考资料
- CLAUDE.md - 流式输出架构说明
- frontend/src/lib/debugLogger.ts - 前端日志系统

### 9.2 相关文件
- `backend.py` - 后端 API 端点
- `src/agent_engine.py` - 流式输出核心
- `frontend/src/components/AgentChat.tsx` - 前端流式处理
