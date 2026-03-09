"""
MCP工具管理器
"""
import asyncio
import json
from typing import Dict, List, Any, Optional
from contextlib import AsyncExitStack

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    from mcp.client.sse import sse_client
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from .models import MCPConfig, MCPServiceConfig, MCPConnectionType, MCPAuthType


class MCPTool:
    """MCP工具封装"""
    def __init__(self, name: str, description: str, input_schema: Dict,
                 server_name: str, session: 'MCPServerConnection'):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.server_name = server_name
        self.session = session

    def to_langchain_tool(self) -> Dict[str, Any]:
        """转换为LangChain工具格式"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema
            }
        }


class MCPServerConnection:
    """MCP服务器连接（stdio模式）"""
    def __init__(self, config: MCPConfig):
        self.config = config
        self.session: Optional[ClientSession] = None
        self.tools: List[MCPTool] = []
        self._exit_stack = AsyncExitStack()
        self._connected = False

    async def connect(self) -> bool:
        """连接到MCP服务器"""
        if not MCP_AVAILABLE:
            print("MCP库未安装，跳过连接")
            return False

        try:
            server_params = StdioServerParameters(
                command=self.config.command,
                args=self.config.args,
                env=self.config.env if self.config.env else None
            )

            read, write = await self._exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            self.session = await self._exit_stack.enter_async_context(
                ClientSession(read, write)
            )

            # 初始化会话
            await self.session.initialize()

            # 获取工具列表
            tools_result = await self.session.list_tools()
            self.tools = [
                MCPTool(
                    name=tool.name,
                    description=tool.description or "",
                    input_schema=tool.inputSchema or {},
                    server_name=self.config.name,
                    session=self
                )
                for tool in tools_result.tools
            ]

            self._connected = True
            return True
        except Exception as e:
            print(f"连接MCP服务器 {self.config.name} 失败: {e}")
            return False

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """调用工具"""
        if not self.session:
            return "错误: 未连接到MCP服务器"

        try:
            result = await self.session.call_tool(tool_name, arguments)
            if result.content:
                return "\n".join([
                    content.text if hasattr(content, 'text') else str(content)
                    for content in result.content
                ])
            return "工具执行成功，无返回内容"
        except Exception as e:
            return f"工具调用失败: {str(e)}"

    async def disconnect(self):
        """断开连接"""
        await self._exit_stack.aclose()
        self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected


class SSEServerConnection:
    """MCP服务器连接（SSE模式）- 支持标准 MCP SSE 协议和本地 REST API"""

    def __init__(self, config: MCPServiceConfig):
        self.config = config
        self.tools: List[MCPTool] = []
        self._connected = False
        # MCP SSE 客户端相关
        self._session: Optional[ClientSession] = None
        self._exit_stack = AsyncExitStack()
        self._read_stream = None
        self._write_stream = None
        # 本地 REST API 模式
        self._is_local_rest = False
        self._base_url = None

    def _is_local_service(self) -> bool:
        """检测是否是本地 REST API 服务"""
        return "localhost:20882" in self.config.url

    def _get_headers(self) -> Dict[str, str]:
        """构建请求头"""
        headers = {}
        headers.update(self.config.headers)

        # 添加认证
        if self.config.auth_type == MCPAuthType.BEARER and self.config.auth_value:
            headers["Authorization"] = f"Bearer {self.config.auth_value}"
        elif self.config.auth_type == MCPAuthType.APIKEY and self.config.auth_value:
            headers["X-API-Key"] = self.config.auth_value

        return headers

    async def connect(self) -> bool:
        """连接到MCP服务器（支持标准 MCP SSE 和本地 REST API）"""
        if not self.config.url:
            print("SSE模式需要配置URL")
            return False

        # 检测是否是本地 REST API 服务
        if self._is_local_service():
            return await self._connect_local_rest()

        return await self._connect_mcp_sse()

    async def _connect_local_rest(self) -> bool:
        """连接到本地 REST API 服务"""
        import httpx

        self._is_local_rest = True
        # 从 URL 提取基础 URL 和服务路径
        # 例如: http://localhost:20882/calculator -> base_url=http://localhost:20882, service_path=/calculator
        url = self.config.url
        if "/calculator" in url:
            self._base_url = url.replace("/calculator", "")
            service_path = "/calculator"
        elif "/cold-jokes" in url:
            self._base_url = url.replace("/cold-jokes", "")
            service_path = "/cold-jokes"
        else:
            self._base_url = url.rsplit("/", 1)[0] if "/" in url else url
            service_path = ""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self._base_url}{service_path}/tools/list",
                    json={}
                )
                response.raise_for_status()
                data = response.json()

                # 解析工具列表
                for tool_data in data.get("tools", []):
                    self.tools.append(MCPTool(
                        name=tool_data["name"],
                        description=tool_data.get("description", ""),
                        input_schema=tool_data.get("inputSchema", {}),
                        server_name=self.config.name,
                        session=self
                    ))

                self._connected = True
                print(f"✓ 本地 REST 服务连接成功: {self.config.name} ({len(self.tools)} 工具)")
                return True

        except Exception as e:
            print(f"连接本地 REST 服务失败: {e}")
            return False

    async def _connect_mcp_sse(self) -> bool:
        """连接到标准 MCP SSE 服务"""
        if not MCP_AVAILABLE:
            print("MCP库未安装，无法使用SSE连接")
            return False

        try:
            headers = self._get_headers()

            # 使用标准 MCP SSE 客户端
            sse_context = sse_client(
                self.config.url,
                headers=headers if headers else None,
                timeout=30,
                sse_read_timeout=300  # 5分钟超时
            )

            # 进入 SSE 客户端上下文
            self._read_stream, self._write_stream = await self._exit_stack.enter_async_context(
                sse_context
            )

            # 创建 MCP 会话
            self._session = await self._exit_stack.enter_async_context(
                ClientSession(self._read_stream, self._write_stream)
            )

            # 初始化会话
            await self._session.initialize()

            # 获取工具列表
            tools_result = await self._session.list_tools()
            self.tools = [
                MCPTool(
                    name=tool.name,
                    description=tool.description or "",
                    input_schema=tool.inputSchema or {},
                    server_name=self.config.name,
                    session=self
                )
                for tool in tools_result.tools
            ]

            self._connected = True
            print(f"✓ SSE MCP 服务连接成功: {self.config.name} ({len(self.tools)} 工具)")
            return True
        except Exception as e:
            print(f"连接SSE MCP服务器 {self.config.name} 失败: {e}")
            return False

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """调用工具（支持本地 REST API 和远程 MCP SSE）"""
        # 本地 REST API 模式
        if self._is_local_rest:
            return await self._call_tool_local_rest(tool_name, arguments)

        # 远程 MCP SSE 模式
        return await self._call_tool_mcp_sse(tool_name, arguments)

    async def _call_tool_local_rest(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """调用本地 REST API 工具"""
        import httpx

        if not self._connected:
            if not await self.connect():
                return "错误: 无法建立连接"

        try:
            print(f"[LocalREST] 调用工具 {tool_name}, 参数: {arguments}")

            # 确定服务端点路径
            service_path = ""
            if "calculator" in self.config.url:
                service_path = "/calculator"
            elif "cold-jokes" in self.config.url:
                service_path = "/cold-jokes"

            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    f"{self._base_url}{service_path}/tools/call",
                    json={"name": tool_name, "arguments": arguments}
                )
                response.raise_for_status()
                data = response.json()

                # 解析返回内容 - 支持两种格式
                # 格式1: {"result": "..."}
                # 格式2: {"content": [{"type": "text", "text": "..."}]}
                if "result" in data:
                    result = data["result"]
                elif "content" in data:
                    # 提取所有文本内容
                    texts = []
                    for item in data["content"]:
                        if isinstance(item, dict) and item.get("type") == "text":
                            texts.append(item.get("text", ""))
                        elif isinstance(item, str):
                            texts.append(item)
                    result = "\n".join(texts)
                else:
                    result = str(data)

                print(f"[LocalREST] 工具返回成功: {result[:100]}..." if len(result) > 100 else f"[LocalREST] 工具返回成功: {result}")
                return result

        except Exception as e:
            print(f"[LocalREST] 工具调用失败: {e}")
            return f"工具调用失败: {str(e)}"

    async def _call_tool_mcp_sse(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """调用远程 MCP SSE 工具（支持自动重连、重试和超时）"""
        max_retries = 2

        for attempt in range(max_retries + 1):
            if not self._session:
                # 没有连接，先建立连接
                if not await self.connect():
                    if attempt < max_retries:
                        print(f"[SSE] 连接失败，重试 {attempt + 1}/{max_retries}...")
                        await asyncio.sleep(1)
                        continue
                    return "错误: 无法建立连接"

            async def _do_call():
                print(f"[SSE] 调用工具 {tool_name}, 参数: {arguments}")
                result = await self._session.call_tool(tool_name, arguments)
                print(f"[SSE] 工具返回 isError: {getattr(result, 'isError', None)}")

                if result.isError:
                    error_content = "\n".join([
                        content.text if hasattr(content, 'text') else str(content)
                        for content in result.content
                    ]) if result.content else "未知错误"
                    print(f"[SSE] 工具返回错误: {error_content}")
                    raise Exception(error_content)

                if result.content:
                    content = "\n".join([
                        content.text if hasattr(content, 'text') else str(content)
                        for content in result.content
                    ])
                    print(f"[SSE] 工具返回成功: {content[:100]}...")
                    return content
                return "工具执行成功，无返回内容"

            try:
                # 添加 60 秒超时
                return await asyncio.wait_for(_do_call(), timeout=60)
            except asyncio.TimeoutError:
                print(f"[SSE] 工具调用超时")
                await self.disconnect()
                if attempt < max_retries:
                    print(f"[SSE] 超时，重试 {attempt + 1}/{max_retries}...")
                    await asyncio.sleep(1)
                    continue
                return "工具调用失败: 超时，请稍后重试"
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__
                print(f"[SSE] 工具调用失败 ({error_type}): {error_msg}")

                # 断开连接
                await self.disconnect()

                if attempt < max_retries:
                    print(f"[SSE] 失败，重试 {attempt + 1}/{max_retries}...")
                    await asyncio.sleep(1)
                    continue
                return f"工具调用失败: {error_msg}"

        return "工具调用失败: 重试次数用尽"

    async def disconnect(self):
        """断开连接"""
        if self._is_local_rest:
            # 本地 REST API 不需要保持连接
            self._connected = False
            return

        try:
            await self._exit_stack.aclose()
        except Exception as e:
            print(f"断开 SSE 连接时出错: {e}")
        finally:
            self._session = None
            self._read_stream = None
            self._write_stream = None
            self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected


class MCPManager:
    """MCP管理器 - 支持stdio和SSE两种连接方式"""

    # 类型别名，用于存储不同类型的连接
    ConnectionType = 'MCPServerConnection | SSEServerConnection'

    def __init__(self):
        self.servers: Dict[str, MCPManager.ConnectionType] = {}
        self.all_tools: List[MCPTool] = []

    async def add_server(self, config: MCPConfig) -> bool:
        """添加MCP服务器（stdio模式，兼容旧API）"""
        if config.name in self.servers:
            print(f"MCP服务器 {config.name} 已存在")
            return False

        connection = MCPServerConnection(config)
        if await connection.connect():
            self.servers[config.name] = connection
            self.all_tools.extend(connection.tools)
            return True
        return False

    async def add_service(self, config: MCPServiceConfig) -> bool:
        """添加MCP服务（支持stdio和SSE两种模式）"""
        if config.name in self.servers:
            print(f"MCP服务 {config.name} 已存在")
            return False

        try:
            if config.connection_type == MCPConnectionType.SSE:
                connection = SSEServerConnection(config)
            else:
                # stdio 模式：将 MCPServiceConfig 转换为 MCPConfig
                if not config.command:
                    print(f"MCP服务 {config.name} 缺少command配置")
                    return False
                mcp_config = MCPConfig(
                    name=config.name,
                    command=config.command,
                    args=config.args,
                    env=config.env
                )
                connection = MCPServerConnection(mcp_config)

            if await connection.connect():
                self.servers[config.name] = connection
                self.all_tools.extend(connection.tools)
                return True
            return False
        except Exception as e:
            print(f"添加MCP服务 {config.name} 失败: {e}")
            return False

    async def remove_server(self, name: str):
        """移除MCP服务器"""
        if name in self.servers:
            server = self.servers[name]
            await server.disconnect()
            self.all_tools = [t for t in self.all_tools if t.server_name != name]
            del self.servers[name]

    def get_tool(self, name: str) -> Optional[MCPTool]:
        """获取工具"""
        for tool in self.all_tools:
            if tool.name == name:
                return tool
        return None

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """调用工具"""
        tool = self.get_tool(tool_name)
        if tool:
            return await tool.session.call_tool(tool_name, arguments)
        return f"错误: 找不到工具 {tool_name}"

    def get_langchain_tools(self) -> List[Dict[str, Any]]:
        """获取所有工具的LangChain格式"""
        return [tool.to_langchain_tool() for tool in self.all_tools]

    def get_server_status(self, name: str) -> Dict[str, Any]:
        """获取服务器连接状态"""
        if name not in self.servers:
            return {"connected": False, "tools": []}

        server = self.servers[name]
        return {
            "connected": server.is_connected,
            "tools": [tool.name for tool in server.tools]
        }

    async def shutdown(self):
        """关闭所有连接"""
        for name in list(self.servers.keys()):
            await self.remove_server(name)


async def test_mcp_connection(config: MCPServiceConfig) -> Dict[str, Any]:
    """测试MCP服务连接（独立函数，用于API调用）"""
    result = {
        "success": False,
        "tools": [],
        "error": None
    }

    try:
        if config.connection_type == MCPConnectionType.SSE:
            connection = SSEServerConnection(config)
        else:
            if not config.command:
                result["error"] = "stdio模式需要配置command"
                return result
            mcp_config = MCPConfig(
                name=config.name,
                command=config.command,
                args=config.args,
                env=config.env
            )
            connection = MCPServerConnection(mcp_config)

        if await connection.connect():
            result["success"] = True
            result["tools"] = [
                {
                    "name": tool.name,
                    "description": tool.description
                }
                for tool in connection.tools
            ]
            await connection.disconnect()
        else:
            result["error"] = "连接失败"
    except Exception as e:
        result["error"] = str(e)

    return result
