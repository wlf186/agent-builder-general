# 文档站导航演示

> 来源: `frontend/tests/demo-docs-nav.spec.ts`
> 复杂度: simple

## 前置条件
- 文档站已启动 (localhost:5173)

## 步骤
1. 打开 http://localhost:5173/en/
2. 等待页面加载
3. 截图保存到 test-results/cli/docs-nav-01-home.png
4. snapshot 找到 "Get Started" 按钮，点击它
5. 等待页面加载，截图保存到 test-results/cli/docs-nav-02-get-started.png
6. 返回首页 http://localhost:5173/en/
7. snapshot 找到 "Core Features" 按钮，点击它
8. 等待页面加载，截图保存到 test-results/cli/docs-nav-03-core-features.png

## 验证
- "Get Started" 点击后跳转到正确的文档页
- "Core Features" 点击后跳转到正确的文档页
- 两个截图都成功保存
