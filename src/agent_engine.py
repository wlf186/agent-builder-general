"""
Agent核心引擎 - 基于LangGraph，支持多种规划模式
"""
import os
import asyncio
import json
import re
from pathlib import Path
from typing import TypedDict, Annotated, Sequence, Optional, Dict, Any, List, TYPE_CHECKING
from operator import add

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END

from .models import AgentConfig, LLMProvider, PlanningMode, ModelProvider
from .mcp_manager import MCPManager
from .skill_registry import SkillRegistry
from .skill_loader import SkillLoader
from .skill_tool import SkillTool
from .model_service_registry import ModelServiceRegistry

if TYPE_CHECKING:
    from .execution_engine import ExecutionEngine


class AgentState(TypedDict):
    """Agent状态"""
    messages: Annotated[Sequence[BaseMessage], add]
    iterations: int
    # Plan & Solve / ReWOO 相关
    plan: Optional[List[str]]
    current_step: int
    tool_results: Optional[Dict[str, Any]]
    # Reflexion 相关
    reflection: Optional[str]
    is_satisfactory: bool
    # ToT 相关
    thoughts: Optional[List[str]]
    current_thought: Optional[str]
    evaluations: Optional[List[Dict[str, Any]]]


class AgentEngine:
    """Agent引擎 - 支持多种规划模式"""

    def __init__(
        self,
        config: AgentConfig,
        mcp_manager: Optional[MCPManager] = None,
        skill_registry: Optional[SkillRegistry] = None,
        skills_dir: Path = None,
        model_service_registry: Optional[ModelServiceRegistry] = None,
        execution_engine: Optional["ExecutionEngine"] = None
    ):
        self.config = config
        self.mcp_manager = mcp_manager
        self.skill_registry = skill_registry
        self.skills_dir = skills_dir or (Path(__file__).parent.parent / "skills")
        self.model_service_registry = model_service_registry
        self.execution_engine = execution_engine
        self.llm = None
        self.graph = None
        # 初始化 SkillTool 用于按需加载技能
        self.skill_tool: Optional[SkillTool] = None
        if skill_registry and config.skills:
            self.skill_tool = SkillTool(
                skill_registry=skill_registry,
                skills_dir=self.skills_dir,
                enabled_skills=config.skills,
                execution_engine=execution_engine,
                agent_name=config.name
            )
        self._setup_llm()

    def _setup_llm(self):
        """设置LLM - 从模型服务注册表获取配置"""
        from langchain_openai import ChatOpenAI

        # 新版：从模型服务注册表获取配置
        if self.config.model_service and self.model_service_registry:
            service = self.model_service_registry.get_service(self.config.model_service)
            if service:
                # 所有供应商都使用OpenAI兼容接口
                self.llm = ChatOpenAI(
                    model=service.selected_model,
                    base_url=service.base_url,
                    api_key=service.api_key or "not-needed",  # Ollama不需要API key
                    temperature=self.config.temperature,
                )
                return
            else:
                raise ValueError(f"模型服务 '{self.config.model_service}' 不存在")

        # 兼容旧配置（已废弃）
        if self.config.llm_provider == LLMProvider.OLLAMA:
            from langchain_ollama import ChatOllama
            self.llm = ChatOllama(
                model=self.config.llm_model or "qwen2.5:7b",
                base_url=self.config.llm_base_url or "http://localhost:11434",
                temperature=self.config.temperature,
            )
        elif self.config.llm_provider == LLMProvider.ZHIPU:
            api_key = os.environ.get("ZHIPU_API_KEY")
            if not api_key:
                raise ValueError("ZHIPU_API_KEY 环境变量未设置")
            self.llm = ChatOpenAI(
                model=self.config.llm_model or "glm-4",
                base_url="https://open.bigmodel.cn/api/coding/paas/v4",
                api_key=api_key,
                temperature=self.config.temperature,
            )
        else:
            # 默认使用Ollama
            raise ValueError("未配置模型服务，请在智能体配置中选择一个模型服务")

    def _get_system_prompt(self) -> str:
        """获取系统提示词"""
        base_prompt = self.config.persona

        # 按需加载模式：不再静态注入所有skills内容
        # 改为提供简要提示，让LLM通过load_skill工具按需加载
        if self.skill_tool and self.skill_tool.enabled_skills:
            skills_hint = f"""

## 可用技能 (Skills)

你可以使用 `load_skill` 工具按需加载以下技能的详细指导：
{chr(10).join([f"- {name}" for name in self.skill_tool.enabled_skills])}

**重要**：当处理与这些技能相关的任务时，请先调用 `load_skill` 工具加载对应的技能内容，然后按照技能指导执行任务。
"""
            base_prompt += skills_hint

        return base_prompt

    # ==================== 通用工具调用 ====================

    async def _execute_tool(self, tool_name: str, tool_args: Dict) -> str:
        """执行工具调用"""
        # 优先处理 skill 工具（按需加载）
        if tool_name == SkillTool.TOOL_NAME and self.skill_tool:
            # 支持两种参数名：skill_name（规范）和 skill（兼容）
            skill_name = tool_args.get("skill_name") or tool_args.get("skill", "")
            list_files = tool_args.get("list_files", False)
            return await self.skill_tool.execute(skill_name, list_files)

        # 处理 execute_skill 工具（脚本执行）
        if tool_name == SkillTool.EXECUTE_TOOL_NAME and self.skill_tool:
            skill_name = tool_args.get("skill_name", "")
            script_name = tool_args.get("script_name", "main.py")
            arguments = tool_args.get("arguments", [])
            input_file_ids = tool_args.get("input_file_ids", [])
            timeout = tool_args.get("timeout", 60)
            return await self.skill_tool.execute_script(
                skill_name=skill_name,
                script_name=script_name,
                arguments=arguments,
                input_file_ids=input_file_ids,
                timeout=timeout
            )

        if not self.mcp_manager:
            return "错误: MCP管理器未初始化"

        # 检查工具是否存在
        tool = self.mcp_manager.get_tool(tool_name)
        if not tool:
            available_tools = [t.name for t in self.mcp_manager.all_tools]
            print(f"[TOOL] 工具调用失败: 找不到工具 '{tool_name}'，可用工具: {available_tools}")
            return f"错误: 找不到工具 '{tool_name}'。可用工具: {available_tools}"

        try:
            import time
            timestamp = time.strftime("%H:%M:%S", time.localtime())
            print(f"[TOOL] {timestamp} 调用工具: {tool_name}, args: {tool_args}")
            result = await self.mcp_manager.call_tool(tool_name, tool_args)
            print(f"[TOOL] {timestamp} 工具返回: {result[:100]}...")
            return result
        except Exception as e:
            import traceback
            error_msg = f"工具调用异常: {str(e)}"
            print(f"[TOOL] {error_msg}\n{traceback.format_exc()}")
            return error_msg

    def _parse_tool_calls(self, response) -> List[Dict]:
        """解析工具调用"""
        tool_calls = []
        if hasattr(response, 'tool_calls') and response.tool_calls:
            tool_calls = response.tool_calls
        elif self.mcp_manager and self.mcp_manager.all_tools:
            content = response.content
            for tool in self.mcp_manager.all_tools:
                if f"[CALL:{tool.name}]" in content or f"调用工具: {tool.name}" in content:
                    tool_calls.append({
                        "name": tool.name,
                        "args": {},
                        "id": f"call_{tool.name}"
                    })
        return tool_calls

    # ==================== ReAct 模式 ====================

    async def _react_agent_node(self, state: AgentState) -> Dict[str, Any]:
        """ReAct Agent节点 - 思考并决定下一步"""
        messages = list(state["messages"])
        iterations = state.get("iterations", 0)

        if iterations == 0:
            system_prompt = self._get_system_prompt()
            if self.mcp_manager and self.mcp_manager.all_tools:
                tools_desc = "\n".join([
                    f"- {tool.name}: {tool.description}"
                    for tool in self.mcp_manager.all_tools
                ])
                system_prompt += f"\n\n你可以使用以下工具:\n{tools_desc}"
            messages = [SystemMessage(content=system_prompt)] + messages

        response = await self.llm.ainvoke(messages)
        return {"messages": [response], "iterations": iterations + 1}

    async def _react_tool_node(self, state: AgentState) -> Dict[str, Any]:
        """ReAct 工具节点"""
        messages = state["messages"]
        last_message = messages[-1]
        tool_messages = []

        tool_calls = self._parse_tool_calls(last_message)
        for tool_call in tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call.get("args", {})
            result = await self._execute_tool(tool_name, tool_args)
            tool_messages.append(
                ToolMessage(content=result, tool_call_id=tool_call.get("id", "unknown"))
            )

        return {"messages": tool_messages}

    def _react_should_continue(self, state: AgentState) -> str:
        """ReAct 判断是否继续"""
        iterations = state.get("iterations", 0)
        if iterations >= self.config.max_iterations:
            return "end"

        last_message = state["messages"][-1] if state["messages"] else None
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            return "tools"
        if isinstance(last_message, ToolMessage):
            return "agent"
        return "end"

    def _build_react_graph(self) -> StateGraph:
        """构建 ReAct 图"""
        workflow = StateGraph(AgentState)
        workflow.add_node("agent", self._react_agent_node)
        workflow.add_node("tools", self._react_tool_node)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", self._react_should_continue,
            {"tools": "tools", "agent": "agent", "end": END})
        workflow.add_edge("tools", "agent")
        return workflow

    # ==================== Reflexion 模式 ====================

    async def _reflexion_agent_node(self, state: AgentState) -> Dict[str, Any]:
        """Reflexion Agent节点"""
        messages = list(state["messages"])
        iterations = state.get("iterations", 0)

        if iterations == 0:
            system_prompt = self._get_system_prompt()
            if self.mcp_manager and self.mcp_manager.all_tools:
                tools_desc = "\n".join([
                    f"- {tool.name}: {tool.description}"
                    for tool in self.mcp_manager.all_tools
                ])
                system_prompt += f"\n\n你可以使用以下工具:\n{tools_desc}"
            messages = [SystemMessage(content=system_prompt)] + messages

        # 如果有反思结果，添加到消息中
        reflection = state.get("reflection")
        if reflection and not state.get("is_satisfactory", True):
            messages.append(SystemMessage(content=f"之前的回答需要改进。反思: {reflection}\n请根据反思改进你的回答。"))

        response = await self.llm.ainvoke(messages)
        return {"messages": [response], "iterations": iterations + 1}

    async def _reflexion_reflect_node(self, state: AgentState) -> Dict[str, Any]:
        """Reflexion 反思节点"""
        messages = state["messages"]
        last_ai_msg = None
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not hasattr(msg, 'tool_calls'):
                last_ai_msg = msg
                break

        if not last_ai_msg:
            return {"is_satisfactory": True, "reflection": None}

        # 让 LLM 评估回答质量
        reflect_prompt = f"""请评估以下回答的质量，并判断是否需要改进。

用户问题: {messages[0].content if messages else '未知'}
回答: {last_ai_msg.content}

请回答:
1. 这个回答是否完整、准确、有帮助？(是/否)
2. 如果需要改进，请说明需要改进的地方。

格式:
SATISFACTORY: 是/否
REFLECTION: 改进建议（如果需要）"""

        response = await self.llm.ainvoke([SystemMessage(content=reflect_prompt)])
        reflection_text = response.content

        is_satisfactory = "SATISFACTORY: 是" in reflection_text or "SATISFACTORY:是" in reflection_text
        reflection = reflection_text.split("REFLECTION:")[-1].strip() if "REFLECTION:" in reflection_text else None

        return {"is_satisfactory": is_satisfactory, "reflection": reflection}

    def _reflexion_should_continue(self, state: AgentState) -> str:
        """Reflexion 判断是否继续"""
        iterations = state.get("iterations", 0)
        if iterations >= self.config.max_iterations:
            return "end"

        last_message = state["messages"][-1] if state["messages"] else None

        # 如果有工具调用，执行工具
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            return "tools"

        # 如果是工具消息，继续思考
        if isinstance(last_message, ToolMessage):
            return "agent"

        # 如果是 AI 消息且没有工具调用，进入反思
        if isinstance(last_message, AIMessage):
            return "reflect"

        return "end"

    def _reflexion_after_reflect(self, state: AgentState) -> str:
        """反思后判断"""
        if state.get("is_satisfactory", True):
            return "end"
        iterations = state.get("iterations", 0)
        if iterations >= self.config.max_iterations:
            return "end"
        return "agent"

    def _build_reflexion_graph(self) -> StateGraph:
        """构建 Reflexion 图"""
        workflow = StateGraph(AgentState)
        workflow.add_node("agent", self._reflexion_agent_node)
        workflow.add_node("tools", self._react_tool_node)
        workflow.add_node("reflect", self._reflexion_reflect_node)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", self._reflexion_should_continue,
            {"tools": "tools", "reflect": "reflect", "end": END})
        workflow.add_edge("tools", "agent")
        workflow.add_conditional_edges("reflect", self._reflexion_after_reflect,
            {"agent": "agent", "end": END})
        return workflow

    # ==================== Plan & Solve 模式 ====================

    async def _plan_and_solve_planner_node(self, state: AgentState) -> Dict[str, Any]:
        """Plan & Solve 规划节点"""
        user_input = state["messages"][-1].content if state["messages"] else ""

        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        planner_prompt = f"""{self._get_system_prompt()}

你是一个任务规划专家。请为用户的请求制定一个详细的执行计划。

用户请求: {user_input}
{tools_desc}

请制定一个清晰的步骤计划，每步一行，格式如下:
1. [步骤描述]
2. [步骤描述]
...

只输出计划步骤，不要其他内容。"""

        response = await self.llm.ainvoke([SystemMessage(content=planner_prompt)])
        plan_text = response.content

        # 解析计划
        plan = []
        for line in plan_text.strip().split('\n'):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-') or line.startswith('*')):
                # 移除序号
                step = line.lstrip('0123456789.-* ').strip()
                if step:
                    plan.append(step)

        return {"plan": plan, "current_step": 0, "messages": [AIMessage(content=f"执行计划:\n" + "\n".join(f"{i+1}. {s}" for i, s in enumerate(plan)))]}

    async def _plan_and_solve_executor_node(self, state: AgentState) -> Dict[str, Any]:
        """Plan & Solve 执行节点"""
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        messages = list(state["messages"])

        if current_step >= len(plan):
            return {"iterations": state.get("iterations", 0) + 1}

        step = plan[current_step]
        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        executor_prompt = f"""{self._get_system_prompt()}

当前执行计划:
{chr(10).join(f"{i+1}. {s}" for i, s in enumerate(plan))}

现在执行步骤 {current_step + 1}: {step}

{tools_desc}

请执行这个步骤。如果需要使用工具，请调用工具。完成后给出这个步骤的执行结果。"""

        response = await self.llm.ainvoke([SystemMessage(content=executor_prompt)])

        # 执行可能的工具调用
        tool_calls = self._parse_tool_calls(response)
        tool_results = []
        for tool_call in tool_calls:
            result = await self._execute_tool(tool_call["name"], tool_call.get("args", {}))
            tool_results.append(f"工具 {tool_call['name']} 结果: {result}")

        if tool_results:
            # 将工具结果反馈给 LLM
            follow_up = await self.llm.ainvoke([
                SystemMessage(content=executor_prompt),
                response,
                SystemMessage(content=f"工具执行结果:\n{chr(10).join(tool_results)}\n\n请总结这个步骤的执行结果。")
            ])
            return {
                "messages": [response, follow_up],
                "current_step": current_step + 1,
                "iterations": state.get("iterations", 0) + 1
            }

        return {
            "messages": [response],
            "current_step": current_step + 1,
            "iterations": state.get("iterations", 0) + 1
        }

    def _plan_and_solve_should_continue(self, state: AgentState) -> str:
        """Plan & Solve 判断是否继续"""
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        iterations = state.get("iterations", 0)

        if iterations >= self.config.max_iterations:
            return "end"
        if current_step >= len(plan):
            return "end"
        return "execute"

    def _build_plan_and_solve_graph(self) -> StateGraph:
        """构建 Plan & Solve 图"""
        workflow = StateGraph(AgentState)
        workflow.add_node("planner", self._plan_and_solve_planner_node)
        workflow.add_node("execute", self._plan_and_solve_executor_node)
        workflow.set_entry_point("planner")
        workflow.add_edge("planner", "execute")
        workflow.add_conditional_edges("execute", self._plan_and_solve_should_continue,
            {"execute": "execute", "end": END})
        return workflow

    # ==================== ReWOO 模式 ====================

    async def _rewOO_planner_node(self, state: AgentState) -> Dict[str, Any]:
        """ReWOO 规划节点 - 一次性规划所有工具调用"""
        user_input = state["messages"][-1].content if state["messages"] else ""

        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        planner_prompt = f"""{self._get_system_prompt()}

你是一个任务规划专家。请为用户的请求制定一个工具调用计划。

用户请求: {user_input}
{tools_desc}

请列出所有需要调用的工具，格式如下:
TOOL: 工具名
ARGS: {{"参数名": "参数值"}}
---
TOOL: 工具名
ARGS: {{"参数名": "参数值"}}

如果没有工具可用或不需要工具，直接回答问题。"""

        response = await self.llm.ainvoke([SystemMessage(content=planner_prompt)])
        plan_text = response.content

        # 解析工具调用计划
        tool_calls = []
        current_tool = None
        for line in plan_text.split('\n'):
            line = line.strip()
            if line.startswith('TOOL:'):
                if current_tool:
                    tool_calls.append(current_tool)
                current_tool = {"name": line[5:].strip(), "args": {}}
            elif line.startswith('ARGS:') and current_tool:
                import json
                try:
                    current_tool["args"] = json.loads(line[5:].strip())
                except:
                    current_tool["args"] = {}

        if current_tool:
            tool_calls.append(current_tool)

        return {"tool_results": {}, "messages": [AIMessage(content=f"工具调用计划:\n{plan_text}")]}

    async def _rewOO_worker_node(self, state: AgentState) -> Dict[str, Any]:
        """ReWOO 工作节点 - 并行执行所有工具"""
        user_input = state["messages"][-1].content if state["messages"] else ""

        # 重新获取工具调用计划
        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        planner_prompt = f"""{self._get_system_prompt()}

用户请求: {user_input}
{tools_desc}

请列出所有需要调用的工具，格式如下:
TOOL: 工具名
ARGS: {{"参数名": "参数值"}}
---
TOOL: 工具名
ARGS: {{"参数名": "参数值"}}

如果没有工具可用或不需要工具，直接回答问题。"""

        response = await self.llm.ainvoke([SystemMessage(content=planner_prompt)])
        plan_text = response.content

        # 解析并执行工具调用
        tool_results = {}
        current_tool = None
        for line in plan_text.split('\n'):
            line = line.strip()
            if line.startswith('TOOL:'):
                if current_tool:
                    tool_name = current_tool["name"]
                    result = await self._execute_tool(tool_name, current_tool.get("args", {}))
                    tool_results[tool_name] = result
                current_tool = {"name": line[5:].strip(), "args": {}}
            elif line.startswith('ARGS:') and current_tool:
                import json
                try:
                    current_tool["args"] = json.loads(line[5:].strip())
                except:
                    current_tool["args"] = {}

        if current_tool:
            tool_name = current_tool["name"]
            result = await self._execute_tool(tool_name, current_tool.get("args", {}))
            tool_results[tool_name] = result

        return {"tool_results": tool_results, "iterations": state.get("iterations", 0) + 1}

    async def _rewOO_synthesizer_node(self, state: AgentState) -> Dict[str, Any]:
        """ReWOO 综合节点 - 整合所有结果"""
        user_input = state["messages"][-1].content if state["messages"] else ""
        tool_results = state.get("tool_results", {})

        results_text = "\n".join([f"{k}: {v}" for k, v in tool_results.items()]) if tool_results else "无工具调用结果"

        synthesizer_prompt = f"""{self._get_system_prompt()}

用户请求: {user_input}

工具执行结果:
{results_text}

请根据以上工具执行结果，给用户一个完整的回答。"""

        response = await self.llm.ainvoke([SystemMessage(content=synthesizer_prompt)])
        return {"messages": [response]}

    def _build_rewOO_graph(self) -> StateGraph:
        """构建 ReWOO 图"""
        workflow = StateGraph(AgentState)
        workflow.add_node("worker", self._rewOO_worker_node)
        workflow.add_node("synthesizer", self._rewOO_synthesizer_node)
        workflow.set_entry_point("worker")
        workflow.add_edge("worker", "synthesizer")
        workflow.add_edge("synthesizer", END)
        return workflow

    # ==================== ToT 模式 ====================

    async def _tot_generator_node(self, state: AgentState) -> Dict[str, Any]:
        """ToT 生成节点 - 生成多个思考分支"""
        user_input = state["messages"][-1].content if state["messages"] else ""
        current_thought = state.get("current_thought", "")
        iterations = state.get("iterations", 0)

        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        if current_thought:
            prompt = f"""{self._get_system_prompt()}

用户请求: {user_input}
{tools_desc}

当前思考路径: {current_thought}

请基于当前思考，生成2-3个可能的下一步思考方向。每个方向一行，格式:
THOUGHT: [思考内容]
"""
        else:
            prompt = f"""{self._get_system_prompt()}

用户请求: {user_input}
{tools_desc}

请生成2-3个不同的初始思考方向来解决这个问题。每个方向一行，格式:
THOUGHT: [思考内容]
"""

        response = await self.llm.ainvoke([SystemMessage(content=prompt)])

        # 解析思考
        thoughts = []
        for line in response.content.split('\n'):
            if 'THOUGHT:' in line:
                thought = line.split('THOUGHT:')[-1].strip()
                if thought:
                    thoughts.append(thought)

        if not thoughts:
            thoughts = [response.content]

        return {"thoughts": thoughts, "iterations": iterations + 1}

    async def _tot_evaluator_node(self, state: AgentState) -> Dict[str, Any]:
        """ToT 评估节点 - 评估并选择最佳思考"""
        user_input = state["messages"][-1].content if state["messages"] else ""
        thoughts = state.get("thoughts", [])
        evaluations = state.get("evaluations", [])

        # 评估每个思考
        thoughts_text = "\n".join([f"{i+1}. {t}" for i, t in enumerate(thoughts)])

        eval_prompt = f"""请评估以下思考方向，选择最有可能解决问题的一个。

用户请求: {user_input}

思考方向:
{thoughts_text}

请给出:
1. 每个思考的评分(1-10)
2. 最佳思考的编号

格式:
SCORES: [分数1, 分数2, ...]
BEST: 编号"""

        response = await self.llm.ainvoke([SystemMessage(content=eval_prompt)])

        # 解析评估结果
        best_idx = 0
        scores = []

        import re
        scores_match = re.search(r'SCORES:\s*\[([\d,\s]+)\]', response.content)
        if scores_match:
            scores = [int(s.strip()) for s in scores_match.group(1).split(',')]

        best_match = re.search(r'BEST:\s*(\d+)', response.content)
        if best_match:
            best_idx = int(best_match.group(1)) - 1
            best_idx = max(0, min(best_idx, len(thoughts) - 1))

        selected_thought = thoughts[best_idx] if thoughts else ""
        current_thought = state.get("current_thought", "")
        new_thought = f"{current_thought} → {selected_thought}" if current_thought else selected_thought

        new_evaluations = list(evaluations) + [{"thought": selected_thought, "score": scores[best_idx] if scores else 5}]

        return {
            "current_thought": new_thought,
            "evaluations": new_evaluations,
            "iterations": state.get("iterations", 0)
        }

    async def _tot_answer_node(self, state: AgentState) -> Dict[str, Any]:
        """ToT 回答节点 - 基于选定的思考路径给出最终答案"""
        user_input = state["messages"][-1].content if state["messages"] else ""
        thought_path = state.get("current_thought", "")
        evaluations = state.get("evaluations", [])

        tools_desc = ""
        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_desc = "\n可用工具:\n" + "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.mcp_manager.all_tools
            ])

        answer_prompt = f"""{self._get_system_prompt()}

用户请求: {user_input}

思考路径: {thought_path}
{tools_desc}

请基于以上思考路径，给出最终答案。如果需要使用工具，请调用工具。"""

        response = await self.llm.ainvoke([SystemMessage(content=answer_prompt)])

        # 执行可能的工具调用
        tool_calls = self._parse_tool_calls(response)
        tool_results = []
        for tool_call in tool_calls:
            result = await self._execute_tool(tool_call["name"], tool_call.get("args", {}))
            tool_results.append(f"工具 {tool_call['name']} 结果: {result}")

        if tool_results:
            follow_up = await self.llm.ainvoke([
                SystemMessage(content=answer_prompt),
                response,
                SystemMessage(content=f"工具执行结果:\n{chr(10).join(tool_results)}\n\n请给出最终答案。")
            ])
            return {"messages": [follow_up]}

        return {"messages": [response]}

    def _tot_should_continue(self, state: AgentState) -> str:
        """ToT 判断是否继续探索"""
        iterations = state.get("iterations", 0)
        evaluations = state.get("evaluations", [])

        if iterations >= self.config.max_iterations:
            return "answer"

        # 如果已经探索了足够多，给出答案
        if len(evaluations) >= 3:
            return "answer"

        return "generate"

    def _build_tot_graph(self) -> StateGraph:
        """构建 ToT 图"""
        workflow = StateGraph(AgentState)
        workflow.add_node("generate", self._tot_generator_node)
        workflow.add_node("evaluate", self._tot_evaluator_node)
        workflow.add_node("answer", self._tot_answer_node)
        workflow.set_entry_point("generate")
        workflow.add_edge("generate", "evaluate")
        workflow.add_conditional_edges("evaluate", self._tot_should_continue,
            {"generate": "generate", "answer": "answer"})
        workflow.add_edge("answer", END)
        return workflow

    # ==================== 构建图 ====================

    def build_graph(self):
        """构建工作流图"""
        if self.config.planning_mode == PlanningMode.REACT:
            workflow = self._build_react_graph()
        elif self.config.planning_mode == PlanningMode.REFLEXION:
            workflow = self._build_reflexion_graph()
        elif self.config.planning_mode == PlanningMode.PLAN_AND_SOLVE:
            workflow = self._build_plan_and_solve_graph()
        elif self.config.planning_mode == PlanningMode.REWOO:
            workflow = self._build_rewOO_graph()
        elif self.config.planning_mode == PlanningMode.TOT:
            workflow = self._build_tot_graph()
        else:
            workflow = self._build_react_graph()

        self.graph = workflow.compile()

    async def run(self, user_input: str, history: List[Dict] = None) -> str:
        """运行Agent"""
        if not self.graph:
            self.build_graph()

        messages = []
        if history:
            for msg in history:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg.get("content", "")))

        messages.append(HumanMessage(content=user_input))

        initial_state = {
            "messages": messages,
            "iterations": 0,
            "plan": None,
            "current_step": 0,
            "tool_results": None,
            "reflection": None,
            "is_satisfactory": True,
            "thoughts": None,
            "current_thought": None,
            "evaluations": None
        }

        final_state = await self.graph.ainvoke(initial_state)

        result_messages = final_state["messages"]
        for msg in reversed(result_messages):
            if isinstance(msg, AIMessage):
                return msg.content

        return "抱歉，我无法处理这个请求。"

    # ============================================================================
    # 【流式输出核心代码 - 谨慎修改】
    #
    # 此方法实现了 Agent 的流式输出功能，包括：
    # - 智能缓冲策略（50字符阈值）
    # - 工具调用检测与处理
    # - 多种事件类型（thinking/content/tool_call/tool_result/metrics）
    #
    # ⚠️ 修改此方法可能影响：
    # 1. 打字机效果的流畅性
    # 2. 工具调用的正确检测
    # 3. 思考过程的实时更新
    # 4. 前端渲染效果
    #
    # 相关文件：
    # - backend.py: chat_stream() - SSE 端点
    # - frontend/src/components/AgentChat.tsx - 前端渲染
    # - frontend/src/app/stream/agents/[name]/chat/route.ts - 流式代理
    # ============================================================================
    async def stream(self, user_input: str, history: List[Dict] = None, file_context: str = ""):
        """流式运行Agent - 支持返回 thinking、多轮工具调用和最终回答

        【流式输出核心方法 - 谨慎修改】
        此方法通过 yield 返回事件字典，由 backend.py 的 chat_stream() 端点
        转换为 SSE 格式发送到前端。

        事件类型：
        - thinking: 思考过程（实时更新）
        - content: 最终回答内容（逐字符流式输出）
        - tool_call: 工具调用开始
        - tool_result: 工具执行结果
        - skill_loading/skill_loaded: 技能加载状态
        - metrics: 性能指标

        Args:
            user_input: 用户输入
            history: 对话历史
            file_context: 文件上下文信息（包含用户上传文件的元数据）
        """
        # 构建系统提示
        system_prompt = self._get_system_prompt()

        # 如果有文件上下文，添加到系统提示词
        if file_context:
            system_prompt += file_context
            system_prompt += "\n\n请优先处理用户上传的文件内容。"

        # 构建工具描述
        tools_desc = ""
        tool_names = []

        if self.mcp_manager and self.mcp_manager.all_tools:
            tools_list = []
            for mcp_tool in self.mcp_manager.all_tools:
                tools_list.append(f"- {mcp_tool.name}: {mcp_tool.description}")
                tool_names.append(mcp_tool.name)

            tools_desc = "\n".join(tools_list)

        # 添加 skill 工具（如果有启用的技能）
        if self.skill_tool and self.skill_tool.enabled_skills:
            skill_tool_def = self.skill_tool.get_tool_definition()
            tools_desc += f"\n- {skill_tool_def['name']}: {skill_tool_def['description'].split(chr(10))[0]}"
            tool_names.append(SkillTool.TOOL_NAME)


            # 添加 execute_skill 工具（如果有执行引擎且存在可执行技能）
            execute_tool_def = self.skill_tool.get_execute_tool_definition()
            if execute_tool_def:
                tools_desc += f"\n- {execute_tool_def['name']}: {execute_tool_def['description'].split(chr(10))[0]}"
                tool_names.append(SkillTool.EXECUTE_TOOL_NAME)

            # 构建技能加载规则和示例
            skills_list = ", ".join([f'"{name}"' for name in self.skill_tool.enabled_skills[:3]])
            skill_example = f'{{"tool": "load_skill", "arguments": {{"skill_name": "{self.skill_tool.enabled_skills[0]}"}}}}'

            # 添加工具使用提示 - 支持多任务规划
            system_prompt += f"""

## 🔴 强制规则：必须使用工具
**重要：你没有任何内置计算能力！** 所有计算、获取笑话、加载技能等操作，**必须**通过调用工具完成。

- ❌ 禁止：自己计算数学表达式
- ✅ 必须：调用 evaluate 工具计算任何数学表达式
- ❌ 禁止：自己编造笑话
- ✅ 必须：调用 get_joke 工具获取笑话
- ❌ 禁止：在没有加载技能的情况下编造技能内容
- ✅ 必须：当处理 PDF、DOCX 等相关任务时，先调用 load_skill 工具加载技能

如果你不调用工具直接给出结果，你的回答将是无效的！

## 可用工具
{tools_desc}

## 工具调用格式
调用工具时，**必须**严格按照以下 JSON 格式输出（不要输出其他内容）：
```json
{{"tool": "工具名", "arguments": {{}}}}
```

### 示例1：计算数学表达式
用户：计算 100+200*3
助手：{{"tool": "evaluate", "arguments": {{"expression": "100+200*3"}}}}

### 示例2：获取冷笑话
用户：讲个冷笑话
助手：{{"tool": "get_joke", "arguments": {{}}}}

### 示例3：加载技能（重要！）
用户：如何处理 PDF 文件？
助手：{{"tool": "load_skill", "arguments": {{"skill_name": "{self.skill_tool.enabled_skills[0] if self.skill_tool.enabled_skills else "技能名"}"}}}}

### 示例4： 执行技能脚本（处理上传文件！）
用户：读取这个 PDF 文件的内容
助手：{{"tool": "execute_skill", "arguments": {{"skill_name": "AB-pdf", "input_file_ids": ["文件ID"], "arguments": ["./input/document.pdf"]}}}}

**可用技能**: {skills_list}
当用户询问与这些技能相关的问题时，**必须先调用 load_skill 工具加载对应技能**！

**处理上传文件**:
- 用户上传的文件会自动分配 file_id
- 使用 execute_skill 工具时，将 file_id 传入 input_file_ids 参数
- 茂本将在 ./input/ 目录中，通过 ./input/文件名 访问

## 多任务处理规则
如果用户的请求包含多个独立任务（如"计算X，然后讲个笑话"），你需要：
1. **分析任务**：识别所有子任务
2. **调用工具**：按顺序调用每个任务所需的工具
   - 对于计算任务：优先使用 `evaluate` 工具，它可以计算复杂表达式
   - 对于技能相关任务：先使用 `load_skill` 工具加载技能
   - 对于其他任务：使用对应的工具
3. **每次只调用一个工具**，等待结果后再调用下一个
4. **汇总输出**：所有工具调用完成后，使用 Markdown 格式分段展示结果

## 最终输出格式
使用 Markdown 格式，结构如下：
```
# 标题1
结果内容（可以使用 **加粗**、> 引用等格式）

# 标题2
结果内容
```

**重要示例**：
如果用户问："如何处理 PDF 文件？"
1. 先调用 load_skill 工具加载 PDF 技能
2. 根据技能内容给出专业回答

**规则**：
1. 如果用户请求与任何工具功能相关，必须先调用工具
2. 优先使用 `evaluate` 工具处理所有数学计算
3. 处理 PDF、DOCX 等相关任务时，**必须先调用 load_skill 加载技能**
4. 每次只输出一个工具调用 JSON，等待工具返回结果
5. 收到结果后，判断是否需要调用更多工具
6. 所有工具调用完成后，使用 Markdown 格式（# 标题、**加粗**等）分段回答
7. 不要编造答案，始终基于工具返回的结果回答
"""

        messages = [SystemMessage(content=system_prompt)]

        if history:
            for msg in history:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg.get("content", "")))

        messages.append(HumanMessage(content=user_input))

        full_response = ""
        all_tool_calls_info = []
        iteration = 0
        max_iterations = 10  # 防止无限循环

        # 1. 输出思考过程的开始
        yield {"type": "thinking", "content": "正在分析您的问题..."}

        # 多轮工具调用循环
        while iteration < max_iterations:
            iteration += 1
            tool_calls_info = []

            # ============================================================
            # 【流式输出核心 - 智能缓冲策略】
            #
            # 挑战：需要同时满足两个目标
            # 1. 流式输出：让用户尽快看到响应，实现打字机效果
            # 2. 工具检测：需要完整接收工具调用 JSON 才能正确解析
            #
            # 解决方案：智能缓冲策略
            # - 缓冲前 50 个字符（BUFFER_THRESHOLD）
            # - 如果检测到工具调用特征（{"tool": ...），继续缓冲直到完整 JSON
            # - 如果超过阈值且无工具调用特征，立即开始流式输出
            #
            # ⚠️ 修改 BUFFER_THRESHOLD 或缓冲逻辑可能影响：
            # - 首 token 时延（阈值太大会增加延迟）
            # - 工具调用检测准确性（阈值太小可能截断工具 JSON）
            # ============================================================
            response_content = ""
            might_be_tool_call = False
            content_started = False
            buffer_content = ""  # 缓冲区：暂存待确认的内容
            buffering = False    # 是否处于缓冲模式
            BUFFER_THRESHOLD = 50  # 【关键参数】缓冲阈值，平衡检测与响应性
            started_streaming = False  # 是否已开始流式输出

            # 更新 thinking 为等待状态
            if iteration == 1:
                yield {"type": "thinking", "content": "✓ 分析用户请求\n✓ 正在生成回答..."}
            else:
                yield {"type": "thinking", "content": f"✓ 第 {iteration} 轮处理\n✓ 分析是否需要更多工具调用..."}

            async for chunk in self.llm.astream(messages):
                if chunk.content:
                    response_content += chunk.content

                    # 检查是否可能是工具调用
                    if not content_started:
                        content_started = True
                        stripped = response_content.strip()
                        if stripped.startswith('{') or stripped.startswith('```json'):
                            might_be_tool_call = True
                            buffering = True
                            yield {"type": "thinking", "content": "✓ 分析用户请求\n✓ 检测到工具调用..."}
                        else:
                            # 不以 { 开头，先缓冲一小段来确认
                            buffering = True
                            buffer_content += chunk.content
                    elif buffering and not started_streaming:
                        # 还在缓冲模式，累积内容
                        buffer_content += chunk.content

                        # 检查缓冲内容是否包含工具调用 JSON
                        if '"tool"' in buffer_content and '{' in buffer_content:
                            might_be_tool_call = True

                        # 【流式输出核心】如果缓冲区超过阈值且没有检测到工具调用，开始流式输出
                        if len(buffer_content) > BUFFER_THRESHOLD and not might_be_tool_call:
                            started_streaming = True
                            # 【关键】逐字符输出缓冲内容，实现打字机效果
                            # 前端 AgentChat.tsx 使用 flushSync 确保每次 yield 都能立即渲染
                            for char in buffer_content:
                                yield {"type": "content", "content": char}
                            buffer_content = ""
                    elif started_streaming:
                        # 【流式输出核心】已经开始流式输出，直接输出新内容
                        # 这里的 chunk.content 是 LLM 返回的增量内容，直接透传给前端
                        yield {"type": "content", "content": chunk.content}
                    elif buffering and might_be_tool_call:
                        # 检测到工具调用，继续缓冲
                        buffer_content += chunk.content

            # 如果在缓冲模式，检查是否有工具调用
            if buffering and not started_streaming:
                # 检查缓冲内容是否包含工具调用
                if '"tool"' in buffer_content:
                    might_be_tool_call = True

            # 3. 检查是否有工具调用（始终检查完整内容，因为某些模型可能在开头输出换行符）
            tool_calls = []

            # 始终尝试解析工具调用，不依赖 might_be_tool_call 标志
            # 因为某些模型（如 GLM-4.5-Air）可能在 JSON 前输出换行符或思考文本
            class MockResponse:
                def __init__(self, content):
                    self.content = content
                    self.tool_calls = []

            mock_response = MockResponse(response_content)
            tool_calls = self._parse_tool_calls_enhanced(mock_response)

            # 4. 根据是否有工具调用，处理输出
            if tool_calls:
                # 有工具调用：显示决策过程
                thinking_steps = [
                    "✓ 分析用户请求",
                    f"✓ 匹配到可用工具: {', '.join([tc['name'] for tc in tool_calls])}",
                    "✓ 准备调用工具..."
                ]
                yield {"type": "thinking", "content": "\n".join(thinking_steps)}

                # 执行工具调用
                for tool_call in tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call.get("args", {})

                    # 获取工具的服务名
                    service_name = ""
                    if self.mcp_manager:
                        tool = self.mcp_manager.get_tool(tool_name)
                        if tool:
                            service_name = tool.server_name

                    # 检查是否是 skill 工具
                    is_skill_tool = tool_name == SkillTool.TOOL_NAME

                    # 生成唯一标识符（用于区分同名工具的多次调用）
                    import uuid
                    call_id = str(uuid.uuid4())[:8]

                    # 输出工具调用信息（包含服务名和唯一ID）
                    yield {
                        "type": "tool_call",
                        "name": tool_name,
                        "call_id": call_id,
                        "service": service_name if service_name else "skill-system" if is_skill_tool else "",
                        "args": tool_args
                    }

                    # 如果是 skill 工具，发送 skill_loading 事件
                    if is_skill_tool:
                        skill_name = tool_args.get("skill_name") or tool_args.get("skill", "")
                        yield {
                            "type": "skill_loading",
                            "skill_name": skill_name
                        }

                    # 执行工具
                    result = await self._execute_tool(tool_name, tool_args)

                    # 如果是 skill 工具，发送 skill_loaded 事件
                    if is_skill_tool:
                        skill_name = tool_args.get("skill_name") or tool_args.get("skill", "")
                        yield {
                            "type": "skill_loaded",
                            "skill_name": skill_name,
                            "success": not result.startswith("Error:")
                        }

                    # 输出工具结果（包含唯一ID用于匹配）
                    yield {
                        "type": "tool_result",
                        "name": tool_name,
                        "call_id": call_id,
                        "service": service_name if service_name else "skill-system" if is_skill_tool else "",
                        "result": result
                    }

                    tool_calls_info.append({
                        "name": tool_name,
                        "call_id": call_id,
                        "args": tool_args,
                        "result": result
                    })

                all_tool_calls_info.extend(tool_calls_info)

                # 5. 将工具结果添加到消息中，继续下一轮（可能需要更多工具调用）
                tool_results_text = "\n".join([
                    f"工具 {tc['name']} 的结果: {tc['result']}"
                    for tc in tool_calls_info
                ])

                # 构建继续提示
                continue_prompt = f"""工具执行结果:
{tool_results_text}

请判断：
1. 如果用户的原始请求还有未完成的任务，请继续调用所需的工具
2. 如果所有任务都已完成，请使用 Markdown 格式汇总所有结果，分段展示给用户

原始用户请求: {user_input}"""

                messages.append(AIMessage(content=response_content))
                messages.append(HumanMessage(content=continue_prompt))

                # 继续下一轮循环，让 LLM 决定是否需要更多工具调用
            else:
                # 没有工具调用，这一轮是最终回答
                if started_streaming:
                    # 内容已经流式输出，不需要再处理
                    full_response = response_content
                elif buffering and buffer_content:
                    # 还在缓冲模式（内容较短，未触发阈值），现在输出缓冲的内容
                    yield {"type": "thinking", "content": "✓ 分析用户请求\n✓ 无需调用工具，直接回答"}
                    for char in buffer_content:
                        full_response += char
                        yield {"type": "content", "content": char}
                elif might_be_tool_call and response_content:
                    # 检测到可能的工具调用但解析失败，输出原始内容
                    yield {"type": "thinking", "content": "✓ 分析用户请求\n✓ 生成回答"}
                    for char in response_content:
                        full_response += char
                        yield {"type": "content", "content": char}
                elif response_content and not full_response:
                    # 其他情况，确保输出响应内容
                    for char in response_content:
                        full_response += char
                        yield {"type": "content", "content": char}

                # 退出循环
                break

        # 如果有多轮工具调用，确保最终有汇总输出
        if all_tool_calls_info and not full_response:
            yield {"type": "thinking", "content": "✓ 所有工具调用完成\n✓ 生成汇总结果..."}

    def _parse_tool_calls_enhanced(self, response) -> List[Dict]:
        """增强版工具调用解析 - 支持多种格式"""
        tool_calls = []

        # 1. 检查 LLM 原生的 tool_calls
        if hasattr(response, 'tool_calls') and response.tool_calls:
            return response.tool_calls

        content = response.content or ""

        # 1.5 先移除 markdown 代码块标记和前后空白
        content_cleaned = content
        # 移除 ```json 和 ``` 标记
        content_cleaned = re.sub(r'```json\s*', '', content_cleaned)
        content_cleaned = re.sub(r'```\s*', '', content_cleaned)
        content_cleaned = content_cleaned.strip()

        # 2. 解析新 JSON 格式 {"tool": "name", "arguments": {...}}
        # 尝试直接解析清理后的内容
        try:
            # 检查是否包含工具调用 JSON（不要求必须在开头）
            if '"tool"' in content_cleaned and '{' in content_cleaned:
                # 找到第一个 JSON 对象
                start = content_cleaned.find('{')
                if start != -1:
                    # 尝试找到匹配的结束括号
                    brace_count = 0
                    end = start
                    for i, char in enumerate(content_cleaned[start:], start):
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end = i + 1
                                break

                    if end > start:
                        json_str = content_cleaned[start:end]
                        parsed = json.loads(json_str)
                        if parsed.get("tool"):
                            tool_calls.append({
                                "name": parsed["tool"],
                                "args": parsed.get("arguments", {}),
                                "id": f"call_{parsed['tool']}"
                            })
                            return tool_calls
        except json.JSONDecodeError:
            pass

        # 3. 使用正则匹配
        json_pattern = r'\{[^{}]*"tool"\s*:\s*"([^"]+)"[^{}]*\}'
        json_matches = re.findall(json_pattern, content)
        for tool_name in json_matches:
            # 尝试解析完整的 JSON 获取 arguments
            try:
                # 找到完整的 JSON 对象
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = content[start:end]
                    # 清理可能的 markdown 标记
                    json_str = re.sub(r'```json\s*', '', json_str)
                    json_str = re.sub(r'```\s*', '', json_str)
                    parsed = json.loads(json_str)
                    if parsed.get("tool"):
                        tool_calls.append({
                            "name": parsed["tool"],
                            "args": parsed.get("arguments", {}),
                            "id": f"call_{parsed['tool']}"
                        })
            except:
                # 如果完整解析失败，只使用工具名
                tool_calls.append({"name": tool_name, "args": {}, "id": f"call_{tool_name}"})

        # 3. 解析 XML 格式的工具调用
        if not tool_calls:
            xml_pattern = r'<tool_call\s+name=["\']([^"\']+)["\']\s*>([^<]*)</tool_call\s*>'
            matches = re.findall(xml_pattern, content, re.IGNORECASE)
            for name, args_str in matches:
                try:
                    args = json.loads(args_str.strip()) if args_str.strip() else {}
                except:
                    args = {}
                tool_calls.append({"name": name, "args": args, "id": f"call_{name}"})

        # 4. 解析 [CALL:tool_name] 格式
        if not tool_calls and self.mcp_manager and self.mcp_manager.all_tools:
            call_pattern = r'\[CALL:(\w+)\]'
            call_matches = re.findall(call_pattern, content)
            for name in call_matches:
                tool_calls.append({"name": name, "args": {}, "id": f"call_{name}"})

            # 5. 检查 "调用工具: xxx" 格式
            for tool in self.mcp_manager.all_tools:
                if f"调用工具: {tool.name}" in content or f"调用 {tool.name}" in content:
                    if not any(tc["name"] == tool.name for tc in tool_calls):
                        tool_calls.append({"name": tool.name, "args": {}, "id": f"call_{tool.name}"})

        return tool_calls
