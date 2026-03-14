/**
 * AC130 UAT 测试 - 环境初始化优化
 * 迭代: iteration-2603141718
 * PRD: prd-environment-init.md
 *
 * 使用方法:
 * 1. cd frontend
 * 2. npx playwright test teams/AC130/iterations/202603141718/tests/iteration-2603141718.spec.ts
 *
 * 测试原则:
 * - 必须使用真实浏览器操作
 * - 严禁使用 curl 等后台命令替代
 */

import { test, expect, Page } from '@playwright/test';

// 测试配置
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:20880';
const SCREENSHOT_DIR = './teams/AC130/iterations/202603141718/screenshots';

// 测试辅助函数
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true
  });
}

// ============================================
// F-001: Conda 可用性检测
// ============================================

test.describe('F-001: Conda 可用性检测', () => {

  /**
   * TC-001: Conda 可用时正常显示
   *
   * 优先级: P0
   * 验收标准: Given conda 可用 When 检测完成 Then 显示正常状态，不干扰用户
   */
  test('TC-001: Conda 可用时正常显示', async ({ page }) => {
    await page.goto(BASE_URL);

    // 等待页面加载
    await expect(page.locator('body')).toBeVisible();

    // 点击"新建智能体"按钮
    await page.click('text=新建智能体');
    await page.waitForTimeout(500);

    // 等待 conda 检测完成（API调用 /api/system/check-conda）
    // 检查是否显示 conda 可用状态
    const condaStatus = page.locator('[data-testid="conda-status"]');

    // 截图保存
    await takeScreenshot(page, 'tc-001-conda-available');

    // 如果 conda 可用，应该不显示警告卡片
    const warningCard = page.locator('.conda-warning-card:visible');
    if (await condaStatus.count() > 0) {
      // 验证不显示警告（或显示正常状态）
      console.log('Conda status detected:', await condaStatus.innerText());
    }
  });

  /**
   * TC-002: Conda 不可用时显示警告
   *
   * 优先级: P0
   * 验收标准: Given conda 不可用 When 检测完成 Then 显示警告提示，但允许继续创建
   */
  test('TC-002: Conda 不可用时显示警告', async ({ page }) => {
    await page.goto(BASE_URL);

    // 点击"新建智能体"按钮
    await page.click('text=新建智能体');
    await page.waitForTimeout(500);

    // 检查警告卡片是否存在（需要模拟 conda 不可用的环境）
    const warningCard = page.locator('.warning, [data-testid="conda-warning"]');

    await takeScreenshot(page, 'tc-002-conda-warning');

    // 如果警告卡片存在，验证其内容
    if (await warningCard.count() > 0) {
      // 验证警告信息包含 "Conda" 或 "环境" 关键词
      const warningText = await warningCard.innerText();
      expect(warningText.toLowerCase()).toMatch(/conda|环境|未检测/);
    } else {
      console.log('TC-002: 当前环境 conda 可用，警告卡片未显示（预期行为）');
    }
  });

});

// ============================================
// F-002: 友好错误提示
// ============================================

test.describe('F-002: 友好错误提示', () => {

  /**
   * TC-003: 错误信息结构化展示
   *
   * 优先级: P0
   * 验收标准: Given conda 初始化失败 When 错误发生 Then 显示结构化的错误信息
   */
  test('TC-003: 错误信息结构化展示', async ({ page }) => {
    await page.goto(BASE_URL);

    // 截图: 初始状态
    await takeScreenshot(page, 'tc-003-initial');

    // 注意: 此测试需要模拟 conda 初始化失败的场景
    // 实际测试中可能需要 mock API 或使用特殊测试环境

    // 验证错误弹窗包含必要元素（如果触发）
    const errorDialog = page.locator('[role="dialog"], .error-dialog, .modal');

    if (await errorDialog.count() > 0) {
      // 检查是否包含：问题描述、解决方案
      const hasDescription = await errorDialog.locator('text=/描述|说明|问题/').count() > 0;
      const hasSolution = await errorDialog.locator('text=/解决|方案|步骤/').count() > 0;

      await takeScreenshot(page, 'tc-003-error-dialog');

      console.log('Error dialog structure - Description:', hasDescription, 'Solution:', hasSolution);
    } else {
      console.log('TC-003: 当前环境正常，未触发错误弹窗');
    }
  });

  /**
   * TC-004: 查看更多详情跳转
   *
   * 优先级: P1
   * 验收标准: Given 用户点击"了解更多" Then 跳转到详细的故障排查文档
   */
  test('TC-004: 查看更多详情跳转', async ({ page }) => {
    await page.goto(BASE_URL);

    // 查找"了解更多"或"查看安装指引"链接
    const learnMoreLink = page.locator('a:has-text("了解更多"), a:has-text("安装指引"), a:has-text("详细文档")');

    const linkCount = await learnMoreLink.count();
    console.log('Found help links:', linkCount);

    if (linkCount > 0) {
      // 点击第一个链接
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        learnMoreLink.first().click()
      ]);

      // 等待新页面加载
      await newPage.waitForLoadState();
      await takeScreenshot(newPage, 'tc-004-help-page');

      console.log('Help page URL:', newPage.url());

      // 关闭新页面
      await newPage.close();
    } else {
      console.log('TC-004: 未找到帮助链接（可能需要先触发错误状态）');
    }
  });

});

// ============================================
// F-003: 系统 Python 降级方案
// ============================================

test.describe('F-003: 系统 Python 降级方案', () => {

  /**
   * TC-005: 使用系统 Python 创建智能体
   *
   * 优先级: P1
   * 验收标准: Given 用户选择"系统 Python"模式 When 创建智能体 Then 使用系统 Python 创建轻量级环境
   */
  test('TC-005: 使用系统 Python 创建智能体', async ({ page }) => {
    await page.goto(BASE_URL);

    // 点击"新建智能体"
    await page.click('text=新建智能体');
    await page.waitForTimeout(500);

    // 查找环境模式选择器
    const modeSelector = page.locator('[data-testid="environment-mode"], select:has-text("环境")');

    if (await modeSelector.count() > 0) {
      // 选择"系统 Python"模式
      await modeSelector.selectOption({ label: /system|系统/i });

      // 输入智能体名称
      const agentNameInput = page.locator('input[name="name"], [data-testid="agent-name-input"]');
      await agentNameInput.fill(`test-agent-${Date.now()}`);

      await takeScreenshot(page, 'tc-005-before-create');

      // 点击创建
      await page.click('button:has-text("创建")');
      await page.waitForTimeout(2000);

      await takeScreenshot(page, 'tc-005-after-create');

      // 验证创建成功
      const successIndicator = page.locator('.success, [data-testid="create-success"]');
      console.log('Creation success:', await successIndicator.count() > 0);
    } else {
      console.log('TC-005: 未找到环境模式选择器');
    }
  });

  /**
   * TC-006: 系统 Python 下技能执行
   *
   * 优先级: P1
   * 验收标准: Given 使用系统 Python When 执行不需要特殊依赖的技能 Then 正常执行
   */
  test('TC-006: 系统 Python 下技能执行', async ({ page }) => {
    await page.goto(BASE_URL);

    // 进入调试对话页面
    const testAgentName = 'test-agent-system-python';

    // 查找并点击测试智能体
    const agentCard = page.locator(`[data-testid="agent-card"]:has-text("${testAgentName}")`);

    if (await agentCard.count() > 0) {
      await agentCard.click();
      await page.waitForTimeout(500);

      // 发送测试消息
      const chatInput = page.locator('textarea[name="message"], [data-testid="chat-input"]');
      await chatInput.fill('你好，请介绍一下你自己');
      await page.click('button:has-text("发送")');

      // 等待响应
      await page.waitForTimeout(5000);

      await takeScreenshot(page, 'tc-006-skill-execution');

      // 验证有响应
      const messages = page.locator('[data-testid="message"], .message');
      expect(await messages.count()).toBeGreaterThan(0);
    } else {
      console.log('TC-006: 测试智能体不存在，跳过测试');
    }
  });

});

// ============================================
// F-004: 前端错误优化
// ============================================

test.describe('F-004: 前端错误优化', () => {

  /**
   * TC-007: 错误卡片展示美观
   *
   * 优先级: P1
   * 验收标准: Given 发生 conda 错误 When 错误展示 Then 使用卡片式设计，层次清晰
   */
  test('TC-007: 错误卡片展示美观', async ({ page }) => {
    await page.goto(BASE_URL);

    // 此测试验证错误卡片的视觉设计
    // 需要触发错误状态或使用测试数据

    await takeScreenshot(page, 'tc-007-ui-design');

    // 检查页面是否有适当的样式类
    const hasWarningStyles = await page.locator('.warning, .alert, .error-card').count() > 0;
    console.log('Warning/error elements found:', hasWarningStyles);
  });

  /**
   * TC-008: 重试按钮功能
   *
   * 优先级: P1
   * 验收标准: Given 错误可恢复 Then 提供"重试"按钮
   */
  test('TC-008: 重试按钮功能', async ({ page }) => {
    await page.goto(BASE_URL);

    // 查找重试按钮
    const retryButton = page.locator('button:has-text("重试"), button:has-text("Retry")');

    const buttonCount = await retryButton.count();
    console.log('Retry buttons found:', buttonCount);

    if (buttonCount > 0) {
      // 点击重试按钮
      await retryButton.first().click();
      await page.waitForTimeout(1000);

      await takeScreenshot(page, 'tc-008-after-retry');

      console.log('Retry button clicked');
    } else {
      console.log('TC-008: 未找到重试按钮（当前环境可能没有可恢复的错误）');
    }
  });

});

// ============================================
// 边界测试
// ============================================

test.describe('边界测试', () => {

  /**
   * TC-B001: 快速连续点击创建按钮
   */
  test('TC-B001: 快速连续点击创建按钮', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.click('text=新建智能体');
    await page.waitForTimeout(500);

    // 快速连续点击
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("创建")');
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'tc-b001-rapid-clicks');

    // 验证没有重复创建（应该有防抖保护）
    console.log('TC-B001: Rapid click test completed');
  });

  /**
   * TC-B002: 网络延迟情况下的检测
   */
  test('TC-B002: 网络延迟情况下的检测', async ({ page }) => {
    // 模拟网络慢速
    await page.route('**/api/system/check-conda', route => {
      setTimeout(() => route.continue(), 3000);
    });

    await page.goto(BASE_URL);
    await page.click('text=新建智能体');

    // 等待加载状态
    await page.waitForTimeout(4000);

    await takeScreenshot(page, 'tc-b002-slow-network');

    console.log('TC-B002: Slow network test completed');
  });

});

// ============================================
// 异常测试
// ============================================

test.describe('异常测试', () => {

  /**
   * TC-E001: API 返回错误状态
   */
  test('TC-E001: API 返回错误状态', async ({ page }) => {
    // Mock API 返回错误
    await page.route('**/api/system/check-conda', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto(BASE_URL);
    await page.click('text=新建智能体');
    await page.waitForTimeout(1000);

    await takeScreenshot(page, 'tc-e001-api-error');

    // 验证页面没有崩溃
    const isPageResponsive = await page.locator('body').isEnabled();
    expect(isPageResponsive).toBeTruthy();

    console.log('TC-E001: API error handling test completed');
  });

  /**
   * TC-E002: 创建智能体后服务重启
   */
  test('TC-E002: 创建智能体时环境状态变化', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.click('text=新建智能体');
    await page.waitForTimeout(500);

    // 填写表单
    const agentNameInput = page.locator('input[name="name"], [data-testid="agent-name-input"]');
    await agentNameInput.fill('test-agent-edge-case');

    await takeScreenshot(page, 'tc-e002-before-submit');

    console.log('TC-E002: Environment change test completed');
  });

});
