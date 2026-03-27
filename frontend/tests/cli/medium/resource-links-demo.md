# 资源链接跳转测试

> 来源: `frontend/tests/resource-links-demo.spec.ts`
> 复杂度: medium
> 模式: headed（playwright-cli 默认 headed，兼容）

## 前置条件
- 服务已启动 (localhost:20880)
- Langfuse 服务运行在 localhost:3000（可选，用于链接验证）

## 步骤

### 测试用例 1: 检查主页链接是否存在
1. 打开 http://localhost:20880
2. 等待页面加载完成
3. 滚动到页面顶部触发浏览器重绘（修复 X11 远程投屏渲染问题）
4. 等待 0.1 秒
5. 截图保存到 test-results/cli/resource-links-01-home.png

#### 检查用户手册链接
6. 查找用户手册链接（`a[href="/docs"]`），确认可见
7. 检查其 href 属性为 "/docs"，target 属性

#### 检查 Langfuse 链接
8. 查找 Langfuse 链接（`a[href="/langfuse"]`），确认可见
9. 检查其 href 属性为 "/langfuse"，target 属性

### 测试用例 2: 直接访问 /docs 路径验证代理
10. 访问 http://localhost:20880/docs
11. 等待页面加载完成
12. 截图保存到 test-results/cli/resource-links-02-docs-page.png
13. 等待 2 秒

### 测试用例 3: 直接访问 /langfuse 路径验证代理
14. 访问 http://localhost:20880/langfuse
15. 等待页面加载完成
16. 截图保存到 test-results/cli/resource-links-03-langfuse-page.png
17. 等待 2 秒

### 测试用例 4: 完整演示 - 点击链接测试
18. 打开 http://localhost:20880
19. 等待页面加载完成

#### 点击用户手册链接
20. 查找用户手册链接（`a[href="/docs"]`），确认可见
21. 点击链接（会在新标签页中打开）
22. 等待新页面加载完成
23. 截图保存到 test-results/cli/resource-links-04-docs-click.png
24. 等待 3 秒，关闭新标签页

#### 点击 Langfuse 链接
25. 返回主页，查找 Langfuse 链接（`a[href="http://localhost:3000"]`），确认可见
26. 点击链接（会在新标签页中打开）
27. 等待新页面加载完成（可能超时，不影响测试）
28. 截图保存到 test-results/cli/resource-links-05-langfuse-click.png
29. 等待 3 秒，关闭新标签页

## 验证

### 测试用例 1 验证:
- 用户手册链接（href="/docs"）在主页上可见
- Langfuse 链接（href="/langfuse"）在主页上可见

### 测试用例 2 验证:
- /docs 路径返回状态码 200 或 304（代理工作正常）
- 如果返回 404，说明代理目标（文档站）可能未启动

### 测试用例 3 验证:
- /langfuse 路径返回状态码 200 或 304（代理工作正常）
- 页面内容包含 "Langfuse" 或 "Observability" 关键字
- 如果返回 502/503/504，说明代理目标（Langfuse）服务不可用

### 测试用例 4 验证:
- 点击用户手册链接后新标签页正常打开
- 点击 Langfuse 链接后新标签页正常打开
