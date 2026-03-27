# UAT - Conda 环境检测

> 来源: `frontend/tests/uat-condacheck.spec.ts`
> 复杂度: medium

## 前置条件
- 服务已启动 (localhost:20880, 后端 localhost:20881)

## 步骤

### 测试用例 1: Conda 检测 API 返回正确结构
1. 发送 GET 请求到 http://localhost:20881/api/system/check-conda
2. 检查响应状态码为 200
3. 解析 JSON 响应

### 测试用例 2: 新建智能体页面显示 Conda 警告
4. 打开 http://localhost:20880
5. 等待页面加载完成
6. 点击 "新建" 或 "Create" 按钮
7. 等待 2 秒
8. 截图保存到 test-results/cli/uat-condacheck-02-warning.png

### 测试用例 3: 点击查看解决方案显示错误弹窗
9. 打开 http://localhost:20880
10. 等待页面加载完成
11. 点击 "新建" 或 "Create" 按钮
12. 等待 2 秒
13. 查找并点击 "查看解决方案" 链接/按钮
14. 等待 0.5 秒
15. 截图保存到 test-results/cli/uat-condacheck-03-dialog.png

## 验证

### 测试用例 1 验证:
- API 响应 JSON 包含以下字段: `available`, `path`, `version`, `error`, `message`
- `available` 应为 `false`（当前环境没有 conda）
- `error` 应为 `"CONDA_NOT_FOUND"`

### 测试用例 2 验证:
- 页面上显示 "Conda 环境未检测到" 警告文字

### 测试用例 3 验证:
- 弹窗显示 "环境初始化失败" 文字
- 如果 "查看解决方案" 按钮不可见则跳过此用例
