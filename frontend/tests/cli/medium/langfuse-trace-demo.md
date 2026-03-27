# Langfuse Tracing 演示

> 来源: `frontend/tests/langfuse-trace-demo.spec.ts`
> 复杂度: medium

## 前置条件
- Agent Builder 服务已启动 (localhost:20880)
- Langfuse 服务运行在 localhost:3000
- Langfuse 账号已注册（邮箱: demo@agent-builder.local，密码: Demo@123456）

## 步骤
1. 打开 Agent Builder http://localhost:20880
2. 等待 2 秒
3. 点击页面上的第一个标题（h3 或 h2），进入智能体聊天界面
4. 等待 2 秒
5. 在聊天输入框（`input[type="text"][placeholder]`）中输入 "计算 123 + 456 等于多少？"
6. 等待 0.5 秒
7. 如果存在发送按钮（`button[type="submit"]` 或包含 "发送" 文字），点击它；否则按 Enter
8. 等待 15 秒让 AI 完成响应
9. 截图保存到 test-results/cli/demo-agent-response.png
10. 打开 Langfuse 登录页面 http://localhost:3000/auth/sign-in
11. 等待 2 秒
12. 在邮箱输入框输入 "demo@agent-builder.local"
13. 在密码输入框输入 "Demo@123456"
14. 点击提交按钮
15. 等待 5 秒
16. 导航到 http://localhost:3000/traces
17. 等待 3 秒
18. 截图保存到 test-results/cli/demo-langfuse-traces.png

## 验证
- Agent Builder 消息已发送且 AI 有响应
- Langfuse Traces 页面可正常访问
- 可在 Langfuse 中查看对应的追踪链路
