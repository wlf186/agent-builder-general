# MCP/Skill 工具调用优先级技术方案

**迭代编号**: AC130-202603141800
**创建日期**: 2026-03-14
**作者**: AC130 Developer
**状态**: 设计中

---

## 1. 问题诊断

### 1.1 问题现象

智能体在面对以下类型问题时，LLM 直接回答而不调用 MCP 工具：

| 问题类型 | 预期行为 | 实际行为 |
|---------|---------|---------|
| 数学计算 (如 "100+200") | 调用 `evaluate` 工具 | 直接给出计算结果 |
| 冷笑话请求 | 调用 `get_joke` 工具 | 直接编造笑话 |
| 技能相关查询 | 调用 `load_skill` 工具 | 直接给出通用建议 |

### 1.2 根因分析

通过分析 `src/agent_engine.py` 代码，识别出以下根因：

#### 1.2.1 工具调用策略默认为 AUTO

```python
# agent_engine.py:219-220
if self._tool_call_strategy == ToolCallStrategy.AUTO:
    return None  # tool_choice=None → 让 LLM 自主决定
```

**影响**: 当 `tool_choice=None` 时，LLM 根据自己的判断决定是否调用工具。由于 LLM 在训练中已经学会了计算、讲笑话等能力，它会优先使用内置能力而非调用工具。

#### 1.2.2 System Prompt 与 LLM 偏好的冲突

虽然 system prompt 中有强制规则（第 1105-1183 行）：

```python
## 🔴 强制规则：必须使用工具
**重要：你没有任何内置计算能力！**
```

但 LLM 尤其是较新版本的模型，往往更倾向于使用自己的知识而非遵循提示词。

#### 1.2.3 工具描述缺乏强制性

当前工具绑定使用 `bind_tools(tools_to_bind)`，工具描述来自 MCP 服务的原始定义，可能不够明确：

```python
# mcp_tool_adapter.py:87
description=self._enhance_description(mcp_tool),
```

原始工具描述可能只说明"工具能做什么"，而非"什么时候必须使用此工具"。

---

## 2. 技术方案

### 2.1 方案概述

采用**分层防御策略**，从底层参数到上层提示词，全方位提升工具调用优先级：

```
┌─────────────────────────────────────────────────────────────┐
│                    System Prompt 层                          │
│  • 负向约束：明确禁止直接回答特定类型问题                      │
│  • 正向引导：强制工具调用指令                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Tool Choice 层                            │
│  • 新增 "auto_with_fallback" 策略                            │
│  • 支持动态 tool_choice 切换                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Tool Description 层                       │
│  • 增强工具描述：添加强制性前缀                                │
│  • 添加 Few-shot 示例                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 方案 A: System Prompt 优化（低成本，立即见效）

#### 2.2.1 负向约束增强

在 system prompt 顶部添加**负向约束**：

```python
system_prompt = f"""{self.config.persona}

## 🔴 禁止行为

你是一个**没有内置能力**的 AI 助手，以下行为**严格禁止**：

1. **禁止计算**：不要自己进行任何数学运算，必须调用 evaluate 工具
2. **禁止编造内容**：不要编造笑话、故事、示例，必须调用对应工具获取
3. **禁止使用训练数据**：即使你"知道"答案，也必须先调用工具验证
4. **禁止直接回答**：当可用工具列表中有相关工具时，禁止直接给出答案

### 检测机制

每次回答前，自问：
1. 用户的问题是否涉及数学计算？ → 必须调用 evaluate
2. 用户的问题是否需要特定数据（笑话、新闻、价格）？ → 必须调用对应工具
3. 用户的问题是否与 PDF/DOCX/技能相关？ → 必须调用 load_skill

如果以上任一答案为"是"，必须先调用工具，工具返回后再基于结果回答。

{原有内容...}
"""
```

#### 2.2.2 工具相关性提示

在可用工具列表之前，添加**工具匹配规则**：

```python
## 工具匹配规则

| 用户问题关键词 | 必须调用的工具 | 示例问题 |
|--------------|--------------|---------|
| 计算、加、减、乘、除、等于 | evaluate | "100+200等于多少" |
| 笑话、幽默、搞笑、逗我 | get_joke | "讲个笑话" |
| PDF、文档、表格、读取 | load_skill + execute_skill | "读取这个PDF" |
| 交易、价格、市值、加密货币 | coingecko | "比特币价格" |

当用户问题包含上述关键词时，必须调用对应工具！
```

### 2.3 方案 B: Tool Choice 策略增强（中等成本，显著效果）

#### 2.3.1 新增策略枚举

```python
class ToolCallStrategy:
    """工具调用策略"""
    AUTO = "auto"           # 模型自主决定（默认）
    ANY = "any"             # 强制至少调用一个工具
    REQUIRED = "required"   # 强制至少调用一个工具（OpenAI）
    AUTO_WITH_FALLBACK = "auto_with_fallback"  # 智能降级策略
```

#### 2.3.2 智能降级策略实现

```python
def _get_tool_choice_param(self) -> Optional[str]:
    """
    获取 tool_choice 参数

    新增 AUTO_WITH_FALLBACK 策略：
    1. 首次请求使用 tool_choice=any（强制调用工具）
    2. 如果工具调用失败/超时，后续轮次切换为 auto（允许降级）
    3. 避免用户完全无法获得响应
    """
    if self._tool_call_strategy == ToolCallStrategy.AUTO:
        return None

    if self._tool_call_strategy == ToolCallStrategy.AUTO_WITH_FALLBACK:
        # 检查是否是首次请求
        if self._is_first_tool_call_attempt():
            return ToolCallStrategy.ANY  # 首次强制调用
        return None  # 后续允许降级

    # 原有逻辑...
```

#### 2.3.3 配置界面支持

在 AgentConfig 中添加新字段：

```python
@dataclass
class AgentConfig:
    # ... 现有字段 ...

    # 工具调用策略
    tool_call_strategy: str = "auto_with_fallback"  # 新增默认值
    tool_call_max_fallback: int = 2  # 最多降级次数
```

### 2.4 方案 C: 工具描述增强（低成本，辅助效果）

#### 2.4.1 强制性前缀

在 `MCPToolAdapter._enhance_description` 中添加：

```python
def _enhance_description(self, mcp_tool: 'MCPTool') -> str:
    """增强工具描述，添加强制性前缀"""

    # 工具类型到强制性前缀的映射
    mandatory_prefixes = {
        "evaluate": "[MANDATORY] 数学计算必须使用此工具，禁止自己计算！",
        "get_joke": "[MANDATORY] 获取笑话必须使用此工具，禁止编造！",
        "get_coin_price": "[MANDATORY] 查询加密货币价格必须使用此工具！",
        "load_skill": "[MANDATORY] 处理 PDF/DOCX 等文件必须先调用此工具加载技能！",
        "execute_skill": "[MANDATORY] 执行技能脚本处理文件必须使用此工具！",
    }

    # 获取强制性前缀
    prefix = mandatory_prefixes.get(mcp_tool.name, "")

    # 原始描述
    base_desc = mcp_tool.description or f"Tool: {mcp_tool.name}"

    # 组合
    if prefix:
        return f"{prefix}\n\n{base_desc}"
    return base_desc
```

#### 2.4.2 添加调用示例

在工具描述中嵌入 Few-shot 示例：

```python
def _add_few_shot_examples(self, tool_name: str) -> str:
    """为工具添加 Few-shot 调用示例"""

    examples = {
        "evaluate": """
**调用示例**：
- 用户："100+200等于多少" → 调用 {{"expression": "100+200"}}
- 用户："5的平方根" → 调用 {{"expression": "sqrt(5)"}}
- 用户："2.5 * 3 + 10" → 调用 {{"expression": "2.5 * 3 + 10"}}
""",
        "get_joke": """
**调用示例**：
- 用户："讲个笑话" → 调用 {}
- 用户："来个冷笑话" → 调用 {}
- 用户："逗我开心" → 调用 {}
""",
        # ... 其他工具示例
    }

    return examples.get(tool_name, "")
```

---

## 3. 实施计划

### 3.1 优先级排序

| 方案 | 成本 | 效果 | 风险 | 优先级 |
|-----|------|------|------|-------|
| 方案 A: System Prompt 优化 | 低 | 中 | 低 | P0（立即实施）|
| 方案 C: 工具描述增强 | 低 | 中 | 低 | P1（快速跟进）|
| 方案 B: Tool Choice 增强 | 中 | 高 | 中 | P2（验证后实施）|

### 3.2 实施步骤

#### 第一阶段：System Prompt 优化（2小时）

1. 修改 `src/agent_engine.py` 的 `_get_system_prompt` 方法
2. 添加负向约束和工具匹配规则
3. 测试验证工具调用率

**代码位置**: `agent_engine.py:286-304`

**风险评估**: 低
- 只修改提示词，不改变核心逻辑
- 可以快速回滚

#### 第二阶段：工具描述增强（1小时）

1. 修改 `src/mcp_tool_adapter.py` 的 `_enhance_description` 方法
2. 实现强制性前缀逻辑
3. 添加 Few-shot 示例

**代码位置**: `mcp_tool_adapter.py`

**风险评估**: 低
- 只影响工具描述字符串
- 不影响工具执行逻辑

#### 第三阶段：Tool Choice 策略（4小时）

1. 扩展 `ToolCallStrategy` 枚举
2. 实现智能降级逻辑
3. 修改 AgentConfig 数据模型
4. 前端 UI 适配

**代码位置**:
- `agent_engine.py:29-34` (枚举定义)
- `agent_engine.py:209-231` (tool_choice 逻辑)
- `src/models.py` (配置模型)

**风险评估**: 中
- 需要兼容不同 LLM 提供商
- 需要充分测试工具调用失败场景

### 3.3 测试策略

#### 3.3.1 单元测试

```python
# tests/test_tool_call_strategy.py

def test_tool_choice_fallback():
    """测试智能降级策略"""
    engine = AgentEngine(config)

    # 首次请求应强制调用工具
    choice1 = engine._get_tool_choice_param()
    assert choice1 == ToolCallStrategy.ANY

    # 模拟工具失败后的第二次请求
    engine._tool_call_attempts = 1
    choice2 = engine._get_tool_choice_param()
    assert choice2 is None  # 允许降级

def test_mandatory_tool_description():
    """测试强制性工具描述"""
    adapter = MCPToolAdapter(mcp_manager)
    tool = adapter.convert_tool(evaluate_tool)

    assert "[MANDATORY]" in tool.description
    assert "禁止自己计算" in tool.description
```

#### 3.3.2 集成测试

使用 Playwright 验证前端行为：

```typescript
// tests/tool-call-verification.spec.ts

test('数学计算必须调用 evaluate 工具', async ({ page }) => {
  await page.goto('/agents/test-agent/chat');
  await page.fill('[data-testid="chat-input"]', '100+200等于多少');
  await page.click('[data-testid="send-button"]');

  // 验证工具调用指示器出现
  await expect(page.locator('[data-testid="tool-call-indicator"]')).toBeVisible();
  await expect(page.locator('[data-testid="tool-call-indicator"]')).toContainText('evaluate');
});
```

---

## 4. 流式输出影响评估

### 4.1 流式输出架构回顾

```
┌─────────────────────────────────────────────────────────────┐
│ LLM astream() → 智能缓冲 → 事件 yield → SSE → 前端渲染      │
└─────────────────────────────────────────────────────────────┘
```

**关键代码**: `agent_engine.py:1242-1280`

### 4.2 方案影响分析

| 方案 | 流式输出影响 | 缓解措施 |
|-----|-------------|---------|
| System Prompt 优化 | 无影响 | N/A |
| 工具描述增强 | 无影响 | N/A |
| Tool Choice=AUTO_WITH_FALLBACK | **有影响** | 见下文 |

### 4.3 Tool Choice 对流式输出的影响

当使用 `tool_choice=any` 时，LLM 被强制返回工具调用。这会影响：

1. **缓冲策略**：工具调用 JSON 会立即被检测到
2. **首 token 延迟**：可能增加（LLM 需要生成工具调用）
3. **多轮循环**：工具调用后需要再次调用 LLM 处理结果

**缓解措施**：

```python
# 在 stream() 方法中，优化多轮工具调用的 thinking 输出
if iteration == 1:
    yield {"type": "thinking", "content": "✓ 分析用户请求\n✓ 正在生成回答..."}
elif tool_calls:
    # 明确告知用户正在进行工具调用
    yield {"type": "thinking", "content": f"✓ 调用工具: {', '.join([tc['name'] for tc in tool_calls])}\n✓ 正在获取结果..."}
```

### 4.4 兼容性保证

**承诺**：所有方案修改**不会破坏**以下功能：

1. ✅ 打字机效果（逐字符流式输出）
2. ✅ 思考过程实时更新
3. ✅ 工具调用正确检测
4. ✅ 性能指标准确统计

**验证方法**：运行 `tests/test_streaming_output.py`

---

## 5. 替代方案

### 5.1 方案 X: 完全禁用 LLM 直接回答（高风险）

```python
# 在 tool_calls 检测之前，添加内容过滤
if response_content and not tool_calls:
    # 如果没有工具调用但产生了内容，可能是违规
    yield {"type": "error", "content": "抱歉，此请求需要使用工具，请重试"}
    return
```

**风险**：可能导致用户完全无法获得响应
**建议**：仅在测试环境使用

### 5.2 方案 Y: 用户提示增强（前端层面）

在前端添加提示：

```tsx
{!hasToolCall && (
  <div className="text-amber-500 text-sm">
    💡 提示：对于计算、查询等问题，智能体会调用专门工具
  </div>
)}
```

**优点**：无后端风险
**缺点**：治标不治本

---

## 6. 配置建议

### 6.1 默认配置

```python
# 推荐的默认配置
tool_call_strategy = "auto_with_fallback"
tool_call_max_fallback = 2
```

### 6.2 不同场景的配置建议

| 场景 | 建议策略 | 理由 |
|-----|---------|------|
| 纯对话智能体 | `auto` | 无需强制工具 |
| 计算/查询密集型 | `any` | 确保工具使用 |
| 混合型智能体 | `auto_with_fallback` | 平衡效果与体验 |
| 技能处理智能体 | `required` | 确保技能加载 |

---

## 7. 成功指标

### 7.1 定量指标

| 指标 | 当前值 | 目标值 | 测量方法 |
|-----|-------|-------|---------|
| 数学计算工具调用率 | ~20% | >90% | 日志分析 |
| 冷笑话工具调用率 | ~10% | >80% | 日志分析 |
| 技能加载工具调用率 | ~30% | >85% | 日志分析 |

### 7.2 定性指标

1. 用户反馈："智能体现在会调用工具了"
2. Badcase 减少：直接回答数学题的情况消失
3. 响应质量：工具调用后的答案更准确

---

## 8. 附录

### 8.1 相关文件

| 文件 | 修改内容 |
|-----|---------|
| `src/agent_engine.py` | System prompt 优化、tool_choice 逻辑 |
| `src/mcp_tool_adapter.py` | 工具描述增强 |
| `src/models.py` | AgentConfig 扩展 |
| `frontend/src/components/AgentChat.tsx` | (可选) 用户提示 |

### 8.2 参考资料

- [LangChain bind_tools 文档](https://python.langchain.com/docs/modules/model_io/chat/tools_binding/)
- [OpenAI Tool Use API](https://platform.openai.com/docs/guides/function-calling)
- CLAUDE.md 流式输出架构说明

---

**版本历史**:
- v1.0 (2026-03-14): 初始设计
- v1.1 (2026-03-14): P0 和 P1 实施完成
