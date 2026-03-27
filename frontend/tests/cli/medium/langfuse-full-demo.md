# Langfuse Full Demo

> 来源: `frontend/tests/langfuse-full-demo.spec.ts`
> 复杂度: medium

## 前置条件
- Agent Builder 服务已启动 (localhost:20880)
- Langfuse 服务运行在 localhost:3000
- Langfuse 测试账号: demo@agent-builder.local / Demo@123456

> 注意: 此脚本需要同时操作两个浏览器窗口（Agent Builder 和 Langfuse）。

## 步骤

### 窗口 1: Agent Builder 发送消息
1. 打开 http://localhost:20880
2. 等待 2 秒
3. 点击页面上的第一个标题（h3 或 h2），进入智能体聊天界面
4. 等待 2 秒
5. 在聊天输入框（`input[type="text"][placeholder]`）中输入 "计算 25 + 17 等于多少？"
6. 等待 0.5 秒
7. 如果存在发送按钮（`button[type="submit"]`、包含 "发送" 文字），点击它；否则按 Enter
8. 等待 15 秒让 AI 完成响应
9. 截图保存到 test-results/cli/langfuse-full-agent-response.png

### 窗口 2: Langfuse 登录
10. 打开 http://localhost:3000/auth/sign-in
11. 等待 2 秒
12. 在邮箱输入框（`input[type="email"]` 或 `input[name="email"]`）中输入 "demo@agent-builder.local"
13. 在密码输入框（`input[type="password"]`）中输入 "Demo@123456"
14. 点击登录按钮（`button[type="submit"]` 或包含 "Sign in" 文字）
15. 等待 5 秒
16. 截图保存到 test-results/cli/langfuse-full-logged-in.png

### 窗口 2: 完成 Onboarding（如需要）
17. 检查当前 URL:
    - 如果包含 "onboarding"，则需要完成引导流程:
      - 在组织名称输入框中输入 "Demo Organization"
      - 点击 "Continue" 或 "Create" 按钮
      - 等待 3 秒
      - 在项目名称输入框中输入 "Agent Builder Demo"
      - 点击 "Create" 按钮
      - 等待 3 秒

### 窗口 2: 查看 Traces
18. 等待 2 秒
19. 查找并点击 Traces 链接（`a:has-text("Traces")` 或 `nav a[href*="traces"]`）
20. 如果找不到 Traces 链接，直接访问 http://localhost:3000/traces
21. 等待 3 秒
22. 截图保存到 test-results/cli/langfuse-full-traces.png

## 验证
- Agent Builder 消息已发送且 AI 有响应
- Langfuse 登录成功（URL 不再包含 sign-in）
- Langfuse Traces 页面可正常显示
