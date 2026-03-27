# Langfuse 集成验收测试

> 来源: `frontend/tests/langfuse-uat.spec.ts`
> 复杂度: complex
> 验收标准:
> 1. Trace ID 树状结构展示完整调用链
> 2. 每个环节耗时清晰可见
> 3. 子 Agent 报错时显示异常堆栈
> 4. 支持 Conversation ID 反向查询

## 前置条件
- 前端服务已启动 (localhost:20880)
- Langfuse 服务已启动 (localhost:3000)
- 存在名为 "demo" 的智能体（可通过环境变量 TEST_AGENT 覆盖）

---

### 测试用例 TC-001: 简单对话创建 Trace

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框（`input[type="text"][placeholder]`），输入 "你好，请简单介绍一下你自己。"
3. 在 snapshot 中找到提交按钮（`button[type="submit"]`），点击发送
4. 等待直到助手回复出现（`[data-testid="assistant-message"]` 元素，最长 30 秒）

## 验证
- 页面应显示助手回复消息
- 请访问 `http://localhost:3000` 在 Langfuse 中验证 Trace 已创建

---

### 测试用例 TC-002: 工具调用创建 Span

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框，输入 "帮我计算 123 * 456"
3. 点击提交按钮发送
4. 等待工具调用事件出现（包含 "工具" 和 "evaluate" 文本，最长 30 秒）
5. 等待直到助手回复出现（最长 30 秒）

## 验证
- 页面应显示工具调用过程
- 请在 Langfuse 中验证 Tool Span 已创建

---

### 测试用例 TC-003: 多轮对话记录在同一 Trace 下

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 对每个消息重复以下操作:
   - 在 snapshot 中找到聊天输入框，输入消息
   - 点击提交按钮发送
   - 等待直到助手回复出现（最长 30 秒）
   - 等待 1 秒
3. 消息列表:
   - "我叫 Alice"
   - "我叫什么名字？"

## 验证
- 第二轮对话中助手应能回答 "Alice"
- 请在 Langfuse 中验证 session_id 关联的对话历史

---

### 测试用例 TC-004: 错误场景捕获

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框，输入 "请调用 tool_does_not_exist 工具"
3. 点击提交按钮发送
4. 等待直到助手回复出现（最长 30 秒）

## 验证
- 页面应显示助手回复（可能包含错误信息）
- 请在 Langfuse 中验证错误状态的 Span (level=ERROR)

---

### 测试用例 TC-005: 验证 RAG 检索追踪

> 注意: 需要智能体配置了知识库

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框，输入 "请从知识库中查询相关信息"
3. 点击提交按钮发送
4. 等待直到助手回复出现（最长 30 秒）

## 验证
- 请在 Langfuse 中验证 rag_retrieve Span 已创建

---

### 测试用例 TC-006: 验证 Token 使用量记录

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框，输入 "请生成一段较长的文本，至少200字"
3. 点击提交按钮发送
4. 等待直到助手回复出现（最长 30 秒）

## 验证
- 助手回复内容长度应大于 200 字符
- 请在 Langfuse 中验证 LLM Span 的 usage 字段

---

### 测试用例 TC-007: 验证性能元数据 (duration_ms)

## 步骤
1. 访问 `http://localhost:20880/stream/agents/demo/chat`，等待页面加载完成
2. 在 snapshot 中找到聊天输入框，输入 "当前时间是什么时候？"
3. 点击提交按钮发送
4. 等待直到助手回复出现（最长 30 秒）

## 验证
- 请在 Langfuse 中验证 Span 的 duration_ms 字段

---

### 测试用例 UI-001: 检查 Trace 列表页面

## 步骤
1. 访问 `http://localhost:3000`（Langfuse 首页）
2. 如果出现登录按钮（Sign in），需要先配置 Langfuse 登录信息
3. 导航到 `http://localhost:3000/traces`，等待页面加载完成

## 验证
- Trace 列表页面应可正常访问

---

### 测试用例 UI-002: 检查 Trace 详情页面的树状结构

## 步骤
1. 导航到 `http://localhost:3000/traces`，等待页面加载完成
2. 在 snapshot 中找到第一个 Trace 项目（`[data-testid="trace-item"]`），点击
3. 等待页面加载完成

## 验证
- Trace 详情页面应显示 Span 树状结构
- 如果没有 Trace 可显示，需先运行对话测试用例
