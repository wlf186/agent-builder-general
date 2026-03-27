# Langfuse API Key 创建

> 来源: `frontend/tests/langfuse-create-key.spec.ts`
> 复杂度: medium

## 前置条件
- Langfuse 服务运行在 localhost:3000
- Langfuse 账号已注册（邮箱: demo@agent-builder.local，密码: Demo@123456）

## 步骤
1. 打开 Langfuse 登录页面 http://localhost:3000/auth/sign-in
2. 等待 2 秒
3. 在邮箱输入框输入 "demo@agent-builder.local"
4. 在密码输入框输入 "Demo@123456"
5. 点击提交按钮
6. 等待 5 秒

### 处理可能的 Onboarding 流程
7. 检查当前 URL，如果包含 "onboarding" 或等于 http://localhost:3000/，则进入 onboarding:
   - 在第一个输入框中输入组织名称 "Demo Organization"
   - 点击 "Continue" 或提交按钮
   - 等待 3 秒
   - 在第一个输入框中输入项目名称 "Agent Builder Demo"
   - 点击 "Create" 或提交按钮
   - 等待 3 秒

### 导航到 API Keys 页面
8. 打开 http://localhost:3000/project/1/settings/general
9. 等待 3 秒
10. 截图保存到 test-results/cli/langfuse-project-settings.png
11. 查找并点击 "API Keys" 链接（导航中包含 "API Keys" 或 "Keys" 文字的链接）
12. 如果找不到链接，直接打开 http://localhost:3000/project/1/settings/api-keys
13. 等待 3 秒
14. 截图保存到 test-results/cli/langfuse-api-keys-page.png

### 检查和创建 API Key
15. 检查页面是否已有 API Key（code/pre 元素）
16. 如果找到创建按钮（包含 "Create"、"New" 或 "Add" 文字），点击它
17. 等待 2 秒
18. 在名称输入框中输入 "Agent Builder Key"
19. 点击提交按钮
20. 等待 3 秒
21. 截图保存到 test-results/cli/langfuse-new-key.png

## 验证
- API Keys 页面可正常访问
- 新的 API Key 成功创建
- Public Key 格式: pk-lf-xxxxx
- Secret Key 格式: sk-lf-xxxxx
