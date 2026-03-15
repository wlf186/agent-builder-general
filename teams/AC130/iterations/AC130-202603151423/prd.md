# 产品需求规格说明书（PRD）

## 项目名称
调试日志标准化升级 —— 实现全链路自愈式排查

## 文档版本
- 版本: 1.0
- 日期: 2026-03-15
- 作者: AC130 Team Lead

---

## 1. 背景与目标

### 1.1 核心痛点

| 痛点 | 描述 | 影响 |
|------|------|------|
| **黑盒现象** | 日志仅包含网络层状态（fetch、status 200），缺乏 Payload 和 Response 具体内容 | 无法还原用户操作时的完整上下文 |
| **服务端缺失** | 服务端日志显示为"无法获取"，导致模型逻辑、插件调用、知识库检索的错误无法回溯 | 排障严重依赖实时同步 |
| **排障成本高** | 开发无法通过离线日志复现问题 | 研发效率低下 |

### 1.2 目标

将现有的"网络层埋点"升级为"业务链路追踪"，确保日志导出后：
1. 开发无需登录环境即可还原用户操作时的完整输入、输出、中间推理状态及后台报错
2. 前后端日志通过 Trace ID 自动关联
3. 支持离线问题复现和审计回溯

---

## 2. 功能描述

### 2.1 功能概述

升级"下载调试日志"功能，实现全链路日志追踪：

```
用户操作 → 前端采集 → 后端记录 → 日志合并 → 导出完整链路
```

### 2.2 核心能力

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| 请求追踪 | 无 Trace ID | X-Request-ID 贯穿前后端 |
| 日志内容 | 网络层埋点 | 业务链路追踪（Request/Execution/Response/Error） |
| 数据脱敏 | 无 | API Key 等敏感信息自动打码 |
| 错误详情 | HTTP 状态码 | 完整错误堆栈 + 业务错误消息 |

---

## 3. 日志内容规范

### 3.1 日志分段结构

```
┌─────────────────────────────────────────────────────────────┐
│ [Request] 请求阶段                                          │
│   - trace_id: 唯一追踪标识                                   │
│   - timestamp: 请求时间                                     │
│   - user_input: 用户输入内容                                │
│   - agent_config: Agent 配置快照                            │
│   - context_length: 上下文长度                              │
│   - environment: 环境指纹（UserAgent、配置版本）             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [Execution] 执行阶段                                        │
│   - intent: 意图识别结果                                    │
│   - tool_calls: 工具调用记录                                │
│     - tool_name: 工具名称                                   │
│     - tool_args: 调用参数（脱敏）                           │
│     - tool_result: 返回结果                                 │
│     - duration: 执行耗时                                    │
│   - mcp_calls: MCP 服务调用记录                             │
│   - skill_calls: Skill 执行记录                             │
│   - rag_process: RAG 检索过程（如有）                       │
│     - query: 检索查询                                       │
│     - top_n_chunks: Top-N 切片内容                          │
│     - similarity_scores: 相似度得分                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [Response] 响应阶段                                         │
│   - model_output: 模型生成文本                              │
│   - reasoning_content: 思维链（如支持）                      │
│   - metrics: 性能指标                                       │
│     - first_token_latency: 首字延迟                         │
│     - total_duration: 总耗时                                │
│     - prompt_tokens: 输入 Token 数                          │
│     - completion_tokens: 输出 Token 数                      │
│     - total_tokens: 总 Token 数                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [Error] 错误阶段（如有）                                     │
│   - error_type: 错误类型                                    │
│   - error_code: HTTP 错误码                                 │
│   - error_message: 错误消息                                 │
│   - stack_trace: 后端堆栈（如适用）                          │
│   - suggestion: 修复建议                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 关键字段详细定义

#### 3.2.1 客户端日志（前端视角）

```json
{
  "client_log": {
    "trace_id": "abc123-def456-ghi789",
    "timestamp": "2026-03-15T14:23:45.123Z",
    "session_id": "session-uuid",
    "environment": {
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "agent_config_version": "v1.2.3",
      "frontend_version": "0.1.0",
      "page_url": "http://localhost:20880/"
    },
    "request": {
      "user_input": "请帮我分析这个PDF文件",
      "agent_name": "test001",
      "conversation_id": "conv-uuid",
      "context_messages": 5,
      "files_attached": ["file_id_1", "file_id_2"]
    },
    "sse_chunks": [
      {"type": "thinking", "content": "正在分析...", "timestamp": "..."},
      {"type": "tool_call", "name": "execute_skill", "timestamp": "..."},
      {"type": "content", "content": "根据分析...", "timestamp": "..."}
    ],
    "render_status": {
      "markdown_success": true,
      "stream_completed": true,
      "error": null
    }
  }
}
```

#### 3.2.2 模型/推理日志（核心层）

```json
{
  "inference_log": {
    "trace_id": "abc123-def456-ghi789",
    "timestamp": "2026-03-15T14:23:45.456Z",
    "model_info": {
      "provider": "zhipu",
      "model": "glm-4-flash",
      "temperature": 0.7
    },
    "prompt": {
      "system_prompt": "你是一个智能助手...",
      "user_prompt": "请帮我分析这个PDF文件",
      "full_messages": [
        {"role": "system", "content": "..."},
        {"role": "user", "content": "..."}
      ],
      "token_count": 1234
    },
    "reasoning": {
      "available": true,
      "content": "用户想要分析PDF，需要调用pdf skill..."
    },
    "tool_calls": [
      {
        "id": "call_001",
        "name": "execute_skill",
        "args": {
          "skill_name": "ab-pdf",
          "action": "extract_text",
          "file_id": "file_id_1"
        },
        "result": "PDF内容提取成功...",
        "duration_ms": 1234
      }
    ]
  }
}
```

#### 3.2.3 服务端日志（后端视角）

```json
{
  "server_log": {
    "trace_id": "abc123-def456-ghi789",
    "timestamp": "2026-03-15T14:23:45.234Z",
    "request_info": {
      "method": "POST",
      "path": "/api/agents/test001/chat/stream",
      "client_ip": "127.0.0.1",
      "headers": {
        "X-Request-ID": "abc123-def456-ghi789",
        "Content-Type": "application/json"
      }
    },
    "processing": {
      "agent_name": "test001",
      "skills_enabled": ["ab-pdf", "ab-docx"],
      "mcp_services": ["coingecko", "calculator"],
      "planning_mode": "react"
    },
    "rag_process": {
      "triggered": false,
      "query": null,
      "results": null
    },
    "error": {
      "occurred": false,
      "type": null,
      "message": null,
      "stack_trace": null
    }
  }
}
```

---

## 4. 技术实现要求

### 4.1 前后端日志关联

```
┌─────────────┐    X-Request-ID     ┌─────────────┐
│   Frontend  │ ──────────────────→ │   Backend   │
│             │                     │             │
│ 生成 TraceID │                     │ 记录 TraceID │
│ 附加到 Header│                     │ 传播到日志   │
│ 采集前端日志 │                     │ 采集后端日志 │
└─────────────┘                     └─────────────┘
       │                                   │
       │         导出时合并                 │
       └───────────────┬───────────────────┘
                       ↓
              ┌─────────────────┐
              │   完整日志文件   │
              │  （按 TraceID）  │
              └─────────────────┘
```

**实现要点**：
1. 前端生成 UUID v4 作为 Trace ID
2. 所有请求 Header 携带 `X-Request-ID`
3. 后端中间件提取并记录 Trace ID
4. 导出时按 Trace ID 合并前后端日志

### 4.2 数据脱敏规则

| 字段类型 | 脱敏规则 | 示例 |
|----------|----------|------|
| API Key | 保留前4后4位，中间用*替代 | `sk-1234****5678` |
| 密码 | 完全替换为 `******` | `******` |
| Token | 保留前8位，后用*替代 | `eyJhbGci****` |
| 文件路径 | 保留文件名，路径打码 | `****/document.pdf` |

### 4.3 导出格式

**格式选项**：
1. **JSON 格式**（推荐）：结构化，便于解析
2. **日志文件格式**：人类可读，便于快速浏览

**文件命名**：`debug_log_{agent_name}_{trace_id}_{timestamp}.json`

---

## 5. 验收标准

### 5.1 功能验收

| 验收项 | 验收标准 |
|--------|----------|
| 完整会话日志 | 下载的日志文件包含用户当前会话的全部消息（不仅是最后一轮对话）的完整原始 Prompt |
| Trace ID 关联 | 前后端日志通过 X-Request-ID 自动关联，不再显示"服务端日志无法获取" |
| 工具调用详情 | 日志中体现 Tool/MCP 调用参数及返回结果 |
| 多 Agent 支持 | 如调用子 Agent，日志中体现分流逻辑和子 Agent 返回结果 |
| 错误详情 | 后端超时或异常时，日志包含具体 Error Message 和堆栈 |

### 5.2 性能验收

| 指标 | 要求 |
|------|------|
| 日志采集延迟 | < 10ms（不影响正常请求） |
| 导出速度 | 1000条日志 < 2秒 |
| 内存占用 | 日志缓存 < 50MB |

### 5.3 安全验收

| 验收项 | 验收标准 |
|--------|----------|
| 敏感信息脱敏 | API Key 等敏感信息已打码 |
| 权限控制 | 只能导出当前会话的日志 |

---

## 6. 风险评估

### 6.1 技术风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 流式输出影响 | 高 | 日志采集异步进行，不阻塞 SSE 流 |
| 内存泄漏 | 中 | 日志缓存设置上限，定时清理 |
| 性能下降 | 中 | 使用惰性采集，仅在用户点击"下载日志"时聚合 |

### 6.2 合规风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 敏感信息泄露 | 高 | 强制脱敏，用户确认后才能导出 |
| 数据留存 | 中 | 日志仅存于客户端，不上传服务器 |

---

## 7. 里程碑计划

| 阶段 | 交付物 | 负责人 |
|------|--------|--------|
| M1: PRD & 技术设计 | 本文档 + 技术设计文档 | Lead |
| M2: 前端实现 | debugLogger.ts + AgentChat 集成 | Dev |
| M3: 后端实现 | Trace 中间件 + 日志增强 | Dev |
| M4: UAT 验收 | Playwright 测试 + 截图 | User Rep |
| M5: 发布 | 代码合并 + 文档更新 | Lead |

---

## 8. 附录

### 8.1 相关文档
- `CLAUDE.md` - 项目架构说明
- `best-practice.md` - 流式输出调试指南

### 8.2 术语表
- **Trace ID**: 全链路追踪标识，用于关联前后端日志
- **SSE**: Server-Sent Events，流式传输协议
- **RAG**: Retrieval-Augmented Generation，检索增强生成
- **CoT**: Chain of Thought，思维链
