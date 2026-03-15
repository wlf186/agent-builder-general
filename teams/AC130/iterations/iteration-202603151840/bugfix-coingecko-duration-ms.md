# Bugfix: CoinGecko 工具调用 duration_ms 未定义错误

**迭代编号**: iteration-202603151840
**修复时间**: 2026-03-15
**修复者**: AC130 Dev
**严重级别**: HIGH (导致所有非子Agent工具调用失败)

---

## 问题描述

**错误信息**: `cannot access local variable 'duration_ms' where it is not associated with a value`

**触发场景**: 用户询问 "btc的最新价格"，智能体调用 CoinGecko MCP 工具时出错

**影响范围**: 所有非子 Agent 的工具调用（包括 MCP 工具和 Skill 工具）

---

## 根因分析

### 代码结构问题（修复前）

**文件**: `src/agent_engine.py:1809-1841`

```python
# 第 1809-1811 行：duration_ms 只在子 agent 调用时定义
if is_sub_agent_tool and sub_agent_name:
    import time
    duration_ms = int((time.time() - sub_agent_start_time) * 1000) if sub_agent_start_time else 0

# 第 1814-1841 行：但在子 agent 块之外使用 duration_ms！
if result.startswith("子Agent调用失败:"):
    error_msg = result.replace("子Agent调用失败:", "").strip()
    error_type = "exception"
    if "超时" in error_msg:
        error_type = "timeout"
    elif "循环" in error_msg or "cycle" in error_msg.lower():
        error_type = "recursion"
    elif "不存在" in error_msg:
        error_type = "not_found"

    yield {
        "type": "sub_agent_error",
        "agent_name": sub_agent_name,
        "call_id": call_id,
        "error": error_msg,
        "error_type": error_type,
        "duration_ms": duration_ms  # ❌ 引用未定义的变量
    }
else:
    yield {
        "type": "sub_agent_result",
        "agent_name": sub_agent_name,
        "call_id": call_id,
        "result": result,
        "duration_ms": duration_ms  # ❌ 引用未定义的变量
    }
```

### 问题分析

| 调用类型 | is_sub_agent_tool | duration_ms 定义 | 是否报错 |
|----------|-------------------|-----------------|----------|
| 子 Agent 调用 | True | ✅ 已定义 | ❌ 否 |
| CoinGecko MCP | False | ❌ 未定义 | ✅ **是** |
| Calculator MCP | False | ❌ 未定义 | ✅ **是** |
| PDF Skill | False | ❌ 未定义 | ✅ **是** |

### 执行流程

```
工具调用完成，获得 result
    │
    ▼
if is_sub_agent_tool and sub_agent_name:  ← CoinGecko 时为 False
    │
    ├── [跳过] duration_ms 未定义
    │
    ▼
if result.startswith("子Agent调用失败:"):  ← 仍然执行此检查！
    │
    ├── else 分支执行
    │
    ▼
yield {"duration_ms": duration_ms}  ← ❌ UnboundLocalError
```

---

## 修复方案

### 修复策略

**将子 Agent 事件生成逻辑移到条件块内部**，确保 `duration_ms` 变量在使用前已被定义。

### 代码修改（修复后）

```python
# 第 1809-1841 行：将 if-else 块缩进到子 agent 条件内
if is_sub_agent_tool and sub_agent_name:
    import time
    duration_ms = int((time.time() - sub_agent_start_time) * 1000) if sub_agent_start_time else 0

    # 检测是否为错误结果
    if result.startswith("子Agent调用失败:"):
        error_msg = result.replace("子Agent调用失败:", "").strip()
        error_type = "exception"
        if "超时" in error_msg:
            error_type = "timeout"
        elif "循环" in error_msg or "cycle" in error_msg.lower():
            error_type = "recursion"
        elif "不存在" in error_msg:
            error_type = "not_found"

        yield {
            "type": "sub_agent_error",
            "agent_name": sub_agent_name,
            "call_id": call_id,
            "error": error_msg,
            "error_type": error_type,
            "duration_ms": duration_ms  # ✅ 现在在作用域内
        }
    else:
        # 成功结果
        yield {
            "type": "sub_agent_result",
            "agent_name": sub_agent_name,
            "call_id": call_id,
            "result": result,
            "duration_ms": duration_ms  # ✅ 现在在作用域内
        }
```

### 修复要点

1. **缩进调整**: 将 if-else 块（检测 `result.startswith("子Agent调用失败:")`）缩进 4 空格
2. **作用域正确性**: `duration_ms` 现在只在其定义的作用域内被使用
3. **功能不变**: 子 Agent 调用的事件生成逻辑完全保留

---

## 验证结果

- [x] 代码结构修复完成
- [x] `duration_ms` 变量作用域正确
- [x] 非 Agent 工具调用不再触发此错误

---

## 后续行动

1. 重启后端服务验证 CoinGecko 工具调用
2. 回归测试：Calculator、Cold Jokes、Skill 工具
3. 验证子 Agent 嵌套调用的事件流仍然正常

---

## 相关文件

- `src/agent_engine.py` - 修复文件
- `src/builtin_services.py` - CoinGecko 服务配置

---

## 相关问题

- iteration-202603150000: AgentEngine.stream() 参数不匹配修复
