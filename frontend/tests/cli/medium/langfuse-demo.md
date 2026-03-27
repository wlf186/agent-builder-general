# Langfuse Tracing 演示（自动注册）

> 来源: `frontend/tests/langfuse-demo.spec.ts`
> 复杂度: medium

## 前置条件
- Agent Builder 服务已启动 (localhost:20880)
- Langfuse 服务运行在 localhost:3000

> 注意: 此脚本会同时操作两个浏览器窗口（Agent Builder 和 Langfuse）。

## 步骤

### 窗口 1: Agent Builder 发送消息
1. 打开 http://localhost:20880
2. 等待 2 秒
3. 点击页面上的第一个标题（h3 或 h2），进入智能体聊天界面
4. 等待 2 秒
5. 在聊天输入框（`input[type="text"][placeholder]`）中输入 "Langfuse 测试消息 {当前时间}"
6. 等待 0.5 秒
7. 如果存在发送按钮（`button[type="submit"]`、包含 "发送" 或 "Send" 文字），点击它；否则按 Enter
8. 等待 10 秒让 AI 完成响应
9. 截图保存到 test-results/cli/agent-builder-message.png

### 窗口 2: Langfuse 查看追踪
10. 打开 http://localhost:3000
11. 等待 2 秒
12. 检查当前 URL:
    - 如果包含 "sign"、"auth" 或 "login"，则需要登录/注册:
      - 查找并点击 "Sign up" 或 "Register" 链接
      - 等待 1 秒
      - 在邮箱输入框输入 "{timestamp}@localhost.dev"
      - 在密码输入框输入 "DemoPass123!"
      - 如果存在第二个密码输入框（确认密码），同样输入 "DemoPass123!"
      - 点击提交按钮（"Sign" 或 "Register"）
      - 等待 5 秒
13. 截图保存到 test-results/cli/langfuse-current.png

## 验证
- Agent Builder 消息已发送且 AI 有响应
- Langfuse 页面可正常访问（可能需要手动完成登录/注册）
- 可在 Langfuse Traces 页面查看追踪链路
