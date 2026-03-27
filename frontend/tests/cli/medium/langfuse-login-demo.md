# Langfuse 登录演示

> 来源: `frontend/tests/langfuse-login-demo.spec.ts`
> 复杂度: medium
> 模式: headed（playwright-cli 默认 headed，兼容）

## 前置条件
- Langfuse 服务运行在 localhost:3000
- Langfuse 管理员账号: admin@langfuse.local / LangfuseAdmin123!

## 步骤
1. 打开 http://localhost:3000/auth/sign-in
2. 等待页面加载完成
3. 滚动到页面顶部触发浏览器重绘（修复 X11 远程投屏渲染问题）
4. 等待 0.1 秒
5. 等待 3 秒

### 等待登录表单加载
6. 等待邮箱输入框（`input[type="email"]`）可见（最多等待 15 秒）
7. 截图保存到 test-results/cli/langfuse-login-01-page.png

### 填写登录信息
8. 在邮箱输入框中输入 "admin@langfuse.local"
9. 在密码输入框（`input[type="password"]`）中输入 "LangfuseAdmin123!"
10. 截图保存到 test-results/cli/langfuse-login-02-form-filled.png

### 点击登录按钮
11. 等待 "Sign in" 按钮可见（最多等待 10 秒）
12. 点击 "Sign in" 按钮

### 等待登录结果
13. 等待 URL 变化（不再包含 "sign-in"），最多等待 15 秒
14. 等待 3 秒
15. 记录最终 URL 和页面标题
16. 截图保存到 test-results/cli/langfuse-login-03-result.png
17. 等待 5 秒便于观察

## 验证
- 登录成功: URL 不再包含 "sign-in" 且页面不包含 "Invalid"、"Error"、"incorrect" 等错误文字
- 登录失败: 页面包含 "Invalid"、"Error" 或 "incorrect" 文字
- 登录状态未知: URL 未变化且无错误文字
