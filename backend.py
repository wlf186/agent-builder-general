"""
通用Agent构建器 - FastAPI 后端
"""
import json
import asyncio
import os
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn


# ============================================================================
# 辅助函数
# ============================================================================

def _calculate_mock_progress(elapsed_seconds: float) -> tuple[float, int]:
    """
    计算环境创建的模拟进度

    基于观察到的Conda环境创建时间模式：
    - 0-5秒: 初始化阶段 (0-30%)
    - 5-15秒: 下载依赖阶段 (30-70%)
    - 15-30秒: 安装配置阶段 (70-95%)
    - 超过30秒: 保持95%等待最终完成

    Args:
        elapsed_seconds: 已经过的时间(秒)

    Returns:
        (progress, estimated_remaining_ms) - 进度百分比(0-100)和预估剩余时间(毫秒)
    """
    if elapsed_seconds < 5:
        progress = min(30, (elapsed_seconds / 5) * 30)
        # 估算剩余时间: 假设总时间约30秒
        remaining = max(0, 30 - elapsed_seconds) * 1000
    elif elapsed_seconds < 15:
        progress = 30 + min(40, ((elapsed_seconds - 5) / 10) * 40)
        remaining = max(0, 30 - elapsed_seconds) * 1000
    elif elapsed_seconds < 30:
        progress = 70 + min(25, ((elapsed_seconds - 15) / 15) * 25)
        remaining = max(0, 35 - elapsed_seconds) * 1000
    else:
        progress = min(95, 70 + ((elapsed_seconds - 15) / 15) * 25)
        remaining = max(5000, (40 - elapsed_seconds) * 1000)  # 至少显示5秒

    return (round(progress, 1), int(remaining))

from src.models import (
    AgentConfig, LLMProvider, PlanningMode, MCPServiceConfig, MCPConnectionType,
    MCPAuthType, ModelServiceConfig, ModelProvider,
    # 新增：环境相关模型
    AgentEnvironment, EnvironmentStatus, EnvironmentType,
    FileInfo, ExecutionRecord, ExecutionStatus
)
from src.agent_manager import AgentManager
from src.mcp_registry import MCPServiceRegistry
from src.mcp_manager import test_mcp_connection
from src.builtin_services import setup_builtin_services, BuiltinServiceManager, shutdown_builtin_services
from src.skill_registry import SkillRegistry
from src.skill_loader import SkillLoader
from src.model_service_registry import ModelServiceRegistry
from src.model_provider_tester import test_model_service_connection
from src.conversation_manager import ConversationManager
# 新增：环境、文件、执行管理器
from src.environment_manager import EnvironmentManager, EnvironmentError
from src.environment_creator import EnvironmentCreator
from src.file_storage_manager import FileStorageManager, FileStorageError
from src.execution_engine import ExecutionEngine, ExecutionError


# 初始化
DATA_DIR = Path(__file__).parent / "data"
SKILLS_DIR = Path(__file__).parent / "skills"
ENVIRONMENTS_DIR = Path(__file__).parent / "environments"
FILES_DIR = DATA_DIR / "files"

# 确保目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)
ENVIRONMENTS_DIR.mkdir(parents=True, exist_ok=True)
FILES_DIR.mkdir(parents=True, exist_ok=True)

mcp_registry = MCPServiceRegistry(DATA_DIR)
skill_registry = SkillRegistry(DATA_DIR, SKILLS_DIR)
model_service_registry = ModelServiceRegistry(DATA_DIR)
conversation_manager = ConversationManager(DATA_DIR)

# 新增：初始化环境、文件、执行管理器（需要在AgentManager之前初始化）
environment_manager = EnvironmentManager(DATA_DIR, ENVIRONMENTS_DIR)
environment_creator = EnvironmentCreator(environment_manager, max_concurrent=3)
file_storage_manager = FileStorageManager(FILES_DIR)
execution_engine = ExecutionEngine(environment_manager, file_storage_manager, DATA_DIR)

# 初始化 AgentManager，传入 execution_engine
manager = AgentManager(
    DATA_DIR,
    mcp_registry,
    skill_registry,
    model_service_registry=model_service_registry,
    execution_engine=execution_engine
)

# 注册预置 MCP 服务
builtin_service_manager = BuiltinServiceManager(mcp_registry)
registered_services = setup_builtin_services(mcp_registry)
print(f"预置服务已注册: {registered_services}")

app = FastAPI(title="Agent Builder API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === 应用生命周期事件 ===
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app):
    """应用生命周期管理"""
    # 启动时
    print("\n" + "=" * 50)
    print("🚀 Agent Builder 启动中...")
    print("=" * 50)
    print(f"预置 MCP 服务: {registered_services}")
    print("=" * 50 + "\n")

    yield  # 应用运行

    # 关闭时
    print("\n" + "=" * 50)
    print("🛑 Agent Builder 关闭中...")
    print("=" * 50)

    # 关闭所有 Agent 实例
    await manager.shutdown_all()
    print("✓ 所有 Agent 实例已关闭")

    print("=" * 50 + "\n")


# 将生命周期管理应用到 FastAPI
# 注意：需要在创建 app 时使用 lifespan 参数，但这里我们用事件处理代替


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print("\n" + "=" * 50)
    print("🚀 Agent Builder 启动完成")
    print(f"   预置 MCP 服务: {registered_services}")
    print("=" * 50)

    # 数据迁移：清空存量智能体的旧模型配置
    _migrate_agent_configs()

    print("=" * 50 + "\n")


def _migrate_agent_configs():
    """迁移存量智能体配置，清空旧的LLM字段"""
    configs_file = DATA_DIR / "agent_configs.json"
    if not configs_file.exists():
        return

    try:
        with open(configs_file, "r", encoding="utf-8") as f:
            configs_data = json.load(f)

        migrated = False
        for name, config in configs_data.items():
            # 清空旧的LLM配置字段
            if config.get("llm_provider") is not None:
                config["llm_provider"] = None
                migrated = True
            if config.get("llm_model") is not None:
                config["llm_model"] = None
                migrated = True
            if config.get("llm_base_url") is not None:
                config["llm_base_url"] = None
                migrated = True

        if migrated:
            with open(configs_file, "w", encoding="utf-8") as f:
                json.dump(configs_data, f, ensure_ascii=False, indent=2)
            print("   ✓ 已迁移存量智能体配置")
    except Exception as e:
        print(f"   ✗ 迁移智能体配置失败: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    print("\n" + "=" * 50)
    print("🛑 Agent Builder 正在关闭...")
    print("=" * 50)

    # 关闭所有 Agent 实例
    await manager.shutdown_all()
    print("✓ 所有 Agent 实例已关闭")

    # 关闭预置服务
    shutdown_builtin_services()
    print("✓ 预置 MCP 服务已关闭")

    print("=" * 50 + "\n")


# === 请求/响应模型 ===

class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""


class UpdateAgentRequest(BaseModel):
    persona: str
    model_service: Optional[str] = None  # 新版：引用模型服务
    # 旧字段已废弃，但保留用于向后兼容
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    llm_base_url: Optional[str] = None
    temperature: float = 0.7
    max_iterations: int = 10
    short_term_memory: int = 5
    planning_mode: str = "react"
    mcp_services: List[str] = []
    skills: List[str] = []


class CreateModelServiceRequest(BaseModel):
    """创建模型服务请求"""
    name: str
    description: str = ""
    provider: str  # zhipu / alibaba_bailian / ollama
    base_url: str
    api_key: Optional[str] = None
    selected_model: str
    available_models: List[str] = []
    enabled: bool = True


class UpdateModelServiceRequest(BaseModel):
    """更新模型服务请求"""
    description: str = ""
    provider: str
    base_url: str
    api_key: Optional[str] = None
    selected_model: str
    available_models: List[str] = []
    enabled: bool = True


class TestModelServiceRequest(BaseModel):
    """测试模型服务连接请求"""
    provider: str
    base_url: str
    api_key: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []  # 对话历史 [{"role": "user/assistant", "content": "..."}]
    file_ids: List[str] = []  # 上传文件的ID列表


class CreateMCPServiceRequest(BaseModel):
    """创建MCP服务请求"""
    name: str
    description: str = ""
    connection_type: str = "stdio"  # stdio / sse
    # stdio 配置
    command: Optional[str] = None
    args: List[str] = []
    env: Dict[str, str] = {}
    # SSE 配置
    url: Optional[str] = None
    auth_type: str = "none"  # none / bearer / apikey
    auth_value: Optional[str] = None
    headers: Dict[str, str] = {}
    enabled: bool = True


class UpdateMCPServiceRequest(BaseModel):
    """更新MCP服务请求"""
    description: str = ""
    connection_type: str = "stdio"
    command: Optional[str] = None
    args: List[str] = []
    env: Dict[str, str] = {}
    url: Optional[str] = None
    auth_type: str = "none"
    auth_value: Optional[str] = None
    headers: Dict[str, str] = {}
    enabled: bool = True


class AgentResponse(BaseModel):
    name: str
    description: str
    llm_provider: str
    llm_model: str
    created_at: str


# === API 路由 ===

@app.get("/api/agents")
async def list_agents():
    """获取所有 Agent 列表"""
    agents = []
    for name in manager.list_agents():
        config = manager.get_config(name)
        if config:
            # 获取模型服务信息
            model_service_name = config.model_service
            model_info = ""
            if model_service_name:
                service = model_service_registry.get_service(model_service_name)
                if service:
                    model_info = f"{service.provider.value}: {service.selected_model}"

            agents.append({
                "name": name,
                "description": config.persona[:100] + "..." if len(config.persona) > 100 else config.persona,
                "model_service": model_service_name,
                "model_info": model_info,
                "llm_provider": config.llm_provider.value if config.llm_provider else None,
                "llm_model": config.llm_model,
                "created_at": "已保存"
            })
    return {"agents": agents}


@app.post("/api/agents")
async def create_agent(req: CreateAgentRequest):
    """创建新 Agent - 异步环境创建版本

    创建智能体后立即返回，环境在后台异步创建。
    前端应轮询 GET /api/agents/{name}/environment 获取环境状态。
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Agent名称不能为空")

    if req.name in manager.list_agents():
        raise HTTPException(status_code=400, detail="Agent名称已存在")

    config = AgentConfig(
        name=req.name.strip(),
        persona=req.description or "你是一个有帮助的AI助手。"
    )

    if manager.create_agent_config(config):
        agent_name = req.name.strip()

        # 创建初始环境元数据（状态为creating）
        initial_env = AgentEnvironment(
            agent_name=agent_name,
            environment_type=EnvironmentType.CONDA,
            status=EnvironmentStatus.CREATING,
            python_version="3.11"
        )
        environment_manager._save_metadata(initial_env)

        # 异步启动环境创建任务（不阻塞响应）
        asyncio.create_task(
            environment_creator.create(agent_name)
        )

        print(f"[AGENT] 已创建智能体 {agent_name}，后台环境创建任务已启动")

        # 立即返回
        return {
            "success": True,
            "name": agent_name,
            "environment_status": "creating"
        }
    else:
        raise HTTPException(status_code=500, detail="创建失败")


@app.get("/api/agents/{name}")
async def get_agent(name: str):
    """获取 Agent 详情"""
    config = manager.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Agent不存在")

    return {
        "name": name,
        "persona": config.persona,
        "model_service": config.model_service,
        "llm_provider": config.llm_provider.value if config.llm_provider else None,
        "llm_model": config.llm_model,
        "llm_base_url": config.llm_base_url,
        "temperature": config.temperature,
        "max_iterations": config.max_iterations,
        "short_term_memory": config.short_term_memory,
        "planning_mode": config.planning_mode.value,
        "mcp_services": config.mcp_services,
        "skills": config.skills
    }


@app.put("/api/agents/{name}")
async def update_agent(name: str, req: UpdateAgentRequest):
    """更新 Agent 配置"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    # 获取现有配置以保留未提供的字段
    existing_config = manager.get_config(name)

    config = AgentConfig(
        name=name,
        persona=req.persona,
        model_service=req.model_service,
        # 旧字段不再使用，设为None
        llm_provider=None,
        llm_model=None,
        llm_base_url=None,
        temperature=req.temperature,
        max_iterations=req.max_iterations,
        short_term_memory=req.short_term_memory,
        planning_mode=PlanningMode(req.planning_mode),
        mcp_services=req.mcp_services,
        skills=req.skills
    )

    if manager.update_agent_config(name, config):
        return {"success": True}
    else:
        raise HTTPException(status_code=500, detail="保存失败")


@app.delete("/api/agents/{name}")
async def delete_agent(name: str):
    """删除 Agent"""
    if manager.delete_agent_config(name):
        # 清理关联资源（环境和文件）
        try:
            # 清理 Conda 环境
            await environment_manager.delete_environment(name)
            print(f"[AGENT] 已删除 {name} 的执行环境")
        except Exception as e:
            print(f"[AGENT] 删除环境失败: {e}")

        try:
            # 清理上传的文件
            await file_storage_manager.cleanup_agent_files(name)
            print(f"[AGENT] 已清理 {name} 的上传文件")
        except Exception as e:
            print(f"[AGENT] 清理文件失败: {e}")

        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="Agent不存在")


@app.post("/api/agents/{name}/chat")
async def chat_with_agent(name: str, req: ChatRequest):
    """与 Agent 对话"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    instance = await manager.get_instance(name)
    if not instance:
        raise HTTPException(status_code=500, detail="无法加载Agent")

    try:
        response = await instance.chat(req.message, req.history)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 【流式输出 SSE 端点 - 谨慎修改】
#
# 此端点是流式对话的核心入口，将 AgentEngine.stream() 的 yield 事件
# 转换为 SSE (Server-Sent Events) 格式发送到前端。
#
# 关键实现：
# 1. 使用 StreamingResponse 返回 text/event-stream
# 2. 禁用所有缓冲（Cache-Control, X-Accel-Buffering）
# 3. 事件格式: data: {"type": "...", "content": "..."}\n\n
#
# ⚠️ 修改此端点可能影响：
# - 流式输出的实时性
# - 前端打字机效果
# - SSE 连接稳定性
#
# 相关文件：
# - src/agent_engine.py: stream() - 事件生成
# - frontend/src/app/stream/agents/[name]/chat/route.ts - 前端代理
# - frontend/src/components/AgentChat.tsx - 前端渲染
# ============================================================================
@app.post("/api/agents/{name}/chat/stream")
async def chat_stream(name: str, req: ChatRequest):
    """流式对话 - 支持返回 thinking、工具调用和最终回答

    【流式输出核心端点 - 谨慎修改】
    使用 SSE (Server-Sent Events) 协议实现流式传输。
    """
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    async def generate():
        import time
        start_time = time.time()
        first_token_time = None
        token_count = 0

        instance = await manager.get_instance(name)
        instance_ready_time = time.time()
        print(f"[METRICS] get_instance 耗时: {(instance_ready_time - start_time) * 1000:.0f}ms")

        if not instance:
            yield f"data: {json.dumps({'error': '无法加载Agent'}, ensure_ascii=False)}\n\n"
            return

        # 构建文件上下文（增强版，包含 file_id 表格和调用示例）
        file_context = ""
        file_ids_list = []
        if req.file_ids:
            try:
                files = await file_storage_manager.list_files(name)
                matched_files = [f for f in files if f.file_id in req.file_ids]
                if matched_files:
                    file_context = "\n\n=== 用户上传的文件 ===\n\n"
                    file_context += "| file_id | 文件名 | 类型 | 大小 |\n"
                    file_context += "|---------|--------|------|------|\n"
                    for f in matched_files:
                        file_ids_list.append(f.file_id)
                        size_kb = f.file_size / 1024
                        file_context += f"| {f.file_id} | {f.filename} | {f.mime_type} | {size_kb:.1f}KB |\n"

                    file_context += "\n**重要提示**:\n"
                    file_context += "1. 调用 execute_skill 工具时，请使用上述 file_id 作为 input_file_ids 参数\n"
                    file_context += "2. 文件会被自动放置在脚本的 ./input/ 目录下\n"
                    file_context += "3. 根据文件类型选择对应的 Skill：PDF 文件用 AB-pdf，Word 文档用 AB-docx\n"

                    # 生成调用示例
                    if matched_files:
                        first_file = matched_files[0]
                        file_id_str = '", "'.join(file_ids_list)
                        if first_file.mime_type == "application/pdf":
                            file_context += "\n**调用示例**:\n"
                            file_context += '```json\n'
                            file_context += f'{{"tool": "execute_skill", "arguments": {{"skill_name": "AB-pdf", "input_file_ids": ["{file_id_str}"], "arguments": ["./input/{first_file.filename}", "--action", "extract_text"]}}}}\n'
                            file_context += '```\n'
                        elif "word" in first_file.mime_type or first_file.filename.endswith('.docx'):
                            file_context += "\n**调用示例**:\n"
                            file_context += '```json\n'
                            file_context += f'{{"tool": "execute_skill", "arguments": {{"skill_name": "AB-docx", "input_file_ids": ["{file_id_str}"], "arguments": ["./input/{first_file.filename}", "--action", "extract_text"]}}}}\n'
                            file_context += '```\n'
            except Exception as e:
                print(f"[WARN] 获取文件信息失败: {e}")

        try:
            async for event in instance.chat_stream(req.message, req.history, file_context):
                # 记录第一个 token 时间
                if first_token_time is None and event.get('type') in ['content', 'thinking']:
                    first_token_time = time.time()
                    print(f"[METRICS] 首 Token 时延: {(first_token_time - start_time) * 1000:.0f}ms")

                # 统计 token 数量（基于内容长度估算）
                if event.get('type') == 'content' and event.get('content'):
                    # 中文约 1.5 字符/token，英文约 4 字符/token，取中值估算
                    content = event.get('content', '')
                    # 检测是否主要是中文
                    chinese_chars = sum(1 for c in content if '\u4e00' <= c <= '\u9fff')
                    if chinese_chars > len(content) * 0.3:
                        token_count += int(len(content) / 1.5)
                    else:
                        token_count += len(content) // 4

                if event.get('type') == 'thinking' and event.get('content'):
                    content = event.get('content', '')
                    chinese_chars = sum(1 for c in content if '\u4e00' <= c <= '\u9fff')
                    if chinese_chars > len(content) * 0.3:
                        token_count += int(len(content) / 1.5)
                    else:
                        token_count += len(content) // 4

                # event 是一个字典，包含 type 和其他字段
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            # 发送性能指标
            end_time = time.time()
            total_duration = end_time - start_time
            first_token_latency = (first_token_time - start_time) if first_token_time else total_duration

            metrics = {
                'type': 'metrics',
                'first_token_latency': round(first_token_latency * 1000, 0),  # 毫秒
                'total_tokens': token_count,
                'total_duration': round(total_duration * 1000, 0)  # 毫秒
            }
            yield f"data: {json.dumps(metrics, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    # 添加防止缓冲的headers
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用nginx缓冲
        }
    )


# === MCP 服务 API ===

@app.get("/api/mcp-services")
async def list_mcp_services():
    """获取所有 MCP 服务列表"""
    services = mcp_registry.list_services()
    return {
        "services": [
            {
                "name": s.name,
                "description": s.description,
                "connection_type": s.connection_type.value,
                "enabled": s.enabled,
                "created_at": s.created_at,
                "updated_at": s.updated_at
            }
            for s in services
        ]
    }


@app.post("/api/mcp-services")
async def create_mcp_service(req: CreateMCPServiceRequest):
    """创建 MCP 服务"""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="服务名称不能为空")

    if mcp_registry.service_exists(req.name):
        raise HTTPException(status_code=400, detail="服务名称已存在")

    config = MCPServiceConfig(
        name=req.name.strip(),
        description=req.description,
        connection_type=MCPConnectionType(req.connection_type),
        command=req.command,
        args=req.args,
        env=req.env,
        url=req.url,
        auth_type=MCPAuthType(req.auth_type),
        auth_value=req.auth_value,
        headers=req.headers,
        enabled=req.enabled
    )

    if mcp_registry.create_service(config):
        return {"success": True, "name": req.name}
    else:
        raise HTTPException(status_code=500, detail="创建失败")


@app.get("/api/mcp-services/{name}")
async def get_mcp_service(name: str):
    """获取 MCP 服务详情"""
    service = mcp_registry.get_service(name)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")

    return {
        "name": service.name,
        "description": service.description,
        "connection_type": service.connection_type.value,
        "command": service.command,
        "args": service.args,
        "env": service.env,
        "url": service.url,
        "auth_type": service.auth_type.value if service.auth_type else "none",
        "auth_value": "***" if service.auth_value else None,  # 隐藏敏感信息
        "headers": service.headers,
        "enabled": service.enabled,
        "created_at": service.created_at,
        "updated_at": service.updated_at
    }


@app.put("/api/mcp-services/{name}")
async def update_mcp_service(name: str, req: UpdateMCPServiceRequest):
    """更新 MCP 服务配置"""
    existing = mcp_registry.get_service(name)
    if not existing:
        raise HTTPException(status_code=404, detail="服务不存在")

    config = MCPServiceConfig(
        name=name,
        description=req.description,
        connection_type=MCPConnectionType(req.connection_type),
        command=req.command,
        args=req.args,
        env=req.env,
        url=req.url,
        auth_type=MCPAuthType(req.auth_type),
        # 如果 auth_value 为空，保留原有的
        auth_value=req.auth_value if req.auth_value else existing.auth_value,
        headers=req.headers,
        enabled=req.enabled
    )

    if mcp_registry.update_service(name, config):
        return {"success": True}
    else:
        raise HTTPException(status_code=500, detail="保存失败")


@app.delete("/api/mcp-services/{name}")
async def delete_mcp_service(name: str):
    """删除 MCP 服务"""
    # 检查是否为预置服务
    if builtin_service_manager.is_builtin_service(name):
        raise HTTPException(status_code=403, detail="预置服务不能删除")

    if mcp_registry.delete_service(name):
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="服务不存在")


@app.post("/api/mcp-services/{name}/test")
async def test_mcp_service_connection(name: str):
    """测试 MCP 服务连接"""
    service = mcp_registry.get_service(name)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")

    result = await test_mcp_connection(service)
    return result


@app.get("/api/mcp-services/{name}/tools")
async def get_mcp_service_tools(name: str):
    """获取 MCP 服务的工具列表"""
    service = mcp_registry.get_service(name)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")

    # 测试连接并获取工具列表
    result = await test_mcp_connection(service)
    if result["success"]:
        return {"tools": result["tools"]}
    else:
        return {"tools": [], "error": result["error"]}


# === Skills API ===

@app.get("/api/skills")
async def list_skills():
    """获取所有 Skills 列表"""
    skills = skill_registry.list_skills()
    return {
        "skills": [
            {
                "name": s.name,
                "description": s.description,
                "source": s.source.value,
                "version": s.version,
                "author": s.author,
                "tags": s.tags,
                "files": s.files,
                "enabled": s.enabled,
                "created_at": s.created_at,
                "updated_at": s.updated_at
            }
            for s in skills
        ]
    }


@app.get("/api/skills/{name}")
async def get_skill(name: str):
    """获取 Skill 详情"""
    skill = skill_registry.get_skill(name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill不存在")

    return {
        "name": skill.name,
        "description": skill.description,
        "source": skill.source.value,
        "skill_path": skill.skill_path,
        "version": skill.version,
        "author": skill.author,
        "tags": skill.tags,
        "files": skill.files,
        "enabled": skill.enabled,
        "created_at": skill.created_at,
        "updated_at": skill.updated_at
    }


@app.delete("/api/skills/{name}")
async def delete_skill(name: str):
    """删除 Skill（仅用户 Skill）"""
    skill = skill_registry.get_skill(name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill不存在")

    if skill.source.value == "builtin":
        raise HTTPException(status_code=403, detail="预置Skill不能删除")

    if skill_registry.unregister_skill(name):
        return {"success": True}
    else:
        raise HTTPException(status_code=500, detail="删除失败")


@app.get("/api/skills/{name}/files")
async def get_skill_files(name: str):
    """获取 Skill 文件列表"""
    skill = skill_registry.get_skill(name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill不存在")

    return {"files": skill.files}


@app.get("/api/skills/{name}/files/{filepath:path}")
async def get_skill_file_content(name: str, filepath: str):
    """获取 Skill 文件内容预览"""
    skill = skill_registry.get_skill(name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill不存在")

    content = skill_registry.get_skill_file_content(name, filepath)
    if content is None:
        raise HTTPException(status_code=404, detail="文件不存在")

    # 判断文件类型
    file_ext = Path(filepath).suffix.lower()
    file_type = "text"
    if file_ext in [".md", ".markdown"]:
        file_type = "markdown"
    elif file_ext in [".py"]:
        file_type = "python"
    elif file_ext in [".js", ".ts", ".jsx", ".tsx"]:
        file_type = "javascript"
    elif file_ext in [".json"]:
        file_type = "json"
    elif file_ext in [".yaml", ".yml"]:
        file_type = "yaml"

    return {
        "content": content,
        "file_type": file_type,
        "filepath": filepath
    }


from fastapi import UploadFile, File


@app.post("/api/skills/upload")
async def upload_skill(file: UploadFile = File(...)):
    """上传 Skill（zip包）"""
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="只支持zip文件")

    # 保存上传的文件到临时目录
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = Path(tmp_file.name)

    try:
        success, message, skill_config = skill_registry.extract_zip_and_register(tmp_path)
        if success and skill_config:
            return {
                "success": True,
                "message": message,
                "skill": {
                    "name": skill_config.name,
                    "description": skill_config.description,
                    "source": skill_config.source.value,
                    "version": skill_config.version,
                    "author": skill_config.author,
                    "tags": skill_config.tags
                }
            }
        else:
            raise HTTPException(status_code=400, detail=message)
    finally:
        # 清理临时文件
        if tmp_path.exists():
            tmp_path.unlink()


# === Model Services API ===

@app.get("/api/model-services")
async def list_model_services():
    """获取所有模型服务列表"""
    services = model_service_registry.list_services()
    return {
        "services": [
            {
                "name": s.name,
                "description": s.description,
                "provider": s.provider.value,
                "base_url": s.base_url,
                "selected_model": s.selected_model,
                "available_models": s.available_models,
                "enabled": s.enabled,
                "created_at": s.created_at,
                "updated_at": s.updated_at
            }
            for s in services
        ]
    }


@app.post("/api/model-services")
async def create_model_service(req: CreateModelServiceRequest):
    """创建模型服务"""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="服务名称不能为空")

    if model_service_registry.service_exists(req.name):
        raise HTTPException(status_code=400, detail="服务名称已存在")

    config = ModelServiceConfig(
        name=req.name.strip(),
        description=req.description,
        provider=ModelProvider(req.provider),
        base_url=req.base_url,
        api_key=req.api_key,
        selected_model=req.selected_model,
        available_models=req.available_models,
        enabled=req.enabled
    )

    if model_service_registry.create_service(config):
        return {"success": True, "name": req.name}
    else:
        raise HTTPException(status_code=500, detail="创建失败")


@app.get("/api/model-services/{name}")
async def get_model_service(name: str):
    """获取模型服务详情"""
    service = model_service_registry.get_service(name)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")

    return {
        "name": service.name,
        "description": service.description,
        "provider": service.provider.value,
        "base_url": service.base_url,
        "api_key": "***" if service.api_key else None,  # 隐藏敏感信息
        "selected_model": service.selected_model,
        "available_models": service.available_models,
        "enabled": service.enabled,
        "created_at": service.created_at,
        "updated_at": service.updated_at
    }


@app.put("/api/model-services/{name}")
async def update_model_service(name: str, req: UpdateModelServiceRequest):
    """更新模型服务配置"""
    existing = model_service_registry.get_service(name)
    if not existing:
        raise HTTPException(status_code=404, detail="服务不存在")

    config = ModelServiceConfig(
        name=name,
        description=req.description,
        provider=ModelProvider(req.provider),
        base_url=req.base_url,
        # 如果 api_key 为空，保留原有的
        api_key=req.api_key if req.api_key else existing.api_key,
        selected_model=req.selected_model,
        available_models=req.available_models,
        enabled=req.enabled
    )

    if model_service_registry.update_service(name, config):
        return {"success": True}
    else:
        raise HTTPException(status_code=500, detail="保存失败")


@app.delete("/api/model-services/{name}")
async def delete_model_service(name: str):
    """删除模型服务"""
    if model_service_registry.delete_service(name):
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="服务不存在")


@app.post("/api/model-services/test")
async def test_model_service(req: TestModelServiceRequest):
    """测试模型服务连接"""
    result = await test_model_service_connection(
        ModelProvider(req.provider),
        req.base_url,
        req.api_key
    )
    return result


@app.get("/api/model-services/default-url/{provider}")
async def get_default_url(provider: str):
    """获取供应商默认URL"""
    try:
        default_url = model_service_registry.get_default_url(ModelProvider(provider))
        return {"default_url": default_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"不支持的供应商: {provider}")


@app.get("/health")
async def health():
    return {"status": "ok"}


# === Conversations API ===

class CreateConversationRequest(BaseModel):
    """创建会话请求"""
    title: Optional[str] = None


class UpdateConversationRequest(BaseModel):
    """更新会话请求"""
    title: str


class AddMessageRequest(BaseModel):
    """添加消息请求"""
    role: str
    content: str
    thinking: Optional[str] = None
    tool_calls: Optional[List[Dict]] = None
    metrics: Optional[Dict] = None


class SaveMessagesRequest(BaseModel):
    """批量保存消息请求"""
    messages: List[Dict]


@app.get("/api/agents/{name}/conversations")
async def list_conversations(name: str):
    """获取会话列表"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    conversations = conversation_manager.list_conversations(name)
    return {
        "conversations": conversations,
        "total": len(conversations)
    }


@app.post("/api/agents/{name}/conversations")
async def create_conversation(name: str, req: CreateConversationRequest):
    """创建新会话"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    conversation = conversation_manager.create_conversation(name, req.title)
    return {
        "id": conversation.id,
        "title": conversation.title,
        "messages": conversation.messages,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at
    }


@app.get("/api/agents/{name}/conversations/{conversation_id}")
async def get_conversation(name: str, conversation_id: str):
    """获取会话详情"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    conversation = conversation_manager.get_conversation(name, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "id": conversation.id,
        "title": conversation.title,
        "messages": conversation.messages,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at
    }


@app.put("/api/agents/{name}/conversations/{conversation_id}")
async def update_conversation(name: str, conversation_id: str, req: UpdateConversationRequest):
    """更新会话（重命名）"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    conversation = conversation_manager.update_conversation(name, conversation_id, req.title)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "success": True,
        "conversation": {
            "id": conversation.id,
            "title": conversation.title,
            "updated_at": conversation.updated_at
        }
    }


@app.delete("/api/agents/{name}/conversations/{conversation_id}")
async def delete_conversation(name: str, conversation_id: str):
    """删除会话"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    if conversation_manager.delete_conversation(name, conversation_id):
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="会话不存在")


@app.post("/api/agents/{name}/conversations/{conversation_id}/messages")
async def add_conversation_message(name: str, conversation_id: str, req: AddMessageRequest):
    """添加消息到会话"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    message = conversation_manager.add_message(
        name,
        conversation_id,
        req.role,
        req.content,
        req.thinking,
        req.tool_calls,
        req.metrics
    )
    if not message:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "success": True,
        "message": message
    }


@app.post("/api/agents/{name}/conversations/{conversation_id}/save")
async def save_conversation_messages(name: str, conversation_id: str, req: SaveMessagesRequest):
    """批量保存会话消息"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    conversation = conversation_manager.save_messages(name, conversation_id, req.messages)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "success": True,
        "conversation": {
            "id": conversation.id,
            "title": conversation.title,
            "message_count": len(conversation.messages),
            "updated_at": conversation.updated_at
        }
    }


# === 日志收集 ===
from datetime import datetime

@app.post("/api/log")
async def save_log(log_data: dict):
    """保存前端日志"""
    log_file = DATA_DIR / "frontend_logs.txt"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    log_entry = f"[{timestamp}] {log_data.get('type', 'INFO')}: {log_data.get('message', '')}\n"

    if log_data.get('details'):
        log_entry += f"  Details: {log_data.get('details')}\n"
    if log_data.get('url'):
        log_entry += f"  URL: {log_data.get('url')}\n"
    if log_data.get('error'):
        log_entry += f"  Error: {log_data.get('error')}\n"

    log_entry += "\n"

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(log_entry)

    return {"success": True}


@app.post("/api/client-logs")
async def save_client_logs(log_data: dict):
    """保存客户端完整日志信息"""
    import json

    logs_dir = DATA_DIR / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"client_log_{timestamp}.json"
    log_file = logs_dir / filename

    try:
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)

        return {"success": True, "filename": filename}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================================
# 【环境管理 API - 新增】
# ============================================================================

from fastapi import UploadFile, File


class CreateEnvironmentRequest(BaseModel):
    """创建环境请求"""
    python_version: str = "3.11"


class InstallPackagesRequest(BaseModel):
    """安装包请求"""
    packages: List[str]


class ExecuteScriptRequest(BaseModel):
    """执行脚本请求"""
    skill_name: str
    script_path: str = "main.py"
    arguments: List[str] = []
    input_file_ids: List[str] = []
    timeout: int = 60


@app.post("/api/agents/{name}/environment")
async def create_environment(name: str, req: CreateEnvironmentRequest):
    """创建Agent运行环境"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    try:
        environment = await environment_manager.create_environment(
            agent_name=name,
            python_version=req.python_version
        )
        return {
            "success": True,
            "environment": {
                "environment_id": environment.environment_id,
                "agent_name": environment.agent_name,
                "status": environment.status.value,
                "python_version": environment.python_version,
                "created_at": environment.created_at
            }
        }
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents/{name}/environment")
async def get_environment(name: str):
    """获取Agent环境状态

    返回环境状态信息，支持后台任务状态查询和进度估算。
    前端应根据status字段判断：
    - creating: 环境创建中，禁用skill配置，显示进度条
    - ready: 环境就绪，可正常使用
    - error: 环境创建失败，需重试

    当状态为creating时，会返回：
    - progress: 当前进度(0-100)
    - estimated_remaining: 预估剩余时间(毫秒)
    """
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    environment = await environment_manager.get_environment_status(name)

    # 检查是否有进行中的创建任务
    task_status = await environment_creator.get_task_status(name)

    # 准备基础响应
    response = {
        "exists": False,
        "environment": None,
        "progress": None,
        "estimated_remaining": None
    }

    if not environment:
        # 如果没有环境记录，但有进行中的任务，返回creating状态
        if task_status == "running":
            response["exists"] = True
            response["environment"] = {
                "agent_name": name,
                "status": "creating",
                "environment_type": "conda",
                "python_version": "3.11",
                "packages": [],
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "error_message": None
            }
            # 计算模拟进度（由于无法获取实际开始时间，使用默认值）
            progress, remaining = _calculate_mock_progress(5)  # 假设已进行5秒
            response["progress"] = progress
            response["estimated_remaining"] = remaining
        return response

    # 如果有运行中的任务，返回creating状态（即使元数据显示其他状态）
    is_creating = task_status == "running" or environment.status == EnvironmentStatus.CREATING

    env_dict = {
        "environment_id": environment.environment_id,
        "agent_name": environment.agent_name,
        "status": environment.status.value if not is_creating else "creating",
        "environment_type": environment.environment_type.value,
        "python_version": environment.python_version,
        "packages": environment.packages,
        "installed_dependencies": environment.installed_dependencies,
        "created_at": environment.created_at,
        "updated_at": environment.updated_at,
        "error_message": environment.error_message
    }

    response["exists"] = True
    response["environment"] = env_dict

    # 如果正在创建，计算进度
    if is_creating:
        try:
            from datetime import datetime as dt
            created_at = dt.fromisoformat(environment.created_at)
            elapsed = (dt.now() - created_at).total_seconds()
            progress, remaining = _calculate_mock_progress(elapsed)
            response["progress"] = progress
            response["estimated_remaining"] = remaining
        except Exception:
            # 如果时间解析失败，使用默认值
            progress, remaining = _calculate_mock_progress(5)
            response["progress"] = progress
            response["estimated_remaining"] = remaining
    else:
        # 已完成或失败状态
        response["progress"] = 100.0 if environment.status == EnvironmentStatus.READY else None
        response["estimated_remaining"] = 0 if environment.status == EnvironmentStatus.READY else None

    return response


@app.delete("/api/agents/{name}/environment")
async def delete_environment(name: str):
    """删除Agent运行环境"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    # 取消可能进行中的创建任务
    await environment_creator.cancel(name)

    try:
        success = await environment_manager.delete_environment(name)
        return {"success": success}
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/{name}/environment/retry")
async def retry_environment_creation(name: str):
    """重试环境创建

    当环境创建失败时，可以调用此接口重新创建环境。
    清理失败的环境并启动新的创建任务。
    """
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    # 检查环境状态
    existing = await environment_manager.get_environment_status(name)

    # 如果环境已经就绪，无需重试
    if existing and existing.status == EnvironmentStatus.READY:
        return {
            "status": "ready",
            "message": "环境已就绪，无需重试"
        }

    # 如果有进行中的任务，提示等待
    if environment_creator.has_running_task(name):
        return {
            "status": "creating",
            "message": "环境创建任务正在进行中，请等待完成"
        }

    # 清理失败的环境记录
    if existing and existing.status == EnvironmentStatus.ERROR:
        try:
            await environment_manager.delete_environment(name)
            print(f"[ENV] 已清理失败的环境: {name}")
        except Exception as e:
            print(f"[ENV] 清理失败环境时出错: {e}")

    # 创建新的环境元数据（状态为creating）
    initial_env = AgentEnvironment(
        agent_name=name,
        environment_type=EnvironmentType.CONDA,
        status=EnvironmentStatus.CREATING,
        python_version="3.11"
    )
    environment_manager._save_metadata(initial_env)

    # 重新启动环境创建任务
    await environment_creator.create(name)

    return {
        "status": "retrying",
        "message": "环境重新初始化中..."
    }


@app.post("/api/agents/{name}/environment/packages")
async def install_packages(name: str, req: InstallPackagesRequest):
    """安装Python包"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    success, message = await environment_manager.install_packages(name, req.packages)
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)


@app.get("/api/agents/{name}/environment/packages")
async def list_packages(name: str):
    """列出已安装的包"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    packages = await environment_manager.list_packages(name)
    return {"packages": packages}


# ============================================================================
# 【文件管理 API - 新增】
# ============================================================================

@app.post("/api/agents/{name}/files")
async def upload_file(name: str, file: UploadFile = File(...)):
    """上传文件到Agent存储"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    try:
        content = await file.read()
        file_info = await file_storage_manager.upload_file(
            agent_name=name,
            file_content=content,
            filename=file.filename or "unknown",
            mime_type=file.content_type
        )

        return {
            "success": True,
            "file": {
                "file_id": file_info.file_id,
                "filename": file_info.filename,
                "file_size": file_info.file_size,
                "mime_type": file_info.mime_type,
                "uploaded_at": file_info.uploaded_at
            }
        }
    except FileStorageError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/agents/{name}/files")
async def list_files(name: str):
    """列出Agent的所有文件"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    files = await file_storage_manager.list_files(name)
    return {
        "files": [
            {
                "file_id": f.file_id,
                "filename": f.filename,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "uploaded_at": f.uploaded_at
            }
            for f in files
        ]
    }


@app.get("/api/agents/{name}/files/{file_id}")
async def download_file(name: str, file_id: str):
    """下载文件"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    file_info = await file_storage_manager.get_file_info(name, file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="文件不存在")

    file_path = await file_storage_manager.get_file_path(name, file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="文件不存在")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=file_info.filename,
        media_type=file_info.mime_type
    )


@app.delete("/api/agents/{name}/files/{file_id}")
async def delete_file(name: str, file_id: str):
    """删除文件"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    success = await file_storage_manager.delete_file(name, file_id)
    if success:
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="文件不存在")


# ============================================================================
# 【脚本执行 API - 新增】
# ============================================================================

@app.post("/api/agents/{name}/execute")
async def execute_script(name: str, req: ExecuteScriptRequest):
    """执行Skill脚本"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    # 获取技能路径
    skill = skill_registry.get_skill(req.skill_name)
    skill_base_path = None
    if skill and skill.skill_path:
        # skill_path 是相对路径，需要转换为绝对路径
        skill_base_path = str(SKILLS_DIR / skill.skill_path)

    try:
        record = await execution_engine.execute_script(
            agent_name=name,
            skill_name=req.skill_name,
            script_path=req.script_path,
            args=req.arguments,
            input_file_ids=req.input_file_ids,
            timeout=req.timeout,
            skill_base_path=skill_base_path
        )

        return {
            "success": record.status == ExecutionStatus.SUCCESS,
            "execution": {
                "execution_id": record.execution_id,
                "status": record.status.value,
                "exit_code": record.exit_code,
                "stdout": record.stdout,
                "stderr": record.stderr,
                "duration_ms": record.duration_ms,
                "started_at": record.started_at,
                "finished_at": record.finished_at
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents/{name}/executions")
async def list_executions(name: str, limit: int = 50):
    """列出执行记录"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    records = await execution_engine.list_executions(name, limit)
    return {
        "executions": [
            {
                "execution_id": r.execution_id,
                "skill_name": r.skill_name,
                "script_path": r.script_path,
                "status": r.status.value,
                "exit_code": r.exit_code,
                "duration_ms": r.duration_ms,
                "created_at": r.created_at,
                "finished_at": r.finished_at
            }
            for r in records
        ]
    }


@app.get("/api/agents/{name}/executions/{execution_id}")
async def get_execution(name: str, execution_id: str):
    """获取执行详情"""
    if name not in manager.list_agents():
        raise HTTPException(status_code=404, detail="Agent不存在")

    record = await execution_engine.get_execution_status(name, execution_id)
    if not record:
        raise HTTPException(status_code=404, detail="执行记录不存在")

    return {
        "execution": {
            "execution_id": record.execution_id,
            "skill_name": record.skill_name,
            "script_path": record.script_path,
            "arguments": record.arguments,
            "status": record.status.value,
            "exit_code": record.exit_code,
            "stdout": record.stdout,
            "stderr": record.stderr,
            "duration_ms": record.duration_ms,
            "created_at": record.created_at,
            "started_at": record.started_at,
            "finished_at": record.finished_at
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=20881)
