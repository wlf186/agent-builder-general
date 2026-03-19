# Langfuse 可观测性配置

**Updated**: 2026-03-19
**Environment**: Local Docker (Podman)

## 概述

Agent Builder 集成了 Langfuse 追踪，用于观测 LLM 调用和工具调用。

### 追踪内容

| 类型 | 说明 |
|------|------|
| **Trace** | 每次对话创建一个 Trace，包含用户输入和最终输出 |
| **LLM Span** | 每次 LLM 调用创建一个 Span，记录响应长度 |
| **Tool Span** | 每次工具调用创建一个 Span，记录工具名和结果 |

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/langfuse_tracer.py` | 追踪器实现 (Trace/Span 创建和结束) |
| `src/langfuse_client.py` | Langfuse 客户端封装 |
| `src/agent_engine.py` | 集成点：在 `stream()` 方法中创建 Trace 和 Spans |

## API Keys

| Key | Value |
|-----|-------|
| Public Key | `pk-lf-f39718677c1d2e85d93dbce86d3862e97a396a1b2145358a` |
| Secret Key | `sk-lf-a5756c4333a4acd504c87a4a341f306abc52f4ac3483e926` |

## Environment Variables

Add these to your `.env` file:

```bash
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-f39718677c1d2e85d93dbce86d3862e97a396a1b2145358a
LANGFUSE_SECRET_KEY=sk-lf-a5756c4333a4acd504c87a4a341f306abc52f4ac3483e926
LANGFUSE_ENABLED=true
```

## User Account

| Field | Value |
|-------|-------|
| Email | `admin@langfuse.local` |
| Password | `LangfuseAdmin123!` |

## Project

| Field | Value |
|-------|-------|
| Name | Agent Builder |
| ID | `e33995f4-ffe5-438e-96a9-213fc641cc94` |

## Access

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3000/api/public

## 故障排查

### 问题：Traces 不显示

**检查清单**:
1. Langfuse 服务是否运行: `curl http://localhost:3000`
2. `.env` 中 `LANGFUSE_ENABLED=true`
3. API Keys 是否正确配置
4. 检查 `src/langfuse_tracer.py` 和 `src/langfuse_client.py` 是否被 `agent_engine.py` 导入

### 问题：Spans 不显示

**原因**: `agent_engine.py` 中未调用 `create_span()` / `end_span()`

**修复**: 确保 `stream()` 方法中:
- LLM 调用前创建 Span，调用后结束 Span
- 工具执行前创建 Span，执行后结束 Span

## Notes

- These credentials are for **local development only**
- The Langfuse stack runs via Podman Compose
- Start: `podman-compose -f docker-compose.langfuse.yml up -d`
- Stop: `podman-compose -f docker-compose.langfuse.yml down`
