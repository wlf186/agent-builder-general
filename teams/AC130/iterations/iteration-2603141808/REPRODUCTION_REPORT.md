# MCP 工具未被正确调用问题 - 复现报告

**迭代编号**: iteration-2603141808
**复现人**: AC130 团队
**复现时间**: 2026-03-14 18:08
**问题状态**: ✅ 已复现成功

---

## 一、问题描述

用户反馈 test3 智能体在调试对话中：
1. 发送"2138/2394+23是多少" - 没有调用 calculator，被LLM直接计算
2. 发送"讲一个冷笑话" - 没有调用 cold-jokes，被LLM直接生成
3. 发送"BTC的最新价格是多少" - 没有调用 coingecko，被LLM直接回答

---

## 二、问题确认

### 2.1 智能体配置验证

```json
{
  "name": "test3",
  "persona": "你是一个有帮助的助手",
  "model_service": "TE47",
  "mcp_services": ["calculator", "cold-jokes", "coingecko"],
  "skills": []
}
```

**配置状态**: ✅ 正确

### 2.2 MCP 服务配置验证

| 服务名 | 状态 | 工具数量 |
|--------|------|----------|
| calculator | ✅ Healthy | 7个工具 |
| cold-jokes | ✅ Healthy | 3个工具 |
| coingecko | ✅ Healthy | 50+工具 |

**服务状态**: ✅ 全部可用

### 2.3 工具绑定流程验证

通过代码审查，工具绑定流程为：

1. `AgentInstance.initialize()` → 创建独立的 MCPManager
2. `MCPManager.add_service()` → 连接配置中的 mcp_services
3. `AgentEngine._bind_tools_to_llm()` → 使用 bind_tools() 绑定工具

**绑定流程**: ✅ 逻辑正确

---

## 三、根因分析

### 3.1 关键发现

问题根因位于 `src/agent_engine.py` 第209-231行：

```python
def _get_tool_choice_param(self) -> Optional[str]:
    """
    获取 tool_choice 参数

    根据模型类型选择合适的 tool_choice 值
    OpenAI 使用 "required"，其他模型使用 "any"

    Returns:
        tool_choice 参数值或 None
    """
    if self._tool_call_strategy == ToolCallStrategy.AUTO:
        return None

    # 检查模型类型
    model_name = getattr(self.llm, 'model_name', '') or ''
    base_url = getattr(self.llm, 'base_url', '') or ''

    # OpenAI 使用 "required"
    if 'openai.com' in base_url or model_name.startswith('gpt-'):
        return ToolCallStrategy.REQUIRED

    # 其他模型使用 "any"
    return ToolCallStrategy.ANY
```

### 3.2 问题分析

| 条件 | 返回值 | 行为 |
|------|--------|------|
| tool_call_strategy == AUTO | None | **LLM 自主决定是否调用工具** |
| OpenAI 模型 | "required" | 强制至少调用一个工具 |
| 其他模型 | "any" | 强制至少调用一个工具 |

对于 test3 智能体：
- 模型服务: TE47 (ZhipuAI glm-4.7)
- 默认策略: ToolCallStrategy.AUTO
- **实际行为**: tool_choice=None（auto 模式）

### 3.3 问题流程图

```
用户消息 "2138/2394+23是多少"
         ↓
LLM 分析消息（auto 模式）
         ↓
LLM 判断："这是一个简单的计算问题，我可以直接回答"
         ↓
LLM 直接输出答案，不调用工具 ❌
```

### 3.4 代码位置

| 文件 | 行号 | 说明 |
|------|------|------|
| `src/agent_engine.py` | 209-231 | `_get_tool_choice_param()` 方法 |
| `src/agent_engine.py` | 150-207 | `_bind_tools_to_llm()` 方法 |
| `src/agent_engine.py` | 1291-1302 | 原生工具调用检测逻辑 |

---

## 四、验证方法

### 4.1 复现步骤

1. 确认后端服务运行：
   ```bash
   curl http://localhost:20881/api/mcp-services
   ```

2. 确认 MCP 服务可用：
   ```bash
   curl -X POST http://localhost:20882/calculator/tools/list
   ```

3. 向 test3 发送测试消息：
   - "2138/2394+23是多少"
   - "讲一个冷笑话"
   - "BTC的最新价格是多少"

4. 观察：LLM 直接回答，未调用工具

### 4.2 诊断日志

预期的正确日志（工具被调用）：
```
[DEBUG] 绑定 60 个 MCP 工具
[DEBUG] LLM 已绑定 60 个工具，tool_choice=any
[DEBUG] 检测到原生 tool_calls: ['evaluate']
```

实际日志（工具未调用）：
```
[DEBUG] 绑定 60 个 MCP 工具
[DEBUG] LLM 已绑定 60 个工具，tool_choice=auto
[WARNING] 未检测到工具调用，LLM直接回答
```

---

## 五、相关文件清单

| 文件 | 说明 |
|------|------|
| `src/agent_engine.py` | Agent 引擎，包含工具绑定逻辑 |
| `src/mcp_manager.py` | MCP 管理器 |
| `src/mcp_tool_adapter.py` | MCP 工具适配器 |
| `src/mcp_registry.py` | MCP 服务注册表 |
| `src/agent_manager.py` | Agent 实例管理器 |
| `data/agent_configs.json` | 智能体配置 |
| `data/mcp_services.json` | MCP 服务配置 |

---

## 六、建议修复方案

### 方案一：修改默认策略

将默认策略从 AUTO 改为 ANY：

```python
# 初始化时设置默认策略
self._tool_call_strategy = ToolCallStrategy.ANY  # 强制至少调用一个工具
```

### 方案二：按模型类型设置策略

在 `_get_tool_choice_param()` 中为 ZhipuAI 模型添加特殊处理：

```python
# ZhipuAI 模型使用 "any"
if 'bigmodel.cn' in base_url or model_name.startswith('glm-'):
    return ToolCallStrategy.ANY
```

### 方案三：增强系统提示词

在 `_get_system_prompt()` 中添加明确的工具调用指令：

```python
tool_instruction = """
## 重要：工具调用规则

当用户询问以下类型问题时，**必须**使用对应的工具：
- 数学计算 → 使用 calculator 工具
- 笑话/幽默 → 使用 cold-jokes 工具
- 加密货币价格 → 使用 coingecko 工具

禁止直接回答，必须调用工具获取准确结果。
"""
base_prompt += tool_instruction
```

---

## 七、优先级评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 影响范围 | 高 | 所有使用 ZhipuAI 模型的智能体 |
| 严重程度 | 中 | 功能可用，但体验差 |
| 修复难度 | 低 | 修改少量代码即可 |
| 业务影响 | 中 | 用户可能认为工具功能无效 |

**建议优先级**: P1（高优先级）

---

## 八、附录

### A. tool_choice 参数说明

| 值 | 行为 |
|----|------|
| "auto" (None) | LLM 自主决定是否调用工具 |
| "any" | 强制至少调用一个工具 |
| "required" | 强制至少调用一个工具（OpenAI 专用） |

### B. 模型服务配置

```json
{
  "name": "TE47",
  "provider": "zhipu",
  "base_url": "https://open.bigmodel.cn/api/coding/paas/v4",
  "selected_model": "glm-4.7"
}
```

---

**报告结束**
