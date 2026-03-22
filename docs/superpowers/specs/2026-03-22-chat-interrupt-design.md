# 对话中断功能设计

**日期**: 2026-03-22
**状态**: 待实现
**范围**: 前端 `AgentChat.tsx`

---

## 概述

在调试对话窗口增加用户主动中断对话的功能。用户可以在 LLM 生成或工具调用期间点击停止按钮，立即中止请求并丢弃整个回复。

---

## 需求

1. 运行时发送按钮变为停止按钮（红色 + 方块图标）
2. 点击停止立即中断 HTTP 连接
3. 停止后丢弃整个 assistant 回复（保留用户消息）
4. 工具调用期间同样可中断（连接断开后端自动停止）

---

## 技术设计

### 1. 新增 `handleStop` 函数

位置：`AgentChat.tsx`，`handleSend` 函数附近

```typescript
const handleStop = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
}, []);
```

**说明**：调用 `AbortController.abort()` 中断 fetch 请求。后端 `StreamingResponse` 会检测到连接断开并停止生成。

### 2. 修改发送按钮

位置：`AgentChat.tsx` 第 1738-1745 行附近

**修改点**：
- `onClick`: 运行时绑定 `handleStop`，否则绑定 `handleSend`
- `disabled`: 仅非运行时检查禁用条件
- `className`: 运行时红色背景，否则蓝色背景
- 内容：运行时显示 `Square` 图标，否则显示"发送"文字

```tsx
<button
  type="button"
  onClick={isRunning ? handleStop : handleSend}
  disabled={!isRunning && (isUploading || (!inputValue.trim() && pendingFiles.length === 0 && fileContext.file_ids.length === 0))}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isRunning
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
  }`}
>
  {isRunning ? <Square className="w-4 h-4" /> : t("send")}
</button>
```

### 3. 修改 AbortError 处理

位置：`AgentChat.tsx` 第 1168-1178 行附近

**修改点**：在捕获 `AbortError` 时，移除空的 assistant 消息

```typescript
if (error instanceof Error && error.name === 'AbortError') {
  addLog('INFO', locale === "zh" ? '请求被取消' : 'Request cancelled');
  // 移除空的 assistant 消息
  setMessages((prev) => prev.filter(msg => msg.id !== assistantMsgId));
  messagesRef.current = messagesRef.current.filter(msg => msg.id !== assistantMsgId);
}
```

### 4. 导入图标

位置：文件顶部 lucide-react 导入语句

```typescript
import { ..., Square } from 'lucide-react';
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `frontend/src/components/AgentChat.tsx` | 修改 | 添加停止功能 |

---

## 测试要点

1. **基础停止**：发送消息后立即点击停止，assistant 消息应被移除
2. **思考阶段停止**：在 thinking 展示时停止，内容应被丢弃
3. **工具调用阶段停止**：在工具执行时停止，连接断开，无错误提示
4. **按钮状态**：运行时按钮变红并显示方块图标，停止后恢复蓝色发送按钮

---

## 风险

- **无**：改动最小化，利用现有 `AbortController` 架构，不涉及流式输出核心逻辑
