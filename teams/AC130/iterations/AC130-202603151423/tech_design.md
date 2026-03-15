# 技术设计文档

## 项目名称
调试日志标准化升级 —— 技术架构设计

## 文档版本
- 版本: 1.0
- 日期: 2026-03-15
- 作者: AC130 Team Lead

---

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        AgentChat.tsx                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐│ │
│  │  │                     DebugLogger (新增)                          ││ │
│  │  │  - 生成 Trace ID                                                ││ │
│  │  │  - 拦截 SSE Chunks                                              ││ │
│  │  │  - 采集环境指纹                                                 ││ │
│  │  │  - 管理日志生命周期                                             ││ │
│  │  └─────────────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ X-Request-ID Header
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Backend (FastAPI)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     TraceMiddleware (新增)                           │ │
│  │  - 提取/生成 Trace ID                                               │ │
│  │  - 注入请求上下文                                                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                       AgentEngine                                    │ │
│  │  - 记录 Prompt 详情                                                 │ │
│  │  - 记录 Tool Calls                                                  │ │
│  │  - 记录思维链 (reasoning)                                           │ │
│  │  - 记录错误堆栈                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     StructuredLogger (新增)                          │ │
│  │  - JSON 格式日志输出                                                │ │
│  │  - Trace ID 关联                                                    │ │
│  │  - 敏感信息脱敏                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
1. 用户发送消息
   │
   ├── DebugLogger.generateTraceId() → trace_id
   │
   ├── POST /api/agents/{name}/chat/stream
   │   Header: X-Request-ID: {trace_id}
   │
   ├── TraceMiddleware 拦截请求
   │   ├── 提取 X-Request-ID
   │   └── 注入 request.state.trace_id
   │
   ├── AgentEngine.stream()
   │   ├── 记录 Prompt (含 trace_id)
   │   ├── 记录 Tool Calls (含 trace_id)
   │   └── 记录 Errors (含 trace_id)
   │
   └── SSE 响应流
       │
       ├── DebugLogger 拦截 Chunks
       │   └── 存储到 clientLogStore[trace_id]
       │
       └── 用户点击"下载日志"
           │
           ├── 聚合 clientLogStore[trace_id]
           ├── 请求 serverLogStore[trace_id]
           └── 合并导出 JSON 文件
```

---

## 2. 前端设计

### 2.1 DebugLogger 类设计

**文件**: `frontend/src/lib/debugLogger.ts`

```typescript
/**
 * 调试日志采集器
 * 职责：生成 Trace ID、拦截 SSE Chunks、管理日志生命周期
 */
class DebugLogger {
  private traceId: string;
  private sessionId: string;
  private startTime: number;
  private logStore: LogStore;
  private environment: EnvironmentFingerprint;

  constructor() {
    this.traceId = this.generateTraceId();
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.logStore = new LogStore();
    this.environment = this.captureEnvironment();
  }

  // 生成 UUID v4 作为 Trace ID
  generateTraceId(): string;

  // 采集环境指纹
  captureEnvironment(): EnvironmentFingerprint;

  // 记录请求阶段
  logRequest(request: RequestLog): void;

  // 记录 SSE Chunk
  logSSEChunk(chunk: SSEChunk): void;

  // 记录工具调用
  logToolCall(toolCall: ToolCallLog): void;

  // 记录错误
  logError(error: ErrorLog): void;

  // 导出完整日志
  exportLogs(): Promise<DebugLogFile>;

  // 敏感信息脱敏
  sanitize(data: any): any;
}

// 日志存储（内存缓存）
class LogStore {
  private logs: Map<string, LogEntry[]>;

  add(traceId: string, entry: LogEntry): void;
  get(traceId: string): LogEntry[];
  clear(traceId: string): void;
}
```

### 2.2 日志数据结构

```typescript
interface DebugLogFile {
  version: string;
  export_time: string;
  trace_id: string;
  session_id: string;
  duration_ms: number;

  environment: {
    user_agent: string;
    page_url: string;
    frontend_version: string;
    agent_config_version: string;
  };

  request: {
    user_input: string;
    agent_name: string;
    conversation_id: string | null;
    context_messages: ChatMessage[];
    files_attached: string[];
  };

  execution: {
    sse_chunks: SSEChunkLog[];
    tool_calls: ToolCallLog[];
    skill_calls: SkillCallLog[];
  };

  response: {
    content: string;
    is_complete: boolean;
    render_status: {
      markdown_success: boolean;
      error: string | null;
    };
  };

  error: {
    occurred: boolean;
    type: string | null;
    message: string | null;
    stack_trace: string | null;
  } | null;

  metrics: {
    first_chunk_latency_ms: number;
    total_duration_ms: number;
    chunk_count: number;
    tool_call_count: number;
  };
}
```

### 2.3 AgentChat.tsx 集成点

```typescript
// 在 AgentChat 组件中集成
const debugLoggerRef = useRef<DebugLogger | null>(null);

// 1. 初始化（组件挂载时）
useEffect(() => {
  debugLoggerRef.current = new DebugLogger();
  return () => {
    debugLoggerRef.current?.cleanup();
  };
}, []);

// 2. 发送消息时记录请求
const handleSend = async () => {
  const traceId = debugLoggerRef.current?.startNewTrace();
  debugLoggerRef.current?.logRequest({
    user_input: input,
    agent_name: agentName,
    conversation_id: currentConversationId,
    context_messages: messages,
  });

  // 发送请求时携带 X-Request-ID
  const res = await fetch(url, {
    headers: {
      'X-Request-ID': traceId,
      ...
    }
  });
};

// 3. 处理 SSE 时记录 Chunks
const reader = res.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  debugLoggerRef.current?.logSSEChunk(chunk);

  // 处理 chunk...
}

// 4. 下载日志按钮处理
const handleDownloadLog = async () => {
  const logFile = await debugLoggerRef.current?.exportLogs();
  downloadJSON(logFile, `debug_log_${agentName}_${Date.now()}.json`);
};
```

---

## 3. 后端设计

### 3.1 TraceMiddleware 设计

**文件**: `src/trace_middleware.py`

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class TraceMiddleware(BaseHTTPMiddleware):
    """
    Trace ID 中间件
    职责：提取或生成 Trace ID，注入请求上下文
    """

    async def dispatch(self, request: Request, call_next):
        # 1. 从请求头提取 Trace ID，或生成新的
        trace_id = request.headers.get('X-Request-ID')
        if not trace_id:
            trace_id = str(uuid.uuid4())

        # 2. 注入请求上下文
        request.state.trace_id = trace_id

        # 3. 设置日志上下文
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        # 4. 执行请求
        try:
            response = await call_next(request)
            response.headers['X-Request-ID'] = trace_id
            return response
        except Exception as e:
            # 记录错误
            log_error(trace_id, e, request)
            raise
```

### 3.2 结构化日志设计

**文件**: `src/structured_logger.py`

```python
import structlog
from datetime import datetime
from typing import Any, Optional

class StructuredLogger:
    """
    结构化日志记录器
    职责：输出 JSON 格式日志，关联 Trace ID
    """

    def __init__(self):
        self.logger = structlog.get_logger()

    def log_request(self, trace_id: str, request_info: dict):
        self.logger.info(
            "request_started",
            trace_id=trace_id,
            timestamp=datetime.utcnow().isoformat(),
            **request_info
        )

    def log_prompt(self, trace_id: str, prompt_info: dict):
        self.logger.debug(
            "prompt_composed",
            trace_id=trace_id,
            **self.sanitize(prompt_info)
        )

    def log_tool_call(self, trace_id: str, tool_call: dict):
        self.logger.info(
            "tool_call_executed",
            trace_id=trace_id,
            tool_name=tool_call.get('name'),
            tool_args=self.sanitize(tool_call.get('args')),
            duration_ms=tool_call.get('duration_ms')
        )

    def log_error(self, trace_id: str, error: Exception, context: dict = None):
        self.logger.error(
            "error_occurred",
            trace_id=trace_id,
            error_type=type(error).__name__,
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            context=context
        )

    def sanitize(self, data: Any) -> Any:
        """敏感信息脱敏"""
        if isinstance(data, dict):
            return {k: self._sanitize_value(k, v) for k, v in data.items()}
        return data

    def _sanitize_value(self, key: str, value: Any) -> Any:
        sensitive_keys = ['api_key', 'token', 'password', 'secret']
        if any(sk in key.lower() for sk in sensitive_keys):
            return self._mask_sensitive(value)
        return value

    def _mask_sensitive(self, value: str) -> str:
        if len(value) <= 8:
            return '****'
        return f"{value[:4]}****{value[-4:]}"
```

### 3.3 AgentEngine 日志增强

**文件**: `src/agent_engine.py`（修改）

```python
class AgentEngine:
    async def stream(self, ...):
        trace_id = get_trace_id()  # 从上下文获取

        # 记录 Prompt 详情
        logger.log_prompt(trace_id, {
            "system_prompt": system_prompt,
            "user_message": user_message,
            "message_count": len(messages),
            "token_count": self._count_tokens(messages)
        })

        async for chunk in self.llm.astream(messages):
            # 记录思维链
            if chunk.get('reasoning_content'):
                logger.log_reasoning(trace_id, chunk['reasoning_content'])

            # 记录工具调用
            if chunk.get('tool_calls'):
                for tool_call in chunk['tool_calls']:
                    logger.log_tool_call(trace_id, {
                        "name": tool_call.name,
                        "args": tool_call.args,
                        "id": tool_call.id
                    })

            yield chunk

        # 记录完成
        logger.log_completion(trace_id, {
            "duration_ms": elapsed_ms,
            "chunk_count": chunk_count
        })
```

### 3.4 日志查询 API

**新增端点**: `GET /api/agents/{name}/debug-logs/{trace_id}`

```python
@app.get("/api/agents/{name}/debug-logs/{trace_id}")
async def get_debug_logs(name: str, trace_id: str):
    """
    获取指定 Trace ID 的服务端日志
    用于前端聚合完整日志链路
    """
    logs = await log_store.get_by_trace_id(trace_id)
    if not logs:
        raise HTTPException(status_code=404, detail="Logs not found")

    return {
        "trace_id": trace_id,
        "server_logs": logs,
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 4. 脱敏策略

### 4.1 脱敏规则

| 数据类型 | 匹配规则 | 脱敏方式 |
|----------|----------|----------|
| API Key | `api_key`, `apikey`, `key` | `sk-1234****5678` |
| Token | `token`, `access_token`, `bearer` | `eyJhbG****` |
| Password | `password`, `passwd`, `pwd` | `******` |
| Secret | `secret`, `private_key` | `****` |
| Email | 正则匹配 | `u***@example.com` |
| Phone | 正则匹配 | `138****1234` |

### 4.2 脱敏实现

```typescript
// 前端脱敏
function sanitize(obj: any): any {
  const SENSITIVE_PATTERNS = [
    { pattern: /api[_-]?key/i, mask: 'apiKey' },
    { pattern: /token/i, mask: 'token' },
    { pattern: /password/i, mask: 'password' },
    { pattern: /secret/i, mask: 'secret' },
  ];

  function maskValue(value: string, type: string): string {
    if (value.length <= 8) return '****';
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }

  // 递归处理对象...
}
```

---

## 5. 性能考虑

### 5.1 前端性能

| 优化点 | 策略 |
|--------|------|
| 内存占用 | 日志缓存限制 1000 条，超出则删除最旧记录 |
| 采集延迟 | 异步记录，不阻塞主线程 |
| 导出速度 | 使用 Blob + URL.createObjectURL，不经过服务器 |

### 5.2 后端性能

| 优化点 | 策略 |
|--------|------|
| 日志写入 | 异步写入，不阻塞请求处理 |
| 存储策略 | 内存缓存 + 定时清理（保留 1 小时内日志） |
| 查询性能 | 使用 dict 按 trace_id 索引，O(1) 查询 |

---

## 6. 文件变更清单

### 6.1 新增文件

| 文件路径 | 描述 |
|----------|------|
| `frontend/src/lib/debugLogger.ts` | 前端调试日志采集器 |
| `src/trace_middleware.py` | Trace ID 中间件 |
| `src/structured_logger.py` | 结构化日志记录器 |
| `src/log_store.py` | 日志存储管理 |

### 6.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `frontend/src/components/AgentChat.tsx` | 集成 DebugLogger |
| `backend.py` | 添加 TraceMiddleware、日志查询 API |
| `src/agent_engine.py` | 添加日志记录点 |

---

## 7. 测试策略

### 7.1 单元测试

- `debugLogger.test.ts`: 测试 Trace ID 生成、脱敏、日志聚合
- `trace_middleware.test.py`: 测试中间件逻辑
- `structured_logger.test.py`: 测试脱敏规则

### 7.2 集成测试

- 前后端 Trace ID 传递验证
- 日志导出完整性验证
- 敏感信息脱敏验证

### 7.3 E2E 测试（Playwright）

- 正常对话日志导出
- Tool Call 日志记录
- 错误场景日志记录

---

## 8. 部署计划

### 8.1 发布步骤

1. 部署后端变更（TraceMiddleware、日志增强）
2. 部署前端变更（DebugLogger）
3. 验证日志导出功能
4. 监控性能指标

### 8.2 回滚方案

- 功能开关：`ENABLE_DEBUG_LOGGING=true/false`
- 默认开启，如遇问题可快速关闭
