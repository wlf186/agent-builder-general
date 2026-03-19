# 流式输出协议 (Streaming Protocol)

> 本文档详细说明 Agent Builder 的流式输出实现原理。

---

## 架构概览

流式输出采用**三层架构**：后端生成 → 前端代理 → 前端渲染

```
用户消息 → AgentChat.tsx → API Route → Backend → AgentEngine.stream()
                                                   ↓
                                         SSE 事件流 (逐字符 yield)
                                                   ↓
                              flushSync 强制同步渲染 → 打字机效果
```

---

## 后端实现 (`src/agent_engine.py`)

### 核心方法
- **位置**: `AgentEngine.stream()` (约第 822 行)
- **缓冲阈值**: 50 字符

### 智能缓冲策略
```python
BUFFER_THRESHOLD = 50  # 缓冲前50个字符

async for chunk in self.llm.astream(messages):
    # 检测是否为工具调用 JSON
    if stripped.startswith('{') or '"tool"' in buffer_content:
        might_be_tool_call = True
        buffering = True  # 继续缓冲，等待完整 JSON

    # 超过阈值且非工具调用，开始流式输出
    if len(buffer_content) > BUFFER_THRESHOLD and not might_be_tool_call:
        started_streaming = True
        for char in buffer_content:
            yield {"type": "content", "content": char}  # 逐字符输出
```

### 事件类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `thinking` | 思考过程 | `{"type": "thinking", "content": "正在分析..."}` |
| `content` | 最终回答（逐字符） | `{"type": "content", "content": "你"}` |
| `tool_call` | 工具调用开始 | `{"type": "tool_call", "name": "evaluate", "args": {...}}` |
| `tool_result` | 工具执行结果 | `{"type": "tool_result", "name": "evaluate", "result": "..."}` |
| `skill_loading` | 技能加载中 | `{"type": "skill_loading", "skill_name": "pdf"}` |
| `skill_loaded` | 技能加载完成 | `{"type": "skill_loaded", "skill_name": "pdf", "success": true}` |
| `metrics` | 性能指标 | `{"type": "metrics", "first_token_latency": 500, ...}` |

### API 端点 (`backend.py` 第 373-446 行)
```python
@app.post("/api/agents/{name}/chat/stream")
async def chat_stream(name: str, req: ChatRequest):
    async def generate():
        async for event in instance.chat_stream(req.message, req.history):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        }
    )
```

---

## 前端实现

### 1. 流式代理 (`frontend/src/app/stream/agents/[name]/chat/route.ts`)

**专用路径**: `/stream/agents/{name}/chat`（绕过 Next.js rewrites 代理）

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }) {
  const res = await fetch(`${BACKEND_URL}/api/agents/${name}/chat/stream`, {...});

  // 直接透传流式响应，不做任何缓冲
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### 2. 消息渲染 (`frontend/src/components/AgentChat.tsx`)

**ReadableStream + flushSync 实现打字机效果**:
```typescript
const reader = res.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));

      if (data.type === 'content') {
        streamingContentRef.current += data.content;
        // 关键：使用 flushSync 强制同步渲染，确保打字机效果
        flushSync(() => {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: streamingContentRef.current }
              : msg
          ));
        });
      }
    }
  }
}
```

---

## 关键技术点

| 技术 | 作用 | 代码位置 |
|------|------|----------|
| **SSE (Server-Sent Events)** | 流式传输协议 | `backend.py` 搜索 `StreamingResponse` |
| **智能缓冲策略** | 平衡工具检测与流式响应 | `agent_engine.py` 搜索 `BUFFER_THRESHOLD` |
| **flushSync** | 强制 React 同步渲染 | `AgentChat.tsx` 搜索 `flushSync` |
| **专用流式路径** | 绕过代理缓冲 | `getStreamingUrl()` |
| **禁用缓冲 Headers** | 防止中间层缓冲 | `X-Accel-Buffering: no` |

---

## 常见问题

### 流式输出不流畅
1. 检查后端是否使用 `StreamingResponse`
2. 检查 Headers 是否包含 `X-Accel-Buffering: no`
3. 使用 `tests/test_streaming_output.py` 验证

### 前端静态资源 404
```bash
# 停止服务 → 清除缓存 → 重启
pkill -f "next-server"
rm -rf frontend/.next
cd frontend && npm run dev
```
