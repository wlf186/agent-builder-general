"""
Agent管理器 - 管理多个Agent实例
"""
import json
import asyncio
from pathlib import Path
from typing import Dict, Optional, List, TYPE_CHECKING, Any
from datetime import datetime

from .models import AgentConfig, MCPConfig
from .agent_engine import AgentEngine
from .mcp_manager import MCPManager
from .mcp_registry import MCPServiceRegistry
from .skill_registry import SkillRegistry
from .model_service_registry import ModelServiceRegistry

if TYPE_CHECKING:
    from .execution_engine import ExecutionEngine


class AgentInstance:
    """Agent实例"""
    def __init__(
        self,
        config: AgentConfig,
        mcp_registry: MCPServiceRegistry = None,
        skill_registry: SkillRegistry = None,
        skills_dir: Path = None,
        model_service_registry: ModelServiceRegistry = None,
        execution_engine: Optional["ExecutionEngine"] = None,
        agent_manager: Optional["AgentManager"] = None,  # 【AC130-202603142210】
        kb_manager: Optional[Any] = None,  # 【AC130-202603161542】知识库管理器
        embedder: Optional[Any] = None      # 【AC130-202603161542】向量化器
    ):
        self.config = config
        self.mcp_registry = mcp_registry
        self.skill_registry = skill_registry
        self.skills_dir = skills_dir
        self.model_service_registry = model_service_registry
        self.execution_engine = execution_engine
        self.agent_manager = agent_manager  # 【AC130-202603142210】用于子Agent调用
        self.kb_manager = kb_manager        # 【AC130-202603161542】知识库管理器
        self.embedder = embedder            # 【AC130-202603161542】向量化器
        self.mcp_manager: Optional[MCPManager] = None
        self.engine: Optional[AgentEngine] = None
        self.created_at = datetime.now()
        self.conversation_history: List[Dict] = []

    async def initialize(self) -> bool:
        """初始化Agent"""
        try:
            # 初始化MCP管理器
            if self.config.mcp_servers or self.config.mcp_services:
                self.mcp_manager = MCPManager()

                # 加载旧的 mcp_servers 配置
                if self.config.mcp_servers:
                    for server_config in self.config.mcp_servers:
                        mcp_config = MCPConfig(**server_config)
                        await self.mcp_manager.add_server(mcp_config)

                # 从 MCP 注册表加载 mcp_services
                if self.config.mcp_services and self.mcp_registry:
                    for service_name in self.config.mcp_services:
                        service_config = self.mcp_registry.get_service(service_name)
                        if service_config:
                            # 根据连接类型添加服务
                            success = await self.mcp_manager.add_service(service_config)
                            if success:
                                print(f"已加载 MCP 服务: {service_name}, 可用工具: {[t.name for t in self.mcp_manager.all_tools]}")
                            else:
                                print(f"警告: MCP 服务 {service_name} 连接失败")
                        else:
                            print(f"警告: MCP 服务 {service_name} 不存在")

            # 初始化引擎
            self.engine = AgentEngine(
                self.config,
                self.mcp_manager,
                self.skill_registry,
                self.skills_dir,
                self.model_service_registry,
                execution_engine=self.execution_engine,
                agent_manager=self.agent_manager,  # 【AC130-202603142210】
                kb_manager=self.kb_manager,       # 【AC130-202603161542】
                embedder=self.embedder            # 【AC130-202603161542】
            )
            self.engine.build_graph()

            return True
        except Exception as e:
            print(f"初始化Agent失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    async def _ensure_mcp_connections(self):
        """确保 MCP 连接有效，如果连接断开则重新连接

        【AC130-202603141800 TC-002 修复】
        添加实际的连接状态检查和自动重连机制
        """
        if not self.mcp_manager:
            return

        for name, server in self.mcp_manager.servers.items():
            # 检查 SSE 连接是否还有效
            if hasattr(server, '_session'):
                # ========================================
                # 【TC-002 修复】实际连接状态检查
                # ========================================
                # 检查 session 是否为 None 或连接标志是否为 False
                is_valid = (
                    server._session is not None and
                    server.is_connected
                )

                if not is_valid:
                    print(f"[MCP] 服务 {name} 连接已断开，尝试重新连接...")
                    try:
                        # 先清理旧连接
                        await server.disconnect()
                        # 尝试重新连接
                        success = await server.connect()
                        if success:
                            print(f"[MCP] 服务 {name} 重新连接成功 ({len(server.tools)} 工具)")
                        else:
                            print(f"[MCP] 服务 {name} 重新连接失败")
                    except Exception as e:
                        print(f"[MCP] 服务 {name} 重新连接异常: {e}")

    async def chat(self, message: str, history: List[Dict] = None) -> str:
        """对话"""
        if not self.engine:
            await self.initialize()

        # 确保 MCP 连接有效
        await self._ensure_mcp_connections()

        # 使用传入的历史或本地历史，根据 short_term_memory 截取
        chat_history = history if history is not None else []
        memory_limit = self.config.short_term_memory

        # 截取最近 N 轮对话（每轮包含 user 和 assistant）
        if memory_limit > 0 and len(chat_history) > memory_limit * 2:
            chat_history = chat_history[-(memory_limit * 2):]

        response = await self.engine.run(message, chat_history)

        # 记录对话历史
        self.conversation_history.append({
            "role": "user",
            "content": message,
            "timestamp": datetime.now().isoformat()
        })
        self.conversation_history.append({
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now().isoformat()
        })

        return response

    async def chat_stream(self, message: str, history: List[Dict] = None, file_context: str = "", trace_id: str = None):
        """流式对话 - 返回包含 thinking、tool_call、tool_result、content 的事件

        Args:
            message: 用户消息
            history: 对话历史
            file_context: 文件上下文信息（包含用户上传文件的元数据）
            trace_id: 追踪 ID（用于日志关联）
        """
        if not self.engine:
            await self.initialize()

        # 确保 MCP 连接有效
        await self._ensure_mcp_connections()

        # 使用传入的历史或本地历史，根据 short_term_memory 截取
        chat_history = history if history is not None else []
        memory_limit = self.config.short_term_memory

        # 截取最近 N 轮对话（每轮包含 user 和 assistant）
        if memory_limit > 0 and len(chat_history) > memory_limit * 2:
            chat_history = chat_history[-(memory_limit * 2):]

        full_response = ""
        async for event in self.engine.stream(message, chat_history, file_context, trace_id):
            # event 是一个字典，包含 type 和其他字段
            if isinstance(event, dict):
                if event.get("type") == "content":
                    full_response += event.get("content", "")
                yield event
            else:
                # 兼容旧格式（纯字符串）
                full_response += event
                yield {"type": "content", "content": event}

        # 记录对话历史
        self.conversation_history.append({
            "role": "user",
            "content": message,
            "timestamp": datetime.now().isoformat()
        })
        self.conversation_history.append({
            "role": "assistant",
            "content": full_response,
            "timestamp": datetime.now().isoformat()
        })

    async def shutdown(self):
        """关闭Agent"""
        if self.mcp_manager:
            await self.mcp_manager.shutdown()


class AgentManager:
    """Agent管理器"""
    def __init__(
        self,
        data_dir: Path,
        mcp_registry=None,
        skill_registry=None,
        skills_dir=None,
        model_service_registry=None,
        execution_engine=None,
        kb_manager=None,  # 【AC130-202603161542】知识库管理器
        embedder=None     # 【AC130-202603170949】向量化器
    ):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.mcp_registry = mcp_registry
        self.skill_registry = skill_registry
        self.skills_dir = skills_dir or (Path(__file__).parent.parent / "skills")
        self.model_service_registry = model_service_registry
        self.execution_engine = execution_engine
        self.kb_manager = kb_manager  # 【AC130-202603161542】
        self.embedder = embedder      # 【AC130-202603170949】
        self.agents: Dict[str, AgentInstance] = {}
        self.configs: Dict[str, AgentConfig] = {}
        self._load_configs()

    def _load_configs(self):
        """加载已保存的配置"""
        config_file = self.data_dir / "agent_configs.json"
        if config_file.exists():
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    configs_data = json.load(f)
                    for name, config in configs_data.items():
                        self.configs[name] = AgentConfig(**config)
            except Exception as e:
                print(f"加载配置失败: {e}")

    def _save_configs(self):
        """保存配置"""
        config_file = self.data_dir / "agent_configs.json"
        try:
            configs_data = {
                name: config.model_dump()
                for name, config in self.configs.items()
            }
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(configs_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存配置失败: {e}")

    def create_agent_config(self, config: AgentConfig) -> bool:
        """创建Agent配置"""
        if config.name in self.configs:
            return False
        self.configs[config.name] = config
        self._save_configs()
        return True

    def update_agent_config(self, name: str, config: AgentConfig) -> bool:
        """更新Agent配置"""
        if name not in self.configs:
            return False
        self.configs[name] = config
        self._save_configs()

        # 清除缓存的实例，下次获取时会使用新配置创建
        if name in self.agents:
            # 异步关闭旧实例（同步方法中只能创建任务）
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 如果事件循环正在运行，创建任务
                    asyncio.create_task(self.agents[name].shutdown())
                else:
                    # 否则直接运行
                    loop.run_until_complete(self.agents[name].shutdown())
            except Exception as e:
                print(f"[WARN] 关闭旧实例失败: {e}")
            del self.agents[name]

        return True

    def delete_agent_config(self, name: str) -> bool:
        """删除Agent配置"""
        if name not in self.configs:
            return False
        del self.configs[name]
        self._save_configs()
        return True

    def list_agents(self) -> List[str]:
        """列出所有Agent"""
        return list(self.configs.keys())

    def get_config(self, name: str) -> Optional[AgentConfig]:
        """获取配置"""
        return self.configs.get(name)

    async def get_instance(self, name: str, force_new: bool = False) -> Optional[AgentInstance]:
        """获取或创建Agent实例

        Args:
            name: Agent 名称
            force_new: 是否强制创建新实例（用于 SSE 连接等需要重新连接的场景）
        """
        # 对于使用 SSE MCP 服务的 Agent，每次都重新创建实例以确保连接有效
        config = self.configs.get(name)
        if not config:
            return None

        # 如果配置了 MCP 服务（通常是 SSE），强制创建新实例
        has_sse_services = config.mcp_services and len(config.mcp_services) > 0

        if has_sse_services or force_new:
            # 关闭旧实例
            if name in self.agents:
                old_instance = self.agents[name]
                await old_instance.shutdown()
                del self.agents[name]

            # 创建新实例
            instance = AgentInstance(
                config,
                self.mcp_registry,
                self.skill_registry,
                self.skills_dir,
                self.model_service_registry,
                execution_engine=self.execution_engine,
                agent_manager=self,        # 【AC130-202603142210】
                kb_manager=self.kb_manager,  # 【AC130-202603161542】
                embedder=self.embedder       # 【AC130-202603170949】
            )
            if await instance.initialize():
                self.agents[name] = instance
                return instance
            return None

        # 没有 SSE 服务的 Agent 可以复用缓存
        if name in self.agents:
            return self.agents[name]

        instance = AgentInstance(
            config,
            self.mcp_registry,
            self.skill_registry,
            self.skills_dir,
            self.model_service_registry,
            execution_engine=self.execution_engine,
            kb_manager=self.kb_manager,  # 【AC130-202603161542】
            embedder=self.embedder       # 【AC130-202603170949】
        )
        if await instance.initialize():
            self.agents[name] = instance
            return instance

        return None

    async def shutdown_all(self):
        """关闭所有Agent"""
        for instance in self.agents.values():
            await instance.shutdown()
        self.agents.clear()
