# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Builder is a general-purpose AI agent construction platform that allows users to create, configure, and interact with AI agents. It features:
- Multi-LLM support (Ollama, ZhipuAI)
- MCP (Model Context Protocol) integration for tool use
- Skills system for extending agent capabilities
- Multiple planning modes (React, Reflexion, Plan & Solve, ReWOO, Tree of Thought)
- Streaming chat responses with thinking/tool-call visibility

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│                    Port: 20880                               │
│  Components: AgentChat, MCPServiceDialog, SkillDetailDialog │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│                    Port: 20881                               │
│  Routes: /api/agents, /api/mcp-services, /api/skills        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ AgentManager  │   │ MCPServiceRegistry│   │  SkillRegistry  │
│ AgentInstance │   │   MCPManager      │   │   SkillLoader   │
│  AgentEngine  │   │ (stdio/SSE modes) │   │  (builtin/user) │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐   ┌─────────────────────────────────────────┐
│ LangGraph     │   │ Builtin MCP Services (SSE, port 20882)  │
│ LangChain     │   │ calculator, cold-jokes, coingecko       │
└───────────────┘   └─────────────────────────────────────────┘
```

### Core Components

- **`backend.py`**: FastAPI server with REST API endpoints for agents, MCP services, and skills
- **`src/agent_engine.py`**: LangGraph-based agent engine with multiple planning modes
- **`src/agent_manager.py`**: Manages agent configurations and instances
- **`src/mcp_manager.py`**: Handles MCP tool connections (stdio and SSE modes)
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

Supported providers (in `LLMProvider` enum):
- `ollama`: Local Ollama server (default: `qwen2.5:7b`)
- `zhipu`: ZhipuAI API (GLM models)

Configure via agent settings: `llm_provider`, `llm_model`, `llm_base_url`, `temperature`

## Ports

| Service | Port |
|---------|------|
| Frontend (Next.js) | 20880 |
| Backend (FastAPI) | 20881 |
| MCP SSE Server | 20882 |
