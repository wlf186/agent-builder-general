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

from src.models import AgentConfig, LLMProvider, PlanningMode, MCPServiceConfig, MCPConnectionType, MCPAuthType, ModelServiceConfig, ModelProvider
from src.agent_manager import AgentManager
from src.mcp_registry import MCPServiceRegistry
from src.mcp_manager import test_mcp_connection
from src.builtin_services import setup_builtin_services, BuiltinServiceManager, shutdown_builtin_services
from src.skill_registry import SkillRegistry
from src.skill_loader import SkillLoader
from src.model_service_registry import ModelServiceRegistry
from src.model_provider_tester import test_model_service_connection
from src.conversation_manager import ConversationManager


# 初始化
DATA_DIR = Path(__file__).parent / "data"
SKILLS_DIR = Path(__file__).parent / "skills"
mcp_registry = MCPServiceRegistry(DATA_DIR)
skill_registry = SkillRegistry(DATA_DIR, SKILLS_DIR)
model_service_registry = ModelServiceRegistry(DATA_DIR)
conversation_manager = ConversationManager(DATA_DIR)
manager = AgentManager(DATA_DIR, mcp_registry, skill_registry, model_service_registry=model_service_registry)

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
    """创建新 Agent"""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Agent名称不能为空")

    if req.name in manager.list_agents():
        raise HTTPException(status_code=400, detail="Agent名称已存在")

    config = AgentConfig(
        name=req.name.strip(),
        persona=req.description or "你是一个有帮助的AI助手。"
    )

    if manager.create_agent_config(config):
        return {"success": True, "name": req.name}
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

        try:
            async for event in instance.chat_stream(req.message, req.history):
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=20881)
