# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Builder is a general-purpose AI agent construction platform that allows users to create, configure, and interact with AI agents. It features:
- Multi-LLM support via Model Service Registry (ZhipuAI, Alibaba Bailian, Ollama)
- MCP (Model Context Protocol) integration for tool use
- Skills system for extending agent capabilities (16 builtin skills)
- Multiple planning modes (React, Reflexion, Plan & Solve, ReWOO, Tree of Thought)
- Streaming chat responses with thinking/tool-call visibility
- Conversation history management with drawer-style UI
- **Isolated environment support** - Conda virtual environments for skill script execution
- **File upload functionality** - Support for PDF/DOCX/XLSX file uploads as skill inputs

---

> **⚠️ Agent Team 运作规则**
>
> 当用户**明确要求**使用 Agent Team（如 TaskForce141）处理问题时，必须严格按照团队分工模式运作：
>
> 1. **Lead 职责**：诊断问题 → 创建任务 → 派发给对应 teammate → 审阅结果 → 验收确认
> 2. **禁止行为**：Lead 不得直接执行前端开发、后端开发、测试等具体工作
> 3. **标准流程**：
>    ```
>    用户请求 → Lead 诊断 → 派单给 teammate → teammate 执行 → teammate 交付 → Lead 验收 → 用户确认
>    ```
> 4. **团队配置**：详见 `teams/TaskForce141/TEAM_CONFIG.md`
>
> **例外情况**：仅当用户未明确要求使用团队时，Lead 才可直接处理简单问题。
>
> ---

> **⚠️ Playwright UAT测试重要注意事项**
>
> 在使用Playwright进行智能体对话测试时，**必须确保在正确的输入区域发送消息**：
>
> 1. **正确的区域**：**调试对话**的"输入消息"文本框（页面右侧的聊天区域）
> 2. **错误的区域**：**人设与提示词**的编辑框（页面左侧的配置区域）
>
> **UI结构说明**：
> - 页面分为左右两栏
> - **左侧**：智能体配置面板（人设、模型、MCP服务、技能等）
> - **右侧**：调试对话面板（聊天消息列表 + 输入框）
>
> **测试脚本选择器指南**：
> - ❌ **错误**：`page.locator('textarea').first()` — 这会选中左侧人设编辑框！
> - ✅ **正确**：`page.locator('input[type="text"][placeholder]').first()` — 选中右侧聊天输入框
> - 发送方式：`input.press('Enter')` 或点击发送按钮
>
> **错误示例**：在配置面板的textarea中输入消息，这不会触发聊天请求
>
> ---

---

## 智能体聊天测试指南

> **⚠️ 每次 UAT 和演示之前必须仔细阅读本节**
>
> **经验来源**: AC130-202603150000 迭代（AgentEngine.stream 参数修复）

### 1. 测试前检查清单

| 检查项 | 命令/方法 | 预期结果 |
|--------|-----------|----------|
| 后端服务运行 | `curl http://localhost:20881/api/agents` | 返回 agent 列表 JSON |
| 前端服务运行 | 浏览器访问 `http://localhost:20880` | 页面正常加载 |
| **后端代码已更新** | 重启后端服务 | `kill $(cat backend.pid) && python backend.py` |
| API 响应正常 | `curl -X POST http://localhost:20881/api/agents/test3/chat/stream -H "Content-Type: application/json" -d '{"message":"你好","history":[]}'` | 返回流式 content 事件 |

### 2. 正确的测试位置

```
┌─────────────────────────────────────────────────────────────────────┐
│                         页面布局示意                                 │
├────────────────────────────┬────────────────────────────────────────┤
│     左侧：配置面板          │       右侧：调试对话面板               │
│                            │                                        │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ 人设与提示词         │  │  │                                  │  │
│  │ ┌──────────────────┐ │  │  │    聊天消息列表                  │  │
│  │ │ <textarea>       │ │  │  │    - 用户消息气泡                │  │
│  │ │ 这里输入的是      │ │  │  │    - AI 回复气泡                │  │
│  │ │ 智能体人设配置    │ │  │  │                                  │  │
│  │ │ 不是聊天消息！    │ │  │  │                                  │  │
│  │ └──────────────────┘ │  │  ├──────────────────────────────────┤  │
│  │ ❌ 错误的测试位置    │  │  │ ┌──────────────────────────────┐ │  │
│  └──────────────────────┘  │  │ │ <input type="text">          │ │  │
│                            │  │ │ 在这里输入消息...            │ │  │
│  ┌──────────────────────┐  │  │ └──────────────────────────────┘ │  │
│  │ 模型设置             │  │  │ ✅ 正确的测试位置                │  │
│  │ MCP服务              │  │  └──────────────────────────────────┘  │
│  │ 技能配置             │  │                                        │
│  └──────────────────────┘  │                                        │
└────────────────────────────┴────────────────────────────────────────┘
```

### 3. 正确的 Playwright 选择器

```typescript
// ❌ 错误：选中左侧人设编辑框（textarea）
const chatInput = page.locator('textarea').first();

// ✅ 正确：选中右侧聊天输入框（input type="text"）
const chatInput = page.locator('input[type="text"][placeholder]').first();

// 或者通过 placeholder 内容定位
const chatInput = page.locator('input[placeholder*="输入消息"], input[placeholder*="message"]').first();
```

### 4. 正常回复的标准

| 用户输入 | 正常回复示例 | 异常回复（需排查） |
|----------|--------------|-------------------|
| "你好" | "你好！很高兴见到你！😊" / "你好！有什么可以帮助你的吗？" | 空字符串、错误提示、乱码 |
| "今天天气怎么样" | "抱歉，我无法获取实时天气信息..." | `{"type": "error", ...}` |
| "1+1等于几" | "1+1等于2" | 无响应、超时 |

**正常回复的特征**：
1. ✅ 内容与用户输入**相关**
2. ✅ 内容**完整**（不是截断的片段）
3. ✅ 内容**有意义**（不是乱码或错误信息）
4. ✅ 流式输出**流畅**（打字机效果，逐字符显示）

**异常回复的特征**：
1. ❌ 空字符串或完全无内容
2. ❌ 错误信息如 `"处理请求时发生错误"`
3. ❌ 内容与输入完全不相关
4. ❌ 截断或乱码

### 5. 完整测试流程

```typescript
// 标准测试脚本模板
test('智能体聊天测试', async ({ page }) => {
  // 1. 访问主页
  await page.goto('http://localhost:20880');
  await page.waitForLoadState('networkidle');

  // 2. 选择智能体
  await page.locator('h3:has-text("test3")').first().click();
  await page.waitForTimeout(2000);

  // 3. 定位正确的输入框（关键！）
  const chatInput = page.locator('input[type="text"][placeholder]').first();
  await expect(chatInput).toBeVisible();

  // 4. 输入消息
  await chatInput.fill('你好');
  await page.waitForTimeout(500);

  // 5. 发送消息
  await chatInput.press('Enter');

  // 6. 等待并验证响应
  await page.waitForTimeout(5000);

  // 7. 验证响应内容（不是空字符串）
  const pageContent = await page.textContent('body');
  const hasValidResponse = pageContent?.includes('你好') ||
                          pageContent?.includes('高兴') ||
                          pageContent?.includes('帮助');
  expect(hasValidResponse).toBeTruthy();
});
```

### 6. 常见问题排查

| 问题现象 | 可能原因 | 排查方法 |
|----------|----------|----------|
| API 返回参数错误 | 后端未重启加载新代码 | 重启后端服务 |
| 空响应 | LLM 调用失败 | 检查模型服务配置 |
| 选择器找不到元素 | 使用了错误的选择器 | 使用 `input[type="text"]` |
| 消息发送后无响应 | 输入到了人设编辑框 | 检查截图确认输入位置 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│                    Port: 20880                               │
│  Components: AgentChat, MCPServiceDialog, SkillDetailDialog │
│              ModelServiceDialog, SkillUploadDialog           │
│              ConversationDrawer, ConversationList,           │
│              ConversationCard, FileUploader                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│                    Port: 20881                               │
│  Routes: /api/agents, /api/mcp-services, /api/skills,       │
│          /api/model-services, /api/agents/{name}/conversations │
│          /api/agents/{name}/environment, /api/agents/{name}/files │
│          /api/agents/{name}/execute                          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┼─────────────────────┬───────────────────┬─────────────────────┐
        ▼                     ▼                     ▼                     ▼                   ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ AgentManager  │   │ MCPServiceRegistry│  │  SkillRegistry  │   │ModelServiceRegistry│   │ConversationManager│   │EnvironmentManager│
│ AgentInstance │   │   MCPManager      │   │   SkillLoader   │   │ (Zhipu/Bailian/   │   │ (JSON persistence)│   │ (Conda envs)    │
│  AgentEngine  │   │ (stdio/SSE modes) │   │  (builtin/user) │   │    Ollama)        │   │                  │   └─────────────────┘
└───────────────┘   └─────────────────┘   └─────────────────┘   └───────────────────┘   └──────────────────┘           │
        │                     │                                                               │                   │
        ▼                     ▼                                                               ▼                   ▼
┌───────────────┐   ┌─────────────────────────────────────────┐                     ┌─────────────────┐   ┌─────────────────┐
│ LangGraph     │   │ Builtin MCP Services (SSE, port 20882)  │                     │FileStorageManager│   │ExecutionEngine  │
│ LangChain     │   │ calculator, cold-jokes, coingecko       │                     │(Agent file store)│   │(Script execution)│
└───────────────┘   └─────────────────────────────────────────┘                     └─────────────────┘   └─────────────────┘
```

### Core Components

- **`backend.py`**: FastAPI server with REST API endpoints for agents, MCP services, skills, and model services
- **`src/agent_engine.py`**: LangGraph-based agent engine with multiple planning modes
- **`src/agent_manager.py`**: Manages agent configurations and instances
- **`src/conversation_manager.py`**: Manages conversation history CRUD operations and persistence
- **`src/mcp_manager.py`**: Handles MCP tool connections (stdio and SSE modes)
- **`src/model_service_registry.py`**: Global registry for LLM model service configurations
- **`src/mcp_registry.py`**: Global MCP service configuration registry
- **`src/skill_registry.py`**: Manages skill registration and discovery
- **`src/builtin_services.py`**: Auto-starts builtin MCP services on startup
- **`src/environment_manager.py`**: Manages Conda virtual environments for isolated skill execution
- **`src/file_storage_manager.py`**: Handles file uploads and storage for agents
- **`src/execution_engine.py`**: Executes skill scripts in isolated environments

### Data Directories

- **`data/`**: Runtime data storage
  - `agent_configs.json`: Saved agent configurations
  - `mcp_services.json`: MCP service registry
  - `skills_index.json`: Skills index
  - `conversations/{agent_name}/`: Conversation history JSON files per agent
  - `files/{agent_name}/`: Uploaded files for each agent
  - `environments/{agent_name}/`: Environment metadata
  - `executions/{agent_name}/`: Execution records
- **`skills/`**: Skills storage
  - `builtin/`: Pre-installed skills (read from SKILL.md)
  - `user/`: User-uploaded skills
- **`builtin_mcp_services/`**: Local MCP service implementations
- **`environments/`**: Conda virtual environments for isolated execution (env_{agent_name}/)

## Commands

### Backend (Python)

```bash
# Install dependencies
pip install -r requirements.txt

# Run backend server (port 20881)
python backend.py

# Or with uvicorn directly
uvicorn backend:app --host 0.0.0.0 --port 20881
```

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Development server (port 20880)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint
```

### Testing

```bash
# Test streaming output (Python)
python tests/test_streaming_output.py
```

## Key Implementation Details

---

> **⚠️ 重要备注：无论代码如何调整，都必须保障对话的流式输出效果正常**
>
> 流式输出是调试对话的核心体验，任何代码修改都**不能破坏**以下功能：
> 1. 打字机效果的流畅性（逐字符流式显示）
> 2. 思考过程（thinking）的实时更新
> 3. 工具调用（tool_call/tool_result）的实时展示
> 4. 技能加载状态（skill_loading/skill_loaded）的实时反馈
> 5. 性能指标（metrics）的准确统计

---

> **⚠️ 重要备注：前端静态资源 404 问题（2026-03-11 排查记录）**
>
> **问题现象**：主页 HTML 返回 200，但所有 JS/CSS 静态资源返回 404，页面样式失效
>
> **核心原因**：Next.js 构建缓存不一致
> - HTML 引用：`/_next/static/chunks/webpack.js`（无 hash）
> - 实际文件：`webpack-e77c34dddeff0db3.js`（带 hash）
> - 导致浏览器请求的文件名与实际构建文件不匹配
>
> **解决方案**：
> ```bash
> # 1. 停止前端服务（找到并杀掉 next-server 进程）
> kill -9 <next-server-pid>
>
> # 2. 清除构建缓存
> rm -rf frontend/.next
>
> # 3. 重新启动
> cd frontend && npm run dev
> ```
>
> **后续注意事项**：
> 1. **禁止热删除**：在开发服务器运行时删除 `.next` 目录会导致服务状态不一致
> 2. **先停后清**：必须先停止服务，再清除缓存，最后重启
> 3. **验证方法**：使用 Playwright 或浏览器 DevTools 检查控制台是否有 404 错误
> 4. **生产环境**：使用 `npm run build && npm start`，避免开发模式的缓存问题

---

> **⚠️ 重要原则：开发完成后必须清除缓存并重启服务**
>
> 每次开发完毕，进行"前端测试/UAT/告知用户验证"之前，**务必先执行以下步骤**：
>
> ```bash
> # 1. 停止前端服务
> pkill -f "next-server" || kill -9 <next-server-pid>
>
> # 2. 清除前端构建缓存
> rm -rf frontend/.next
>
> # 3. 重新启动前端服务
> cd frontend && npm run dev
> ```
>
> **原因**：Next.js 开发模式会缓存构建产物，代码修改后如果不清理缓存，可能导致：
> - 旧代码仍在运行，测试结果不准确
> - 静态资源 404 错误
> - 类型定义不同步

---

### Streaming Response Flow（流式输出核心原理）

流式输出实现采用**三层架构**：后端生成 → 前端代理 → 前端渲染

#### 1. 后端流式生成 (`src/agent_engine.py`)

**核心方法**: `AgentEngine.stream()` (第822行)

**智能缓冲策略**:
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

**事件类型**:
| 类型 | 说明 | 示例 |
|------|------|------|
| `thinking` | 思考过程 | `{"type": "thinking", "content": "正在分析..."}` |
| `content` | 最终回答（逐字符） | `{"type": "content", "content": "你"}` |
| `tool_call` | 工具调用开始 | `{"type": "tool_call", "name": "evaluate", "args": {...}}` |
| `tool_result` | 工具执行结果 | `{"type": "tool_result", "name": "evaluate", "result": "..."}` |
| `skill_loading` | 技能加载中 | `{"type": "skill_loading", "skill_name": "pdf"}` |
| `skill_loaded` | 技能加载完成 | `{"type": "skill_loaded", "skill_name": "pdf", "success": true}` |
| `metrics` | 性能指标 | `{"type": "metrics", "first_token_latency": 500, ...}` |

**后端 API 端点** (`backend.py` 第373-446行):
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

#### 2. 前端流式代理 (`frontend/src/app/stream/agents/[name]/chat/route.ts`)

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

#### 3. 前端渲染 (`frontend/src/components/AgentChat.tsx`)

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

**打字机光标效果**:
```tsx
{isRunning && (
  <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
)}
```

#### 流式输出架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 用户发送消息                                                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (AgentChat.tsx)                                            │
│ POST /stream/agents/{name}/chat                                     │
│ Body: { message, history }                                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend API Route (route.ts)                                       │
│ 透传到 http://localhost:20881/api/agents/{name}/chat/stream         │
│ 关键 Headers: Cache-Control: no-cache, X-Accel-Buffering: no        │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend (FastAPI StreamingResponse)                                 │
│ media_type: text/event-stream                                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AgentEngine.stream()                                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ LLM astream() → 智能缓冲 (50字符) → 检测工具调用?            │   │
│  │                     ↓                    ↓                   │   │
│  │              工具调用: 完整缓冲    普通内容: 逐字符 yield     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ yield {"type": "thinking", ...}   → 思考过程                       │
│ yield {"type": "content", ...}    → 打字机效果                     │
│ yield {"type": "tool_call", ...}  → 工具调用                       │
│ yield {"type": "tool_result", ...}→ 工具结果                       │
│ yield {"type": "metrics", ...}    → 性能指标                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend SSE 解析 + flushSync 渲染                                  │
│                                                                     │
│ thinking  → 实时更新思考区域                                        │
│ content   → flushSync 强制同步渲染 → 打字机效果                     │
│ tool_call → 添加到工具调用列表                                      │
│ tool_result → 更新工具结果                                          │
│ metrics   → 显示性能指标                                            │
└─────────────────────────────────────────────────────────────────────┘
```

#### 关键技术点

| 技术 | 作用 | 代码位置 |
|------|------|----------|
| **SSE (Server-Sent Events)** | 流式传输协议 | `backend.py:438-446` |
| **智能缓冲策略** | 平衡工具检测与流式响应 | `agent_engine.py:953-1005` |
| **flushSync** | 强制 React 同步渲染 | `AgentChat.tsx:293-301` |
| **专用流式路径** | 绕过代理缓冲 | `getStreamingUrl()` |
| **禁用缓冲 Headers** | 防止中间层缓冲 | `X-Accel-Buffering: no` |

See `best-practice.md` for detailed debugging guidance on streaming issues.

### MCP Connection Modes

- **stdio**: Local process communication (for local MCP servers)
- **SSE**: Server-Sent Events for remote MCP services
- Local REST API fallback for builtin services on port 20882

### Agent Planning Modes

Configured via `planning_mode` in `AgentConfig`:
- `react`: Thought → Action → Observation loop
- `reflexion`: Post-execution reflection and self-correction
- `plan_and_solve`: Plan first, then execute
- `rewOO`: Plan without observation, parallel tool execution
- `tot`: Tree of thoughts, exploring multiple paths

### Skills System

Skills are loaded from `SKILL.md` files in `skills/` directories. Each skill:
- Must have a `SKILL.md` file with title and description
- Can include YAML frontmatter with version, author, tags
- Content is injected into agent system prompt when enabled

### Conversation History System

The conversation history feature allows users to manage and resume previous chat sessions with agents.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ page.tsx                                                        │
│ ├── History Button (调试对话右上角)                              │
│ └── ConversationDrawer (抽屉组件，从右侧滑出)                    │
│     ├── Search Box                                              │
│     ├── New Conversation Button                                  │
│     └── ConversationList                                        │
│         ├── Date Groups (今天/昨天/7天内/更早)                   │
│         └── ConversationCard[] (标题、预览、时间、操作按钮)       │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| `ConversationDrawer` | `frontend/src/components/ConversationDrawer.tsx` | Right-side drawer with search and list |
| `ConversationList` | `frontend/src/components/ConversationList.tsx` | Time-grouped conversation list |
| `ConversationCard` | `frontend/src/components/ConversationCard.tsx` | Individual conversation card with actions |
| `ConversationManager` | `src/conversation_manager.py` | Backend CRUD operations for conversations |

#### Data Model

```typescript
interface Conversation {
  id: string;              // UUID
  agent_name: string;      // 所属智能体
  title: string;           // 会话标题 (自动生成或用户重命名)
  preview: string;         // 预览文本 (最后一条消息截断)
  message_count: number;   // 消息数量
  created_at: string;      // ISO 8601 timestamp
  updated_at: string;      // ISO 8601 timestamp
  messages: ChatMessage[]; // 完整消息列表
}
```

#### Storage

Conversations are persisted as JSON files in `data/conversations/{agent_name}/{conversation_id}.json`.

#### Integration with AgentChat

The `AgentChat` component accepts optional conversation props:
```typescript
interface AgentChatProps {
  agentName: string;
  shortTermMemory?: number;
  conversationId?: string | null;              // 当前会话 ID
  onConversationChange?: (id: string, messages: ChatMessage[]) => void;
}
```

When a conversation is selected from history:
1. `page.tsx` sets `currentConversationId` and `currentConversationMessages`
2. `AgentChat` loads historical messages into the chat view
3. New messages are appended and auto-saved to the conversation
4. Chat behavior respects current "高级设置" constraints (e.g., `short_term_memory`)

## LLM Configuration

Agents reference model services via `model_service` field (string name of registered service).

Supported providers (in `ModelProvider` enum):
- `zhipu`: ZhipuAI API (GLM models)
- `alibaba_bailian`: Alibaba Bailian API
- `ollama`: Local Ollama server

Configure model services via `/api/model-services` endpoints. Each service defines: `provider`, `base_url`, `api_key`, `selected_model`.

**Legacy fields** (`llm_provider`, `llm_model`, `llm_base_url`) are deprecated but retained for data migration.

## Ports

| Service | Port |
|---------|------|
| Frontend (Next.js) | 20880 |
| Backend (FastAPI) | 20881 |
| MCP SSE Server | 20882 |

## API Endpoints

| Resource | Endpoints |
|----------|-----------|
| Agents | `GET/POST /api/agents`, `GET/PUT/DELETE /api/agents/{name}`, `POST /api/agents/{name}/chat`, `POST /api/agents/{name}/chat/stream` |
| Conversations | `GET/POST /api/agents/{name}/conversations`, `GET/PUT/DELETE /api/agents/{name}/conversations/{id}`, `POST /api/agents/{name}/conversations/{id}/messages`, `POST /api/agents/{name}/conversations/{id}/save` |
| MCP Services | `GET/POST /api/mcp-services`, `GET/PUT/DELETE /api/mcp-services/{name}`, `POST /api/mcp-services/{name}/test`, `GET /api/mcp-services/{name}/tools` |
| Skills | `GET /api/skills`, `GET/DELETE /api/skills/{name}`, `GET /api/skills/{name}/files/{path}`, `POST /api/skills/upload` |
| Model Services | `GET/POST /api/model-services`, `GET/PUT/DELETE /api/model-services/{name}`, `POST /api/model-services/test`, `GET /api/model-services/default-url/{provider}` |
| Environment | `POST /api/agents/{name}/environment`, `GET /api/agents/{name}/environment`, `DELETE /api/agents/{name}/environment`, `POST /api/agents/{name}/environment/packages`, `GET /api/agents/{name}/environment/packages` |
| Files | `POST /api/agents/{name}/files`, `GET /api/agents/{name}/files`, `GET /api/agents/{name}/files/{file_id}`, `DELETE /api/agents/{name}/files/{file_id}` |
| Execution | `POST /api/agents/{name}/execute`, `GET /api/agents/{name}/executions`, `GET /api/agents/{name}/executions/{execution_id}` |

## Debugging

See `badcase.md` for troubleshooting guidance on streaming issues and debugging tools (Playwright automation, SSE testing scripts).

---

## Iteration History

### iteration-2603121000 (2026-03-12)

**需求**: 调试对话支持上传文件供智能体读取 & Agent Skill支持独立环境运行

**核心改动**:
1. **Skill脚本入口**: 为AB-pdf和AB-docx添加`scripts/main.py`入口脚本
2. **依赖自动安装**: `EnvironmentManager.install_skill_dependencies()`自动检测并安装requirements.txt
3. **工具描述优化**: `execute_skill`工具添加Few-shot调用示例
4. **file_context增强**: 包含file_id表格和明确的调用示例
5. **前端状态展示**: Skill执行状态可视化（loading/executing/completed/failed）

**新增文件**:
- `skills/builtin/AB-pdf/scripts/main.py`
- `skills/builtin/AB-pdf/scripts/requirements.txt`
- `skills/builtin/AB-docx/scripts/main.py`
- `skills/builtin/AB-docx/scripts/requirements.txt`
- `frontend/src/components/FileUploader.tsx`
- `frontend/src/lib/fileApi.ts`
- `frontend/src/types/`

**已知问题**:
- ~~使用skill后前台左下角可能显示issue错误~~ ✅ **已修复** (iteration-2603121500)

**绩效**: Lead B

### iteration-2603121500 (2026-03-12)

**需求**: 修复Skill执行状态显示异常问题

**问题现象**: 使用PDF/DOCX技能时, "技能执行状态"区域同时显示"执行完成"和"执行失败"

**根因分析**:
1. `skill_loading` 事件使用完整技能名称（如 "AB-PDF Processing Guide"）
2. `execute_skill` 工具调用使用短名称（如 "ab-pdf"）
3. 前端使用 `s.status === 'executing'` 匹配所有执行中技能, 而非精确匹配 `skillName`
4. 导致状态污染, 同一技能出现多个状态条

**修复方案**:
1. 实现 `normalizeSkillName()` 函数规范化技能名称
2. 实现 `findOrCreateSkillState()` 函数统一状态管理
3. 修改 `AgentChat.tsx` 中4处关键事件处理逻辑, 确保状态去重和精确匹配

**修复文件**:
- `frontend/src/components/AgentChat.tsx` (第616-640行, 641-675行, 477-485行, 504-523行)

**验证结果**:
- 回归测试 5/5 通过
- PDF/DOCX技能执行状态只显示一个状态条目
- 流式输出功能正常

**绩效**: Lead A

### iteration-2603130900 (2026-03-13)

**需求**: 审视当前系统中智能体的skill运行环境模式

**调查结论**:
1. **当前模式**: 独立Conda虚拟环境
   - 每个Agent拥有独立的Conda环境 (`environments/env_{agent_name}/`)
   - Skill依赖自动安装到Agent专属环境
   - 每次执行使用临时工作目录 (`/tmp/exec_*`)

2. **隔离级别**:
   - ✅ Python环境完全隔离（独立Conda环境）
   - ✅ 进程空间隔离
   - ⚠️ 文件系统部分隔离（临时工作目录）
   - ❌ 网络无隔离
   - ❌ 系统资源无限制（无CPU/内存cgroup）

3. **关键特性**:
   - 懒加载：环境在首次执行时创建（10-30秒开销）
   - 依赖去重：同一Skill的依赖不会重复安装
   - 并发控制：每Agent最多3个并发执行

**适用场景**: 可信环境下的单租户场景

**改进建议**:
- 短期：共享基础环境 + 差异化依赖层
- 长期：Docker容器替代Conda（多租户场景）

**参与人员**: CTO (A), Backend Dev (B+)

**绩效**: Lead A

### iteration-2603131100 (2026-03-13)

**需求**:
1. 智能体创建体验优化 - 环境初始化进度可视化
2. 调试对话消息重复Bug修复

**核心改动**:

**需求一：智能体创建体验优化**
- 新增产品需求规格说明书和技术方案选型报告
- 新增初始化引导卡片组件 `InitializationGuideCard.tsx`
- 新增环境就绪通知组件 `EnvironmentReadyNotification.tsx`
- 新增模拟进度计算器 `frontend/src/lib/progress.ts`
- 后端API增强：环境状态响应增加进度字段

**需求二：调试对话消息重复Bug**
- 修复 `AgentChat.tsx` 中 `onConversationChange` 重复调用问题
- 添加 `lastProcessedConversationRef` 使用 `conversationId + msgCount` 作为唯一标识符去重

**新增文件**:
- `teams/tf141/iterations/iteration-2603131100/产品需求规格说明书.md`
- `teams/tf141/iterations/iteration-2603131100/技术方案选型报告.md`
- `teams/tf141/iterations/iteration-2603131100/系统架构设计文档.md`
- `teams/tf141/iterations/iteration-2603131100/bugfix-message-duplicate.md`
- `frontend/src/components/InitializationGuideCard.tsx`
- `frontend/src/components/EnvironmentReadyNotification.tsx`
- `frontend/src/lib/progress.ts`

**修改文件**:
- `frontend/src/components/AgentChat.tsx` (消息重复Bug修复)
- `backend.py` (环境状态API增强)

**验证结果**:
- 后端流式输出测试 ✅ 通过
- 会话创建和保存测试 ✅ 通过
- 前端UI加载测试 ✅ 通过

**待集成**: 新组件需集成到 `page.tsx`

**参与人员**: product-manager(A), cto(A), backend-dev(A), frontend-dev(A), tester(B+), project-assistant(B)

**绩效**: Lead A

### iteration-2603131500 (2026-03-13)

**需求**: CoinGecko MCP连接失败问题诊断与修复

**问题现象**: 客户反馈CoinGecko MCP在系统主页测试时显示"连接失败"，且在智能体中配置后无法被正常调用

**关键发现**: CoinGecko MCP服务本身**HEALTHY**（50个工具可用），问题根因是**后端启动环境不一致**（系统Python缺少mcp库）

**核心改动**:

**后端改动**:
- `backend.py`: 添加MCP库启动检查 + 新增诊断API端点 `/api/mcp-services/{name}/diagnose`
- `src/mcp_manager.py`: 增强 `test_mcp_connection()` 错误提示，添加 `mcp_available` 字段
- `start_backend.sh`: 新增启动脚本，确保使用虚拟环境

**前端改动**:
- `MCPServiceDialog.tsx`: 集成"诊断连接"按钮和状态展示
- `MCPDiagnosticResult.tsx`: 完整诊断结果组件（分层展示：Config→DNS→Network→TLS→MCP）
- `iteration-2603131500.spec.ts`: 回归测试用例

**新增文件**:
- `start_backend.sh` (后端启动脚本)
- `frontend/src/components/MCPDiagnosticResult.tsx` (诊断结果组件)
- `frontend/tests/iteration-2603131500.spec.ts` (测试用例)
- `teams/tf141/iterations/iteration-2603131500/` (迭代文档)

**验证结果**:
- 诊断API测试 ✅ 通过
- 前端诊断UI测试 ✅ 通过（修复UI选择器后）
- test001例行验证 ✅ 3轮对话正常
- UAT验收 ⚠️ 有条件通过（环境问题需用户修复）

**用户行动项**:
```bash
# 使用启动脚本重启后端
cd /work/agent-builder-general
bash start_backend.sh
```

**参与人员**: product-manager(A), cto(A), backend-dev(A), frontend-dev(A), tester(B+), user-representative(B+), project-assistant(A)

**绩效**: Lead A
