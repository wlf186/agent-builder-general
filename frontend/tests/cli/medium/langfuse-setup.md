# Langfuse Setup - 创建账号和 API Keys

> 来源: `frontend/tests/langfuse-setup.spec.ts`
> 复杂度: medium

## 前置条件
- Langfuse 服务运行在 localhost:3000
- Langfuse 管理员账号: admin@langfuse.local / LangfuseAdmin123!

## 步骤
1. 打开 http://localhost:3000
2. 等待页面加载完成
3. 等待 2 秒
4. 截图保存到 test-results/cli/langfuse-setup-01-home.png

### 登录
5. 查找并点击 "Sign in" 链接
6. 等待页面加载完成，等待 2 秒
7. 截图保存到 test-results/cli/langfuse-setup-02-signin.png
8. 在邮箱输入框（`input[type="email"]` 或 name 包含 email 的输入框）中输入 "admin@langfuse.local"
9. 在密码输入框（`input[type="password"]`）中输入 "LangfuseAdmin123!"
10. 截图保存到 test-results/cli/langfuse-setup-03-filled.png
11. 点击提交按钮（包含 "Sign in" 或 "Continue" 文字，或 `button[type="submit"]`）
12. 等待页面加载完成
13. 等待 5 秒
14. 截图保存到 test-results/cli/langfuse-setup-04-after-submit.png

### 完成 Onboarding（如需要）
15. 查找项目名称输入框（name 包含 project 或 placeholder 包含 project 的输入框）
16. 如果存在，输入 "Agent Builder" 并截图保存到 test-results/cli/langfuse-setup-05-onboarding.png
17. 点击 "Continue" 或 "Create" 按钮
18. 等待页面加载完成，等待 3 秒
19. 截图保存到 test-results/cli/langfuse-setup-06-project-created.png

### 导航到 Settings
20. 查找并点击 "Settings" 链接
21. 等待页面加载完成，等待 2 秒
22. 截图保存到 test-results/cli/langfuse-setup-07-settings.png

### 导航到 API Keys
23. 查找并点击 "API Keys" 链接
24. 等待页面加载完成，等待 2 秒
25. 截图保存到 test-results/cli/langfuse-setup-08-apikeys.png

### 创建 API Key
26. 查找并点击 "Create" 或 "New" 或 "Generate" 按钮
27. 等待页面加载完成，等待 3 秒
28. 截图保存到 test-results/cli/langfuse-setup-09-newkey.png
29. 等待 5 秒

## 验证
- Langfuse 登录成功
- API Keys 页面可正常显示
- 页面上应显示 pk-lf- 开头的 Public Key 和 sk-lf- 开头的 Secret Key
- 记录下这两个 Key 的值
