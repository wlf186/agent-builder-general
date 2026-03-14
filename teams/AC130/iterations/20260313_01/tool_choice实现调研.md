# tool_choice 实现调研报告

**日期**: 2026-03-13
**调研人**: AC130 开发工程师
**目的**: 为修复 LLM 抢答问题调研 LangChain 原生工具绑定方案

---

## 1. 当前项目版本

```bash
# requirements.txt
langgraph>=0.2.0
langchain>=0.3.0
langchain-core>=0.3.0
langchain-ollama>=0.2.0
langchain-openai>=0.2.0
```

**结论**: 项目使用的 LangChain 版本支持 `bind_tools()` 和 `tool_choice` 参数。

---

## 2. LangChain tool_choice 参数说明

### 2.1 参数值

| 值 | 行为 | 适用模型 |
|---|------|---------|
| `"auto"` (默认) | 模型自主决定是否调用工具 | 所有 |
| `"any"` | 强制模型至少调用一个工具 | 通用 |
| `"required"` | 强制模型至少调用一个工具 | OpenAI |
| `"tool_name"` | 强制调用特定工具 | 所有 |

### 2.2 核心概念

```
┌─────────────────────────────────────────────────────────────────────┐
│                    tool_choice 参数效果                             │
└─────────────────────────────────────────────────────────────────────┘

tool_choice="auto" (当前默认行为)
│
├── 用户: "100+200等于多少？"
│
├── LLM 决策: "我会算，直接回答: 300"  ← 抢答！
│
└── 结果: ❌ 没有调用 evaluate 工具


tool_choice="any" (强制调用)
│
├── 用户: "100+200等于多少？"
│
├── LLM 决策: "我必须调用工具"
│
├── 输出: tool_calls=[{"name": "evaluate", "args": {"expression": "100+200"}}]
│
└── 结果: ✅ 成功调用工具
```

---

## 3. 标准实现方式

### 3.1 基础用法

```python
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# 1. 定义工具（使用装饰器）
@tool
def evaluate(expression: str) -> str:
    """计算数学表达式"""
    try:
        result = eval(expression)
        return f"计算结果: {result}"
    except Exception as e:
        return f"错误: {e}"

@tool
def get_joke() -> str:
    """获取一个冷笑话"""
    return "为什么程序员总是混淆圣诞节和万圣节？因为 Oct 31 == Dec 25！"

# 2. 创建 LLM 并绑定工具
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 方式1: 强制至少调用一个工具
llm_forced = llm.bind_tools(
    [evaluate, get_joke],
    tool_choice="any"  # 或 "required" for OpenAI
)

# 方式2: 强制调用特定工具
llm_specific = llm.bind_tools(
    [evaluate, get_joke],
    tool_choice="evaluate"  # 必须调用 evaluate
)

# 3. 调用
response = llm_forced.invoke("计算 100+200")
# response.tool_calls 将包含工具调用信息
```

### 3.2 Pydantic 方式定义工具

```python
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

class EvaluateInput(BaseModel):
    """evaluate 工具的输入模式"""
    expression: str = Field(description="要计算的数学表达式")

# 创建结构化工具
evaluate_tool = StructuredTool.from_function(
    name="evaluate",
    description="计算数学表达式",
    func=lambda expr: str(eval(expr)),
    args_schema=EvaluateInput
)

# 绑定到 LLM
llm_with_tools = llm.bind_tools(
    [evaluate_tool],
    tool_choice="any"
)
```

---

## 4. 与当前代码的差异

### 4.1 当前实现 (文本解析方式)

```python
# src/agent_engine.py 当前实现

# 工具只是文本描述
tools_desc = "\n".join([
    f"- {mcp_tool.name}: {mcp_tool.description}"
    for mcp_tool in self.mcp_manager.all_tools
])

# 添加到系统提示词
system_prompt += f"\n\n## 可用工具\n{tools_desc}"
system_prompt += "\n调用工具时必须输出 JSON: {\"tool\": \"...\"}"

# 直接调用 LLM，无工具绑定
async for chunk in self.llm.astream(messages):
    # ... 缓冲和文本解析
    if '"tool"' in buffer_content:
        tool_calls = self._parse_tool_calls_enhanced(response)
```

**问题**:
- LLM 可以选择忽略工具使用指令
- 依赖文本正则解析，容易失败
- 无法强制工具调用

### 4.2 原生绑定方式

```python
# 建议的实现方式

# 1. 将 MCP 工具转换为 LangChain Tool 对象
langchain_tools = []
for mcp_tool in self.mcp_manager.all_tools:
    lc_tool = StructuredTool.from_function(
        name=mcp_tool.name,
        description=mcp_tool.description,
        func=lambda args, tool=mcp_tool: self._execute_mcp_tool(tool, args)
    )
    langchain_tools.append(lc_tool)

# 2. 绑定工具到 LLM，强制调用
self.llm = self.llm.bind_tools(
    langchain_tools,
    tool_choice="any"  # 强制至少调用一个工具
)

# 3. 直接从响应中获取 tool_calls（结构化）
response = await self.llm.ainvoke(messages)
tool_calls = response.tool_calls  # 原生工具调用，无需解析
```

**优势**:
- 模型原生支持，可靠性高
- 结构化响应，无需文本解析
- 可以强制工具调用

---

## 5. MCP 工具适配挑战

### 5.1 当前 MCP 工具结构

```python
# src/mcp_manager.py 中的 MCP 工具
class MCPTool:
    name: str
    description: str
    server_name: str
    # 执行通过 MCPManager.call_tool()
```

### 5.2 需要的适配

```python
# 需要创建适配器，将 MCP 工具包装为 LangChain Tool

class MCPToolAdapter:
    """将 MCP 工具适配为 LangChain Tool"""

    def __init__(self, mcp_tool: MCPTool, mcp_manager: MCPManager):
        self.mcp_tool = mcp_tool
        self.mcp_manager = mcp_manager

    def to_langchain_tool(self) -> StructuredTool:
        """转换为 LangChain StructuredTool"""

        def execute_wrapper(**kwargs):
            # 委托给 MCPManager 执行
            return asyncio.run(
                self.mcp_manager.call_tool(self.mcp_tool.name, kwargs)
            )

        return StructuredTool(
            name=self.mcp_tool.name,
            description=self.mcp_tool.description,
            func=execute_wrapper,
            # 如果 MCP 工具有 input_schema，可以在这里使用
        )
```

### 5.3 流式输出兼容性

**问题**: `bind_tools()` 后的流式输出行为可能有变化

```python
# 需要测试验证
async for chunk in llm_with_tools.astream(messages):
    # chunk 是否仍然有 content 属性？
    # tool_calls 信息如何流式传递？
    pass
```

**建议**: 先进行小规模 PoC 验证流式输出兼容性。

---

## 6. 实施建议

### 6.1 渐进式迁移路径

```
Phase 1: 工具适配器 (1-2天)
├── 创建 MCPToolAdapter 类
├── 实现到 LangChain Tool 的转换
└── 单元测试验证

Phase 2: PoC 验证 (2-3天)
├── 创建测试分支
├── 在一个测试 Agent 中集成 bind_tools
├── 验证 tool_choice="any" 效果
└── 验证流式输出兼容性

Phase 3: 正式集成 (1周)
├── 修改 AgentEngine 核心逻辑
├── 保留现有文本解析作为 fallback
└── 全面测试

Phase 4: 清理优化 (3-5天)
├── 移除旧的文本解析逻辑
├── 性能优化
└── 文档更新
```

### 6.2 代码改动范围预估

| 文件 | 改动类型 | 预估工作量 |
|------|----------|-----------|
| `src/mcp_manager.py` | 添加适配器类 | 0.5天 |
| `src/agent_engine.py` | 修改 LLM 初始化和调用逻辑 | 2天 |
| `src/skill_tool.py` | 适配为 LangChain Tool | 0.5天 |
| 测试用例 | 新增和修改 | 1天 |
| 文档 | 更新架构说明 | 0.5天 |

**总计**: 约 4.5 天

---

## 7. 风险与注意事项

### 7.1 模型兼容性

| 模型 | bind_tools 支持 | tool_choice="any" 支持 |
|------|----------------|---------------------|
| OpenAI (GPT-4) | ✅ | ✅ (用 "required") |
| ZhipuAI (GLM) | ⚠️ 需验证 | ⚠️ 需验证 |
| Ollama | ⚠️ 取决于模型 | ⚠️ 取决于模型 |
| Alibaba Bailian | ❓ 未知 | ❓ 未知 |

**建议**: 优先验证 ZhipuAI GLM 模型的兼容性（项目主要使用的模型）。

### 7.2 流式输出影响

使用 `bind_tools()` 后，LLM 的流式响应可能包含工具调用信息块，需要调整前端解析逻辑。

```python
# 可能的流式响应格式变化
# 当前: {"type": "content", "content": "{"tool": "evaluate"}"}
# bind_tools后: chunk.tool_calls 可能直接包含工具调用
```

### 7.3 向后兼容性

如果某些 MCP 工具无法适配，需要保留 fallback 机制。

---

## 8. 参考资料

### 官方文档
- [LangChain - How to force model to call tools](https://python.langchain.ac.cn/docs/how_to/tool_choice/)
- [Tool Calling with LangChain](https://blog.langchain.com/tool-calling-with-langchain/)

### 教程
- [探索LangChain工具绑定的魔力：强制LLM调用特定工具](https://blog.csdn.net/adfyvatbia/article/details/144071826)
- [Building Intelligent Agents with LangChain and LangGraph](https://mbrenndoerfer.com/writing/building-intelligent-agents-langchain-langgraph-part-1-core-concepts)

### 社区讨论
- [Reddit: Force LLM to output tool calling](https://www.reddit.com/r/LangChain/comments/1okm0x4/force_llm_to_output_tool_calling/)

---

## 9. 下一步行动

1. **等待 PM 规格说明书** - 确认最终修复方案
2. **验证 ZhipuAI 兼容性** - 测试 GLM 模型是否支持 bind_tools
3. **创建 PoC 分支** - 小规模验证技术方案可行性

---

**报告完成时间**: 2026-03-13
**状态**: 等待 Team Lead 和 PM 确认方案
