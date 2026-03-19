# 系统架构概览

> Agent Builder 的整体架构设计文档。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent Builder                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Frontend (Next.js 15)                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐│   │
│  │  │ AgentChat    │ │ KbManagement │ │ MCP Config   │ │ Skill Mgmt  ││   │
│  │  │ + Streaming  │ │ + FileUpload │ │ + Model Svc  │ │ + Upload    ││   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │ SSE / REST API                        │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Backend (FastAPI)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                   │   │
│  │  /api/agents | /api/mcp-services | /api/skills | /api/knowledge-bases│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌───────────────┬───────────────┬───────────────┬─────────────────────┐   │
│  │   Agent       │      MCP      │    Skill      │  Knowledge Base     │   │
│  │   Manager     │    Manager    │   Registry    │     Manager         │   │
│  └───────┬───────┴───────┬───────┴───────┬───────┴─────────┬───────────┘   │
│          │               │               │                 │                 │
│  ┌───────▼───────────────▼───────────────▼─────────────────▼───────────┐   │
│  │                        Core Services                                 │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │   │
│  │  │ AgentEngine │ │ Environment │ │  Execution  │ │  Conversation │  │   │
│  │  │  (LangGraph)│ │   Manager   │ │   Engine    │ │    Manager    │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │   │
│  │  │Document Proc│ │   Embedder  │ │  Retriever  │ │   FileStorage │  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    External Services                                 │   │
│  │  LLM Providers (Zhipu/Alibaba/Ollama) | MCP Servers | Conda          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Data Storage                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  data/                                                                      │
│  ├── agents/           ├── conversations/    ├── environments/             │
│  ├── knowledge_base/   ├── files/            ├── executions/               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. AgentEngine (智能体引擎)

**位置**: `src/agent_engine.py`

**职责**:
- 基于 LangGraph 实现多模式规划（ReAct、Reflexion、Plan & Solve、ReWOO、ToT）
- 流式输出管理（智能缓冲策略）
- 工具调用协调
- RAG 知识库检索集成

**关键特性**:
- 支持多种规划模式
- 50 字符缓冲阈值（工具调用检测 vs 流式响应）
- SSE 事件流输出

### 2. KnowledgeBaseManager (知识库管理器)

**位置**: `src/knowledge_base_manager.py`

**职责**:
- 知识库 CRUD 操作
- 文档管理（上传、删除、状态跟踪）
- 向量存储管理
- 检索器初始化

**数据结构**:
```
data/knowledge_base/
├── configs/           # 知识库配置
├── documents/         # 文档元数据
├── vectors/           # 向量索引
└── stats/             # 统计信息
```

### 3. DocumentProcessor (文档处理器)

**位置**: `src/document_processor.py`

**职责**:
- 文档解析（PDF、DOCX、TXT、MD）
- 智能分块（基于段落和语义）
- 字符统计和预处理

**支持格式**:
- PDF (.pdf)
- Word (.docx)
- 纯文本 (.txt, .md)

### 4. Embedder (向量化器)

**位置**: `src/embedder.py`

**职责**:
- 文本向量嵌入
- 批量处理优化
- 多模型支持（默认使用智谱 AI）

### 5. Retriever (检索器)

**位置**: `src/retriever.py`

**职责**:
- 向量相似度搜索
- Top-K 结果返回
- 相关性评分

### 6. MCPManager (MCP 工具管理器)

**位置**: `src/mcp_manager.py`

**职责**:
- MCP 服务连接管理（stdio/SSE）
- 工具适配和转换
- 自动重连和错误恢复
- 本地 SSE 服务回退机制

### 7. SkillRegistry (技能注册表)

**位置**: `src/skill_registry.py`

**职责**:
- 技能发现和加载
- SKILL.md 解析
- 技能元数据管理

### 8. EnvironmentManager (环境管理器)

**位置**: `src/environment_manager.py`

**职责**:
- Conda 环境创建和销毁
- 依赖包安装
- 隔离执行环境

### 9. ConversationManager (对话管理器)

**位置**: `src/conversation_manager.py`

**职责**:
- 对话历史持久化
- 索引维护
- 时间分组

### 10. FileStorageManager (文件存储管理器)

**位置**: `src/file_storage_manager.py`

**职责**:
- 文件上传和存储
- MD5 校验
- MIME 类型检测

---

## 数据流

### 聊天流程（含 RAG）

```
用户输入 → AgentChat
    │
    ├─→ 检查是否启用知识库
    │       │
    │       └─→ 是 → KnowledgeBaseManager
    │               │
    │               ├─→ Retriever.search()
    │               │       │
    │               │       └─→ Embedder.vectorize(query)
    │               │               │
    │               │               └─→ 向量相似度搜索
    │               │                       │
    │               └─→ 返回 Top-K 结果 → 注入到 Prompt
    │
    ├─→ AgentEngine.stream()
    │       │
    │       ├─→ LLM 调用（含 RAG 上下文）
    │       │
    │       ├─→ 工具调用 → MCPManager
    │       │
    │       └─→ SSE 事件流 → AgentChat 渲染
    │
    └─→ ConversationManager 保存历史
```

### 知识库文档上传流程

```
DocumentUploader 组件
    │
    └─→ /api/knowledge-bases/{kb_id}/documents
            │
            ├─→ DocumentProcessor.parse()
            │       │
            │       ├─→ 提取文本
            │       └─→ 智能分块
            │
            ├─→ Embedder.embed_chunks()
            │       │
            │       └─→ 批量向量化
            │
            └─→ KnowledgeBaseManager.add_document()
                    │
                    ├─→ 存储文档元数据
                    ├─→ 存储向量索引
                    └─→ 更新统计
```

---

## API 端点分类

| 类别 | 前缀 | 说明 |
|------|------|------|
| Agents | `/api/agents` | 智能体管理、聊天 |
| Conversations | `/api/agents/{name}/conversations` | 对话历史 |
| Knowledge Bases | `/api/knowledge-bases` | RAG 知识库管理 |
| MCP Services | `/api/mcp-services` | MCP 工具服务 |
| Skills | `/api/skills` | 技能管理 |
| Model Services | `/api/model-services` | LLM 提供商配置 |
| Environment | `/api/agents/{name}/environment` | Conda 环境管理 |
| Files | `/api/agents/{name}/files` | 文件上传管理 |
| Execution | `/api/agents/{name}/execute` | 脚本执行 |
| System | `/api/system`, `/health` | 系统状态 |

详见 [API 参考文档](../references/api-reference.md)

---

## 技术栈

### 后端
- **框架**: FastAPI + Uvicorn
- **智能体**: LangChain + LangGraph
- **向量**: 智谱 AI Embeddings
- **环境**: Conda
- **协议**: SSE (Server-Sent Events)

### 前端
- **框架**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + Shadcn/UI
- **动画**: Framer Motion
- **测试**: Playwright

---

## 扩展点

### 添加新的规划模式
1. 在 `src/agent_engine.py` 中添加新的状态图构建逻辑
2. 在 `PlanningMode` 枚举中添加新模式

### 添加新的 MCP 服务
1. 在 `builtin_mcp_services/` 中创建服务脚本
2. 在 `src/builtin_services.py` 中注册

### 添加新的技能
1. 在 `skills/builtin/` 或 `skills/user/` 中创建技能目录
2. 编写 `SKILL.md` 定义文件

### 添加新的文档格式支持
1. 在 `src/document_processor.py` 中添加解析器
2. 更新 `SUPPORTED_FORMATS` 列表

---

## 版本历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-17 | 2.0 | 添加 RAG 知识库架构 |
| 2026-03-12 | 1.0 | 初始架构文档 |
