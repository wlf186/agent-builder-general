# CLAUDE.md

Agent Builder - 通用 AI 智能体构建平台。支持多 LLM、MCP 工具集成、技能系统、流式对话、RAG 知识库。

---

## 快速启动

```bash
./start.sh          # 启动前后端服务
./stop.sh           # 停止服务
./start.sh --skip-deps  # 跳过依赖检查
```

**端口**: 前端 20880 | 后端 20881 | MCP SSE 20882

---

## 核心约束

> ⚠️ **流式输出不可破坏** - 打字机效果、thinking/tool_call 实时展示是核心体验，任何修改都不能破坏。

**开发后必做**:
```bash
pkill -f "next-server" && rm -rf frontend/.next && cd frontend && npm run dev
```

---

## 目录结构

```
├── backend.py               # FastAPI 后端入口 (82KB)
├── start.sh / stop.sh       # 服务启停脚本
├── requirements.txt         # Python 依赖
├── package.json             # Node.js 依赖
│
├── src/                     # 核心模块 (Python)
│   ├── agent_engine.py      # LangGraph 智能体引擎 (102KB)
│   ├── agent_manager.py     # 智能体管理
│   ├── mcp_manager.py       # MCP 工具管理器
│   ├── mcp_registry.py      # MCP 服务注册
│   ├── mcp_tool_adapter.py  # MCP 工具适配器
│   ├── mcp_diagnostic.py    # MCP 诊断工具
│   ├── skill_registry.py    # 技能注册与发现
│   ├── skill_loader.py      # 技能加载器
│   ├── skill_tool.py        # 技能工具封装
│   ├── conversation_manager.py  # 对话管理
│   ├── environment_manager.py   # 环境管理器
│   ├── environment_creator.py   # 异步环境创建
│   ├── execution_engine.py  # 执行引擎
│   ├── file_storage_manager.py  # 文件存储管理
│   ├── debug_logger.py      # 调试日志
│   ├── structured_logger.py # 结构化日志
│   ├── stream_logger.py     # 流式日志
│   ├── trace_middleware.py  # 追踪中间件
│   ├── cycle_detector.py    # 循环检测
│   ├── knowledge_base_manager.py  # 知识库(RAG)管理
│   ├── document_processor.py # 文档处理
│   ├── embedder.py          # 向量嵌入
│   ├── retriever.py         # 向量检索
│   ├── secret_loader.py     # 密钥安全加载器
│   ├── langfuse_tracer.py   # Langfuse 追踪器 (可观测性)
│   ├── langfuse_client.py   # Langfuse 客户端封装
│   ├── model_service_registry.py  # 模型服务注册
│   ├── models.py            # 数据模型
│   └── builtin_services.py  # 内置服务
│
├── frontend/                # Next.js 15 前端
│   ├── src/
│   │   ├── app/             # App Router 结构
│   │   ├── components/      # React 组件
│   │   │   ├── AgentChat.tsx        # 聊天界面 + 流式渲染
│   │   │   ├── SubAgentSelector.tsx # 子智能体选择
│   │   │   ├── MCPServiceDialog.tsx # MCP 服务配置
│   │   │   ├── ModelServiceDialog.tsx # 模型服务配置
│   │   │   ├── DocumentUploader.tsx  # 文档上传
│   │   │   ├── KnowledgeBaseDialog.tsx # 知识库管理
│   │   │   ├── FileUploader.tsx      # 文件上传
│   │   │   ├── ConversationList.tsx  # 对话列表
│   │   │   ├── SkillDetailDialog.tsx # 技能详情
│   │   │   └── ... (20+ 组件)
│   │   ├── hooks/           # React Hooks
│   │   ├── lib/             # 工具库
│   │   └── types/           # TypeScript 类型
│   ├── tests/               # Playwright UAT 测试
│   └── next.config.ts       # Next.js 配置 (API 代理到 20881)
│
├── skills/                  # 技能目录
│   ├── builtin/             # 3 个内置技能（文档处理）
│   │   ├── AB-docx          # Word 文档处理
│   │   ├── AB-pdf           # PDF 文档处理
│   │   └── AB-xlsx          # Excel 表格处理
│   └── user/                # 用户自定义技能
│
├── builtin_mcp_services/    # 内置 MCP 服务
│   ├── calculator_server.py # 计算器服务
│   ├── joke_server.py       # 笑话服务
│   └── sse_server.py        # SSE 服务器 (端口 20882)
│
├── data/                    # 运行时数据
│   ├── agents/              # 智能体配置
│   ├── conversations/       # 对话历史
│   ├── environments/        # 环境数据
│   ├── knowledge_base/      # RAG 知识库数据
│   └── models/              # 模型配置
│
├── docs/                    # 文档知识库
│   ├── design-docs/         # 设计文档
│   ├── exec-plans/          # 执行计划
│   ├── product-specs/       # 产品规格
│   └── references/          # 参考文档
│
├── environments/            # LangGraph 环境实例
├── logs/                    # 运行日志
└── test-results/            # 测试结果
```

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) | **黄金原则**（必读） |
| [docs/design-docs/streaming-protocol.md](docs/design-docs/streaming-protocol.md) | 流式输出原理 |
| [docs/design-docs/architecture-overview.md](docs/design-docs/architecture-overview.md) | 系统架构 |
| [docs/references/testing-guide.md](docs/references/testing-guide.md) | Playwright UAT 指南 |
| [docs/references/api-reference.md](docs/references/api-reference.md) | API 端点汇总 |
| [docs/references/agent-team-communication.md](docs/references/agent-team-communication.md) | 智能体团队通信 |
| [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) | 技术债务追踪 |
| [docs/langfuse-credentials.md](docs/langfuse-credentials.md) | Langfuse 可观测性配置 |
| [docs/product-specs/](docs/product-specs/) | 产品规格文档 |

---

## Playwright 测试要点

**正确选择器**: `page.locator('input[type="text"][placeholder]').first()`
**错误选择器**: `page.locator('textarea').first()` ← 这是人设编辑框

**X11 远程投屏渲染问题**: Headed 模式下，`waitForLoadState('networkidle')` 后必须执行：
```typescript
await page.evaluate(() => window.scrollTo(0, 0));
```
触发重绘，避免屏幕内容断裂。

详见 [docs/references/testing-guide.md](docs/references/testing-guide.md)

---

## 核心组件

| 组件 | 位置 | 说明 |
|------|------|------|
| **后端核心** |
| AgentEngine | `src/agent_engine.py` | LangGraph 智能体引擎 (102KB) |
| AgentManager | `src/agent_manager.py` | 智能体生命周期管理 |
| MCPManager | `src/mcp_manager.py` | MCP 工具连接 (stdio/SSE) |
| MCPRegistry | `src/mcp_registry.py` | MCP 服务注册中心 |
| ModelServiceRegistry | `src/model_service_registry.py` | 模型服务注册中心 |
| SkillRegistry | `src/skill_registry.py` | 技能注册与发现 |
| ConversationManager | `src/conversation_manager.py` | 对话历史管理 |
| KnowledgeBaseManager | `src/knowledge_base_manager.py` | RAG 知识库管理 |
| DocumentProcessor | `src/document_processor.py` | 文档处理与分块 |
| Embedder | `src/embedder.py` | 向量嵌入服务 |
| Retriever | `src/retriever.py` | 向量检索服务 |
| EnvironmentManager | `src/environment_manager.py` | 异步环境初始化 |
| ExecutionEngine | `src/execution_engine.py` | 技能执行引擎 |
| FileStorageManager | `src/file_storage_manager.py` | 文件存储管理 |
| SecretLoader | `src/secret_loader.py` | 密钥安全加载器 |
| LangfuseTracer | `src/langfuse_tracer.py` | Langfuse 追踪 (LLM/工具调用可观测性) |
| **前端核心** |
| AgentChat | `frontend/src/components/AgentChat.tsx` | 聊天界面 + 流式渲染 (67KB, 1597行) |
| SubAgentSelector | `frontend/src/components/SubAgentSelector.tsx` | 子智能体选择器 |
| MCPServiceDialog | `frontend/src/components/MCPServiceDialog.tsx` | MCP 服务配置 |
| ModelServiceDialog | `frontend/src/components/ModelServiceDialog.tsx` | 模型服务配置 |
| DocumentUploader | `frontend/src/components/DocumentUploader.tsx` | 文档上传组件 |
| KnowledgeBaseDialog | `frontend/src/components/KnowledgeBaseDialog.tsx` | 知识库管理对话框 |
| EnvironmentBanner | `frontend/src/components/EnvironmentBanner.tsx` | 环境初始化提示 |
| ConversationDrawer | `frontend/src/components/ConversationDrawer.tsx` | 对话历史抽屉 |

---

## 凭证安全

> ⚠️ **禁止明文存储凭证** - 所有 Token/密钥必须使用环境变量，绝不写入代码或 git config。

| 凭证 | 环境变量 | 用途 |
|------|----------|------|
| GitHub PAT | `$CCGHTK` | Git push/PR 操作 |
| Langfuse Keys | `$LANGFUSE_PUBLIC_KEY` / `$LANGFUSE_SECRET_KEY` | 可观测性追踪 |

**Git 远程配置**: HTTPS URL，推送时使用 `$CCGHTK`：
```bash
git push https://${CCGHTK}@github.com/wlf186/agent-builder-general.git main
```

---

## 黄金原则摘要

1. **无文档不执行** - 复杂需求先在 `docs/exec-plans/active/` 写计划
2. **闭环反馈** - Bug 必须提炼为规则补充到文档
3. **严格边界** - 维持现有架构风格，不随意引入新封装
4. **流式优先** - 任何修改不能破坏打字机效果
5. **测试先行** - 修改后必须验证系统正常运行

详见 [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md)
