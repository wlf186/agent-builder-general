# Bugfix: AgentEngine.stream() 参数不匹配

**迭代编号**: iteration-202603150000
**修复时间**: 2026-03-15
**修复者**: AC130 Dev
**严重级别**: HIGH (导致流式对话完全不可用)

---

## 问题描述

**错误信息**: `AgentEngine.stream() takes from 2 to 4 positional arguments but 5 were given`

**影响范围**: 所有智能体的流式对话功能

---

## 根因分析

### 调用链路

```
AgentInstance.chat_stream()
  └─> AgentEngine.stream()
```

### 参数不匹配

| 位置 | 代码 | 参数数量 |
|------|------|----------|
| **调用方** | `src/agent_manager.py:182` | 4个参数 |
| **被调用方** | `src/agent_engine.py:1385` | 3个参数 |

### 调用方代码 (`agent_manager.py:182`)

```python
async for event in self.engine.stream(message, chat_history, file_context, trace_id):
```

传入参数：
1. `message` - 用户消息
2. `chat_history` - 对话历史
3. `file_context` - 文件上下文
4. `trace_id` - 追溯ID

### 被调用方代码 (`agent_engine.py:1385`) - 修复前

```python
async def stream(self, user_input: str, history: List[Dict] = None, file_context: str = ""):
```

定义参数：
1. `user_input`
2. `history`
3. `file_context`

**缺失**: `trace_id` 参数

---

## 修复方案

### 代码修改

**文件**: `src/agent_engine.py`
**行号**: 1385

**修改前**:
```python
async def stream(self, user_input: str, history: List[Dict] = None, file_context: str = ""):
```

**修改后**:
```python
async def stream(self, user_input: str, history: List[Dict] = None, file_context: str = "", trace_id: str = None):
```

### Docstring 更新

在 Args 部分添加:
```python
Args:
    user_input: 用户输入
    history: 对话历史
    file_context: 文件上下文信息（包含用户上传文件的元数据）
    trace_id: 可追溯ID，用于关联日志和调试
```

---

## 验证结果

- [x] 方法签名修复完成
- [x] Docstring 已更新
- [x] 参数数量匹配 (4个参数)
- [x] 默认值设置正确

---

## 后续行动

1. 重启后端服务验证流式对话功能
2. 回归测试：打字机效果、工具调用、技能加载状态
3. 检查 `trace_id` 参数是否在其他地方被正确使用

---

## 相关文件

- `src/agent_engine.py` - 修复文件
- `src/agent_manager.py` - 调用方
- `backend.py` - 流式端点
