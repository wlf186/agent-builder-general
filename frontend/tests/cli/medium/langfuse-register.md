# Langfuse 注册

> 来源: `frontend/tests/langfuse-register.spec.ts`
> 复杂度: medium

## 前置条件
- Langfuse 服务运行在 localhost:3000

## 步骤
1. 打开 http://localhost:3000/en/auth/sign-up
2. 等待 2 秒
3. 截图保存到 test-results/cli/langfuse-signup-page.png
4. 找到并填写姓名输入框，输入 "Demo User"
5. 找到并填写邮箱输入框，输入 "demo@agent-builder.local"
6. 对每个密码输入框（可能有多个），输入 "Demo@123456"
7. 点击注册按钮（包含 "Sign up"、"Create" 或 "Register" 文字的按钮）
8. 等待 5 秒
9. 截图保存到 test-results/cli/langfuse-after-register.png

## 验证
- 注册后 URL 包含 "onboarding" 或不再包含 "auth" 则注册成功
- 如果仍在认证页面，可能需要额外步骤
