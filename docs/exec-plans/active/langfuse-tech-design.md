# Langfuse 集成技术设计文档

> **文档版本**: 1.0
> **创建日期**: 2026-03-17
> **作者**: langfuse-integration 研究员
> **状态**: Draft

---

## 1. 概述

### 1.1 目标

为 Agent Builder 平台集成 Langfuse 可观测性能力，实现：
- 全链路 Tracing（LLM 调用、工具执行、Agent 交互）
- Token 使用统计与成本分析
- 性能监控与瓶颈识别
- 调试体验优化（Trace URL 关联）

### 1.2 核心约束

> **流式输出不可破坏** - Langfuse 集成不得阻塞 SSE 流式输出

### 1.3 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| Langfuse SDK | Python SDK v2 (low-level) | 异步队列、最小延迟 |
| 部署方式 | Docker Compose | 本地开发、简单可靠 |
| 集成模式 | 手动埋点 + LangChain Callback | 精细控制 + 自动拦截 |

---

## 2. Langfuse Python SDK 集成路径评估

### 2.1 SDK 版本对比

| 特性 | Low-level SDK (v2) | Decorator SDK | LangChain Callback |
|------|-------------------|---------------|-------------------|
| **异步支持** | ✅ 后台线程队列 | ✅ 装饰器包装 | ✅ CallbackHandler |
| **流式兼容** | ✅ 完全非阻塞 | ⚠️ 有已知问题 | ❌ 可能阻塞 |
| **精细控制** | ✅ 完全手动 | ✅ 函数级 | ❌ 自动拦截 |
| **实现复杂度** | 中等 | 低 | 最低 |

### 2.2 推荐方案：混合模式

```
┌─────────────────────────────────────────────────────────┐
│                   Agent Builder                          │
├─────────────────────────────────────────────────────────┤
│  FastAPI Backend (backend.py)                           │
│  ├── AgentEngine (agent_engine.py)                      │
│  │   ├── LLM 调用                    │
│  │   ├── 工具执行 (MCP/Skill)                          │
│  │   └── 子 Agent 调用                                  │
│  └── SSE Streaming (chat_stream endpoint)               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Langfuse Integration Layer                  │
├─────────────────────────────────────────────────────────┤
│  LangfuseClient (src/langfuse_client.py)                │
│  ├── trace(): 创建 Trace                                │
│  ├── span(): 记录 Span                                  │
│  ├── generation(): 记录 LLM Generation                  │
│  └── event(): 记录离散事件                              │
│                                                         │
│  内部机制:                                               │
│  └── 后台线程 + 内存队列 → 异步发送到 Langfuse Server   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Langfuse Server (本地部署)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PostgreSQL  │  │ ClickHouse  │  │    Redis    │     │
│  │  (元数据)    │  │  (OLAP数据) │  │   (缓存)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         ↓                ↓                ↓              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Langfuse Web (Port 3000)                 │   │
│  │         Langfuse Worker (Port 3030)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.3 已知问题与规避

**问题 1**: LangChain CallbackHandler 在 LangGraph 流式场景下可能阻塞
- **来源**: [GitHub #10584](https://github.com/langfuse/langfuse/issues/10584)
- **规避**: 使用 Low-level SDK 手动埋点，不依赖 CallbackHandler

**问题 2**: `@observe` 装饰器在 async generator 上下文传播有问题
- **来源**: [GitHub #7749](https://github.com/langfuse/langfuse/issues/7749)
- **规避**: 在 AgentEngine.stream() 中显式传递 trace_id

---

## 3. 异步队列处理方案

### 3.1 Langfuse SDK 内部机制

Langfuse Python SDK 默认使用**后台线程 + 内存队列**实现异步发送：

```python
# SDK 内部实现（简化）
class Langfuse:
    def __init__(self):
        self.queue = Queue()
        self.worker_thread = Thread(target=self._worker)
        self.worker_thread.start()

    def trace(self, **kwargs):
        # 非阻塞：仅将数据放入队列
        self.queue.put({"type": "trace", "data": kwargs})
        return TraceProxy(self, kwargs)

    def _worker(self):
        while True:
            item = self.queue.get()
            # 实际网络 I/O 在后台线程执行
            self._send_to_server(item)
```

### 3.2 流式输出保障

```python
# AgentEngine.stream() 中的集成示例
async def stream(self, message: str, history: List):
    # 创建 Trace（非阻塞，仅放入队列）
    trace = langfuse.trace(
        name="agent_chat",
        user_id=user_id,
        session_id=conversation_id,
        input={"message": message}
    )

    # 流式输出循环
    async for chunk in self.llm.astream(...):
        yield chunk  # 立即 yield，不被 Langfuse 阻塞

    # 流结束后更新 Trace（非阻塞）
    trace.update(output=response)
```

**关键点**：
- `trace()` 调用立即返回，不等待网络 I/O
- `update()` 同样非阻塞
- 后台线程在独立执行，不影响 asyncio 事件循环

### 3.3 应用关闭时的 Flush

```python
# backend.py lifespan
@asynccontextmanager
async def lifespan(app):
    yield
    # 等待所有 Langfuse 事件发送完成
    langfuse.flush()
```

---

## 4. 本地化部署方案

### 4.1 架构组件

| 容器 | 端口 | 用途 | 资源建议 |
|------|------|------|----------|
| langfuse-web | 3000 | Web UI | 512MB |
| langfuse-worker | 3030 | 后台任务 | 512MB |
| postgres | 5432 | 元数据存储 | 1GB |
| clickhouse | 8123/9000 | OLAP 数据存储 | 2GB |
| redis | 6379 | 缓存 | 256MB |
| minio | 9000-9001 | 对象存储（可选） | 512MB |

**总计**: 约 5GB 内存，推荐至少 4 核 16GB

### 4.2 Docker Compose 配置

```yaml
# docker-compose.langfuse.yml
version: "3.8"

services:
  langfuse-web:
    image: langfuse/langfuse:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/langfuse
      - CLICKHOUSE_HOST=clickhouse
      - CLICKHOUSE_PORT=8123
      - REDIS_HOST=redis:6379
      - NEXTAUTH_SECRET=${LANGFUSE_NEXTAUTH_SECRET:-changeme}
      - SALT=${LANGFUSE_SALT:-changeme}
      - ENCRYPTION_KEY=${LANGFUSE_ENCRYPTION_KEY:-changeme}
    depends_on:
      - postgres
      - clickhouse
      - redis

  langfuse-worker:
    image: langfuse/langfuse:latest
    command: worker
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/langfuse
      - CLICKHOUSE_HOST=clickhouse
      - CLICKHOUSE_PORT=8123
      - REDIS_HOST=redis:6379
    depends_on:
      - postgres
      - clickhouse
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=langfuse
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  clickhouse:
    image: clickhouse/clickhouse-server:23
    volumes:
      - clickhouse_data:/var/lib/clickhouse

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  clickhouse_data:
  redis_data:
```

### 4.3 Podman 兼容性

```bash
# Podman 用户可使用 podman-compose（功能兼容）
podman-compose -f docker-compose.langfuse.yml up -d
```

### 4.4 环境隔离

```bash
# .env.langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxx
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_RELEASE=local-dev
```

---

## 5. 数据模型与埋点设计

### 5.1 Trace 结构

```
agent_chat (Trace)
├── input: {message, history, agent_name, kb_ids}
├── metadata: {model_service, tools, temperature}
├── output: {response}
├── user_id: user_id
├── session_id: conversation_id
│
├── llm_generation (Generation)
│   ├── model: glm-4.7
│   ├── input: [messages]
│   ├── output: content
│   ├── usage_details: {input_tokens, output_tokens, total}
│   └── cost_details: {input_cost, output_cost, total_cost}
│
├── rag_retrieval (Span)
│   ├── input: {query, kb_ids}
│   ├── output: {documents, scores}
│   └── event: vector_search
│
├── tool_execution (Span)
│   ├── mcp_calculator (Event)
│   ├── skill_ab_pdf (Event)
│   └── sub_agent_call (Event)
│
└── error_tracking (Event) [仅异常时]
```

### 5.2 关键指标

| 指标 | 来源 | 用途 |
|------|------|------|
| **总延迟** | Trace.end_time - Trace.start_time | 性能监控 |
| **首字延迟 (TTFT)** | Generation.completion_start_time | 用户体验 |
| **Token 使用** | Generation.usage_details | 成本分析 |
| **工具调用耗时** | Span.end_time - Span.start_time | 瓶颈识别 |
| **错误率** | Event.level = ERROR | 质量监控 |

---

## 6. 参考资源

### 6.1 官方文档

- [Langfuse Python SDK (Low-level)](https://langfuse.com/docs/observability/sdk/python/low-level-sdk)
- [Docker Compose 部署指南](https://langfuse.com/self-hosting/deployment/docker-compose)
- [LangChain 集成](https://langfuse.com/integrations/frameworks/langchain)
- [LangGraph 集成示例](https://langfuse.com/guides/cookbook/example_langgraph_agents)

### 6.2 问题跟踪

- [Streaming Issue #10584](https://github.com/langfuse/langfuse/issues/10584)
- [Async Context Issue #7749](https://github.com/langfuse/langfuse/issues/7749)
- [Blocking Concern #8817](https://github.com/langfuse/langfuse/issues/8817)

---

## 7. 实施计划

### Phase 1: 基础设施搭建（Task #2）
- [ ] 创建 Docker Compose 配置
- [ ] 部署 Langfuse 本地环境
- [ ] 配置 API Key 及环境变量
- [ ] 验证服务可达性

### Phase 2: SDK 集成
- [ ] 创建 `src/langfuse_client.py` 封装
- [ ] AgentEngine 添加 Trace 埋点
- [ ] 集成 LLM Generation 追踪
- [ ] 添加工具调用 Span

### Phase 3: 验收测试
- [ ] 流式输出不受影响
- [ ] Trace 数据正确记录
- [ ] 成本统计准确
- [ ] 错误场景捕获

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Langfuse 宕机 | Tracing 丢失 | SDK 本地队列 + 后台重试 |
| 网络延迟增加 | 用户体验下降 | 异步非阻塞发送 |
| 存储溢出 | 服务不可用 | 数据保留策略 + 监控 |
| 阻塞流式输出 | 核心功能损坏 | 严格的异步测试 |

---

## 附录 A: Langfuse vs 其他方案

| 特性 | Langfuse | LangSmith | Weights & Biases |
|------|----------|-----------|------------------|
| 开源 | ✅ | ❌ | ❌ |
| 本地部署 | ✅ | ❌ | ❌ |
| LangChain 集成 | ✅ | ✅ | ✅ |
| 成本 | 自托管 | 付费 | 付费 |
| 自定义能力 | 高 | 中 | 低 |

---

**下一步**: Task #2 - 基础设施搭建
