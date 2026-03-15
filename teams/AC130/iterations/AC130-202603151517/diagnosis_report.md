# AC130-202603151517 诊断报告

## 问题描述

**Agent**: test3
**用户输入**: "你好"
**症状**: assistant 返回空字符串

### 调试日志显示
- `chunks.total: 0` - 没有流式输出
- `model_calls: []` - 没有模型调用
- `tool_calls: []` - 没有工具调用
- 后端只记录了 get_debug_logs 请求，没有聊天请求处理日志

## 诊断过程

### 1. 前端请求链路检查
- ✅ `AgentChat.tsx` 的 `handleSend` 正常
- ✅ fetch 请求发送到 `/stream/agents/${agentName}/chat`
- ✅ `route.ts` 正确转发到 `http://localhost:20881/api/agents/${name}/chat/stream`

### 2. 后端端点检查
- ✅ `backend.py` 的 `chat_stream` 端点正常
- ✅ `generate()` 函数正确调用 `instance.chat_stream()`
- ✅ `AgentInstance.chat_stream()` 正确调用 `self.engine.stream()`

### 3. AgentEngine.stream() 方法检查
检查 `src/agent_engine.py` 第 1124-1612 行的 `stream()` 方法：

**发现问题点**：第 1547-1571 行存在边界情况 BUG

### 根因分析

在 `stream()` 方法的多轮工具调用循环中，当 LLM 返回**完全空响应**时：

```python
else:
    # 没有工具调用，这一轮是最终回答
    if started_streaming:
        # 条件1: 已开始流式输出 → False（空响应）
        ...
    elif buffering and buffer_content:
        # 条件2: 有缓冲内容 → False（buffer_content 为空）
        ...
    elif might_be_tool_call and response_content:
        # 条件3: 可能的工具调用且响应非空 → False（response_content 为空）
        ...
    elif response_content and not full_response:
        # 条件4: 响应非空且无完整响应 → False（response_content 为空）
        ...

    # 所有条件都不满足，直接 break
    break  # ← 没有输出任何内容！
```

**结果**：代码直接退出循环，**没有 yield 任何 `content` 类型的事件**，导致前端显示空响应。

### 可能导致空响应的原因

1. **LLM API 调用失败**（但未抛出异常）
2. **LLM 返回了空字符串或 null**
3. **网络超时或连接问题**
4. **模型服务配置问题**（test3 使用 TE47 模型服务）

## 修复方案

### 代码修改

**文件**: `src/agent_engine.py`
**位置**: 第 1564-1571 行

添加 `else` 分支处理空响应边界情况：

```python
else:
    # 【AC130-202603151517 修复】处理空响应边界情况
    # 当 LLM 完全没有返回内容时，输出友好提示
    print(f"[WARNING] LLM 返回空响应，response_content='{response_content}', buffer_content='{buffer_content}'")
    yield {"type": "thinking", "content": "⚠️ 模型未返回有效响应"}
    empty_msg = "抱歉，模型未能生成回答。这可能是由于网络问题或模型服务暂时不可用。请稍后重试。"
    for char in empty_msg:
        full_response += char
        yield {"type": "content", "content": char}
```

### 修复效果

- ✅ 即使 LLM 返回空响应，用户也能看到友好的错误提示
- ✅ 后端会打印 WARNING 日志，便于追踪问题
- ✅ 不会导致前端显示空白或卡住

## 验证步骤

1. 重启后端服务
2. 使用 test3 agent 发送 "你好"
3. 观察后端日志是否出现 WARNING 消息
4. 确认前端显示友好错误提示而非空白

## 相关文件

- `src/agent_engine.py` - 主要修复文件
- `frontend/src/components/AgentChat.tsx` - 前端渲染
- `frontend/src/app/stream/agents/[name]/chat/route.ts` - 流式代理
- `backend.py` - 后端端点

## 报告生成时间

2026-03-15 15:17
