# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Builder is a general-purpose AI agent construction platform that allows users to create, configure, and interact with AI agents. It features:
- Multi-LLM support via Model Service Registry (ZhipuAI, Alibaba Bailian, Ollama)
- MCP (Model Context Protocol) integration for tool use
- Skills system for extending agent capabilities (16 builtin skills)
- Multiple planning modes (React, Reflexion, Plan & Solve, ReWOO, Tree of Thought)
- Streaming chat responses with thinking/tool-call visibility

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│                    Port: 20880                               │
│  Components: AgentChat, MCPServiceDialog, SkillDetailDialog │
│              ModelServiceDialog, SkillUploadDialog           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│                    Port: 20881                               │
│  Routes: /api/agents, /api/mcp-services, /api/skills,       │
│          /api/model-services                                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌───────────────────┐
│ AgentManager  │   │ MCPServiceRegistry│  │  SkillRegistry  │   │ModelServiceRegistry│
│ AgentInstance │   │   MCPManager      │   │   SkillLoader   │   │ (Zhipu/Bailian/   │
│  AgentEngine  │   │ (stdio/SSE modes) │   │  (builtin/user) │   │    Ollama)        │
└───────────────┘   └─────────────────┘   └─────────────────┘   └───────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐   ┌─────────────────────────────────────────┐
│ LangGraph     │   │ Builtin MCP Services (SSE, port 20882)  │
│ LangChain     │   │ calculator, cold-jokes, coingecko       │
└───────────────┘   └─────────────────────────────────────────┘
```

### Core Components

- **`backend.py`**: FastAPI server with REST API endpoints for agents, MCP services, skills, and model services
- **`src/agent_engine.py`**: LangGraph-based agent engine with multiple planning modes
- **`src/agent_manager.py`**: Manages agent configurations and instances
- **`src/mcp_manager.py`**: Handles MCP tool connections (stdio and SSE modes)
- **`src/model_service_registry.py`**: Global registry for LLM model service configurations
- **`src/mcp_registry.py`**: Global MCP service configuration registry
- **`src/skill_registry.py`**: Manages skill registration and discovery
- **`src/builtin_services.py`**: Auto-starts builtin MCP services on startup

### Data Directories

- **`data/`**: Runtime data storage
  - `agent_configs.json`: Saved agent configurations
  - `mcp_services.json`: MCP service registry
  - `skills_index.json`: Skills index
- **`skills/`**: Skills storage
  - `builtin/`: Pre-installed skills (read from SKILL.md)
  - `user/`: User-uploaded skills
- **`builtin_mcp_services/`**: Local MCP service implementations

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

### Streaming Response Flow

The streaming implementation in `src/agent_engine.py` uses a buffering strategy to detect tool calls while maintaining responsive streaming:

1. Buffer first 50 characters to detect if response is a tool call
2. If no tool call detected, begin streaming immediately
3. Events include types: `thinking`, `tool_call`, `tool_result`, `content`, `metrics`

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
| MCP Services | `GET/POST /api/mcp-services`, `GET/PUT/DELETE /api/mcp-services/{name}`, `POST /api/mcp-services/{name}/test`, `GET /api/mcp-services/{name}/tools` |
| Skills | `GET /api/skills`, `GET/DELETE /api/skills/{name}`, `GET /api/skills/{name}/files/{path}`, `POST /api/skills/upload` |
| Model Services | `GET/POST /api/model-services`, `GET/PUT/DELETE /api/model-services/{name}`, `POST /api/model-services/test`, `GET /api/model-services/default-url/{provider}` |

## Debugging

See `badcase.md` for troubleshooting guidance on streaming issues and debugging tools (Playwright automation, SSE testing scripts).
