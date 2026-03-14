# MCP 工具未被正确调用 - 根因分析

## 执行摘要

**问题**: test3 智能体配置了 calculator/cold-jokes/coingecko 三个 MCP 服务，但在实际对话中 LLM 直接回答问题而不调用工具。

**根因**: `_get_tool_choice_param()` 方法对 ZhipuAI 模型返回 `None`（auto 模式），导致 LLM 自主决定是否调用工具。

**影响**: 所有使用 ZhipuAI 模型的智能体。

---

## 一、技术分析

### 1.1 工具调用流程

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. AgentInstance.initialize()                                       │
│    └─ 创建独立的 MCPManager                                         │
│    └─ 连接配置中的 mcp_services                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MCPManager.add_service()                                         │
│    └─ 连接每个 MCP 服务                                              │
│    └─ 收集工具到 all_tools 列表                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. AgentEngine._bind_tools_to_llm()                                 │
│    └─ 调用 MCPToolAdapter.convert_all_tools()                        │
│    └─ 调用 llm.bind_tools(tools, tool_choice=?)                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. 用户发送消息 → AgentEngine.chat_stream()                          │
│    └─ 使用 llm_with_tools.astream(messages)                         │
│    └─ LLM 根据 tool_choice 决定是否调用工具                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 tool_choice 参数行为

| tool_choice | LLM 行为 | 适用场景 |
|-------------|----------|----------|
| None ("auto") | LLM 自主判断是否需要工具 | 通用对话 |
| "any" | 强制至少调用一个工具 | 需要工具的任务 |
| "required" | 强制至少调用一个工具 (OpenAI) | 需要工具的任务 |
| {"name": "tool"} | 强制调用特定工具 | 特定任务 |

### 1.3 当前代码逻辑

```python
def _get_tool_choice_param(self) -> Optional[str]:
    # 默认策略是 AUTO
    if self._tool_call_strategy == ToolCallStrategy.AUTO:
        return None  # ← 关键问题点

    # OpenAI 使用 "required"
    if 'openai.com' in base_url:
        return ToolCallStrategy.REQUIRED

    # 其他模型使用 "any"
    return ToolCallStrategy.ANY
```

**问题**:
1. 默认 `self._tool_call_strategy = ToolCallStrategy.AUTO`
2. 对于 ZhipuAI 模型，直接返回 `None`
3. LLM 在 auto 模式下可能选择不调用工具

---

## 二、LLM 行为分析

### 2.1 ZhipuAI (glm-4.7) 在 auto 模式下的行为

当用户发送简单问题时，LLM 的决策过程：

| 用户输入 | LLM 判断 | 实际行为 | 期望行为 |
|----------|----------|----------|----------|
| "2138/2394+23是多少" | 简单计算，我也能做 | 直接回答 | 调用 calculator |
| "讲一个冷笑话" | 我知道很多笑话 | 直接生成 | 调用 cold-jokes |
| "BTC价格" | 训练数据里有 | 直接估算 | 调用 coingecko |

### 2.2 为什么 LLM 会"抢答"？

1. **指令遵循**: LLM 被训练为直接回答用户问题
2. **能力自信**: 简单问题在 LLM 能力范围内
3. **无强制约束**: tool_choice=None 时，调用工具是可选的
4. **系统提示词不足**: `_get_system_prompt()` 只返回 persona，没有明确的工具调用规则

---

## 三、验证测试

### 3.1 工具绑定验证

```bash
# 检查绑定日志
[DEBUG] 绑定 60 个 MCP 工具
[DEBUG] LLM 已绑定 60 个工具，tool_choice=auto  # ← 问题点
```

**分析**: 工具已正确绑定，但 tool_choice=auto

### 3.2 LLM 调用验证

```python
# 实际调用
llm_with_tools = self.llm.bind_tools(tools)  # tool_choice 默认为 None
```

等价于：
```python
llm_with_tools = self.llm.bind_tools(tools, tool_choice=None)
```

### 3.3 原生工具调用检测

```python
# 第1292-1302行
if self.llm_with_tools:
    full_response = await llm_to_use.ainvoke(messages)
    if hasattr(full_response, 'tool_calls') and full_response.tool_calls:
        # 原生工具调用，转换为统一格式
        tool_calls = self._convert_native_tool_calls(full_response.tool_calls)
```

**分析**:
- 代码正确检测原生工具调用
- 但在 auto 模式下，`full_response.tool_calls` 为空
- 导致 fallback 到文本解析模式

---

## 四、代码位置索引

| 文件 | 行号 | 代码块 | 说明 |
|------|------|--------|------|
| `src/agent_engine.py` | 209-231 | `_get_tool_choice_param()` | **根因位置** |
| `src/agent_engine.py` | 150-207 | `_bind_tools_to_llm()` | 工具绑定入口 |
| `src/agent_engine.py` | 28-34 | `ToolCallStrategy` | 策略定义 |
| `src/agent_engine.py` | 1291-1302 | 原生工具调用检测 | 工具调用处理 |
| `src/agent_engine.py` | 286-304 | `_get_system_prompt()` | 系统提示词生成 |

---

## 五、修复方案对比

### 方案 A: 修改默认策略

```python
# 在 __init__ 中
self._tool_call_strategy = ToolCallStrategy.ANY  # 改为 ANY
```

**优点**:
- 简单直接
- 所有模型统一行为

**缺点**:
- 影响所有智能体
- 可能破坏现有行为

### 方案 B: 按模型类型设置

```python
def _get_tool_choice_param(self) -> Optional[str]:
    if self._tool_call_strategy != ToolCallStrategy.AUTO:
        # ... 现有逻辑 ...

    # 新增：ZhipuAI 使用 "any"
    base_url = getattr(self.llm, 'base_url', '') or ''
    model_name = getattr(self.llm, 'model_name', '') or ''
    if 'bigmodel.cn' in base_url or model_name.startswith('glm-'):
        return ToolCallStrategy.ANY

    return None
```

**优点**:
- 针对性修复
- 不影响其他模型

**缺点**:
- 需要维护模型类型列表

### 方案 C: 配置化策略

```python
# 在 AgentConfig 中添加
tool_call_strategy: Optional[str] = "auto"  # "auto", "any", "required"

# 在 _get_tool_choice_param 中
if self.config.tool_call_strategy:
    return self.config.tool_call_strategy
# ... fallback 逻辑 ...
```

**优点**:
- 灵活性最高
- 用户可配置

**缺点**:
- 需要修改配置结构
- 复杂度增加

### 方案 D: 增强系统提示词

```python
def _get_system_prompt(self) -> str:
    base_prompt = self.config.persona

    # 新增：工具调用规则
    if self.mcp_manager and self.mcp_manager.all_tools:
        tool_names = [t.name for t in self.mcp_manager.all_tools]
        tool_instruction = f"""
## 重要：工具调用规则

你有以下可用工具: {', '.join(tool_names[:5])} 等

**必须调用工具的场景**:
- 数学计算问题 → 使用 calculator 工具
- 笑话/幽默请求 → 使用 cold-jokes 工具
- 加密货币查询 → 使用 coingecko 工具

禁止直接回答需要工具的问题，必须调用工具获取准确结果。
"""
        base_prompt += tool_instruction

    # ... 其他逻辑 ...
    return base_prompt
```

**优点**:
- 不改变 tool_choice 行为
- 通过提示词引导 LLM

**缺点**:
- 依赖 LLM 遵循指令
- 可能不稳定

---

## 六、推荐方案

**推荐**: 方案 B + 方案 D 组合

1. **短期** (方案 B): 修改 `_get_tool_choice_param()` 为 ZhipuAI 设置 tool_choice="any"
2. **长期** (方案 D): 增强系统提示词，提供明确的工具调用规则

### 实施优先级

| 优先级 | 方案 | 工作量 | 预期效果 |
|--------|------|--------|----------|
| P0 | 方案 B | 低 | 立即修复问题 |
| P1 | 方案 D | 中 | 提升稳定性 |

---

## 七、测试计划

### 7.1 单元测试

```python
def test_get_tool_choice_param_for_zhipu():
    """验证 ZhipuAI 模型的 tool_choice 参数"""
    engine = AgentEngine(config_with_zhipu)
    choice = engine._get_tool_choice_param()
    assert choice == ToolCallStrategy.ANY
```

### 7.2 集成测试

| 测试用例 | 输入 | 预期行为 |
|----------|------|----------|
| 计算器 | "2138/2394+23是多少" | 调用 evaluate 工具 |
| 冷笑话 | "讲一个冷笑话" | 调用 get_joke 工具 |
| BTC价格 | "BTC的最新价格是多少" | 调用 coingecko 工具 |

### 7.3 回归测试

- 确保 OpenAI 模型行为不变
- 确保 Ollama 模型行为不变
- 确保 non-tool 场景正常工作

---

**分析完成**
