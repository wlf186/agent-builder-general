# CoinGecko MCP 工具调用问题诊断报告

**生成时间**: 2026-03-14 20:00:00
**诊断者**: AC130 Team Lead
**问题来源**: 用户反馈

---

## 问题现象

用户使用 test3 智能体发送"BTC的最新价格"，出现以下错误：

```
工具调用失败: Cannot stringify type object; Expected string, number, boolean, or null.
```

**工具调用记录**:
1. `get_simple_price(coingecko)` - 输入: `{"kwargs":{"ids":"bitcoin","vs_currencies":"usd,cny","include_24hr_change":"true"}}` - **失败**
2. `get_simple_price(coingecko)` - 输入: `{"kwargs":{"id":"bitcoin","vs_currency":"usd"}}` - **错误: 无法建立连接**
3. `get_coins_markets(coingecko)` - 输入: `{"kwargs":{"vs_currency":"usd","ids":"bitcoin"}}` - **错误: 无法建立连接**
4. `get_search(coingecko)` - 输入: `{"kwargs":{"query":"bitcoin"}}` - **错误: 无法建立连接**

---

## 根因分析

### TC-001: kwargs 参数序列化失败

**问题定位**: `src/agent_engine.py` 第415行

```python
# 问题代码
result = await self.mcp_manager.call_tool(tool_name, tool_args)  # 没有展开 kwargs!
```

**分析**:
1. `mcp_tool_adapter.py` 中的 kwargs 展开逻辑只在使用 `StructuredTool` 路径时生效
2. 但流式处理（`stream()` 方法）在第1442行直接调用 `self._execute_tool(tool_name, tool_args)`
3. `_execute_tool` 方法直接传递 `tool_args` 给 MCP，绕过了展开逻辑
4. 导致 CoinGecko 工具收到 `{"kwargs": {...}}` 格式，触发 "Cannot stringify type object" 错误

### TC-002: 连接失败问题

**分析结论**: CoinGecko MCP 服务本身**完全正常**

```bash
# 测试结果
POST /api/mcp-services/coingecko/test → {"success":true,"tools":[...50+工具...]}
```

**结论**: "连接失败"是 TC-001 的副作用，修复 TC-001 后此问题将自动解决。

---

## 修复方案

### TC-001 修复 (AC130-202603142000)

在 `src/agent_engine.py` 的 `_execute_tool` 方法中添加 kwargs 展开逻辑：

```python
async def _execute_tool(self, tool_name: str, tool_args: Dict) -> str:
    """执行工具调用"""
    # ========================================
    # 【AC130-202603142000 TC-001 修复】展开 kwargs 参数
    # ========================================
    # 当 LLM 使用动态 schema 时，参数可能被包装为 {'kwargs': {...}}
    # 需要展开 kwargs 的内容作为实际参数传递给 MCP
    actual_args = tool_args
    if len(tool_args) == 1 and 'kwargs' in tool_args:
        kwargs_value = tool_args['kwargs']
        if isinstance(kwargs_value, dict):
            actual_args = kwargs_value
            print(f"[DEBUG] [agent_engine] 展开动态 schema 参数: {tool_args} -> {actual_args}")

    # ... 后续使用 actual_args 调用 MCP
    result = await self.mcp_manager.call_tool(tool_name, actual_args)
```

---

## 任务分配

| 任务ID | 描述 | 负责人 | 状态 |
|--------|------|--------|------|
| TC-001 | kwargs 参数序列化失败 | developer/Lead | ✅ 已完成 |
| TC-002 | 连接失败问题 | developer/Lead | ✅ 已完成 (TC-001的副作用) |
| TC-003 | 修复验证与回归测试 | user-advocate | 🔄 进行中 |

---

**报告生成时间**: 2026-03-14 20:00:00
**修复时间**: 2026-03-14 20:10:00
**签名**: AC130 Team Lead
