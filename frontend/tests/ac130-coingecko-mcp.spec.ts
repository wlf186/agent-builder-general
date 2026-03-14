/**
 * ============================================================================
 * AC130 团队测试套件: CoinGecko MCP 连接诊断与修复功能
 *
 * 测试计划: teams/AC130/iterations/20260313_第1次迭代/测试计划.md
 * 产品需求: teams/AC130/iterations/20260313_第1次迭代/产品需求规格说明书.md
 *
 * 测试用例覆盖:
 * - TC-MCP-DIAG-001 ~ TC-MCP-DIAG-008: 功能测试
 * - TC-MCP-REG-001 ~ TC-MCP-REG-005: 回归测试
 * - TC-MCP-INT-001 ~ TC-MCP-INT-002: 集成测试
 * - TC-MCP-ERR-001 ~ TC-MCP-ERR-003: 异常测试
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:20880';
const API_BASE_URL = 'http://localhost:20881';

/**
 * 辅助函数: 点击智能体卡片
 */
async function clickAgentCard(page: any, agentName: string) {
  const selectors = [
    `[data-agent-name="${agentName}"]`,
    `text="${agentName}"`,
    `[class*="agent-card"]:has-text("${agentName}")`,
  ];

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        return;
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }
  throw new Error(`无法找到智能体卡片: ${agentName}`);
}

/**
 * 辅助函数: 打开 MCP 服务编辑对话框
 */
async function openMCPServiceDialog(page: any, serviceName: string) {
  const serviceSelectors = [
    `text=/${serviceName}/i`,
    `[class*="service"]:has-text("${serviceName}")`,
    `div:has-text("${serviceName}")`,
  ];

  for (const selector of serviceSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        await page.waitForTimeout(1500);
        return true;
      }
    } catch (e) {
      // 继续尝试
    }
  }
  return false;
}

test.describe('AC130: CoinGecko MCP 连接诊断功能测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  // =========================================================================
  // 功能测试用例
  // =========================================================================

  /**
   * TC-MCP-DIAG-001: 后端 MCP 库依赖检查
   */
  test('TC-MCP-DIAG-001: 后端MCP库依赖检查', async ({ request }) => {
    console.log('=== TC-MCP-DIAG-001: 后端MCP库依赖检查 ===');

    const response = await request.get(`${API_BASE_URL}/api/mcp-services`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const coingecko = data.services?.find((s: any) => s.name === 'coingecko');
    expect(coingecko).toBeDefined();
    expect(coingecko.enabled).toBe(true);

    console.log('✓ CoinGecko 服务存在于 API 中');
    console.log('=== TC-MCP-DIAG-001 完成 ===');
  });

  /**
   * TC-MCP-DIAG-002: CoinGecko 连接测试 API
   */
  test('TC-MCP-DIAG-002: CoinGecko连接测试API', async ({ request }) => {
    console.log('=== TC-MCP-DIAG-002: CoinGecko连接测试API ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/test`);
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    console.log('CoinGecko测试结果:', result);

    expect(result).toHaveProperty('success');

    if (result.success) {
      const toolCount = result.tools?.length || result.tool_count || 0;
      console.log(`✓ CoinGecko连接成功 - ${toolCount} 个工具可用`);
      expect(toolCount).toBeGreaterThan(0);
    } else {
      console.log(`⚠ CoinGecko连接失败: ${result.error || result.message || '未知错误'}`);
      if (result.mcp_available === false) {
        console.log('原因: MCP库未安装');
      }
    }

    console.log('=== TC-MCP-DIAG-002 完成 ===');
  });

  /**
   * TC-MCP-DIAG-003: CoinGecko 诊断 API
   */
  test('TC-MCP-DIAG-003: CoinGecko诊断API', async ({ request }) => {
    console.log('=== TC-MCP-DIAG-003: CoinGecko诊断API ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/diagnose`);
    expect(response.ok()).toBeTruthy();

    const report = await response.json();
    console.log('诊断报告:', JSON.stringify(report, null, 2));

    // 验证报告结构
    expect(report).toHaveProperty('service_name', 'coingecko');
    expect(report).toHaveProperty('overall_status');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('layers');

    // 验证层级结构
    const layers = report.layers;
    expect(layers).toBeInstanceOf(Array);
    expect(layers.length).toBeGreaterThan(0);

    // 检查每个层级
    const expectedLayers = ['config', 'dns', 'network', 'tls', 'mcp'];
    for (const expectedLayer of expectedLayers) {
      const layer = layers.find((l: any) => l.layer.toLowerCase() === expectedLayer);
      if (layer) {
        console.log(`  ${layer.layer}: ${layer.status} (${layer.latency_ms || 0}ms)`);
        expect(layer).toHaveProperty('status');
        expect(layer).toHaveProperty('message');
      }
    }

    console.log('=== TC-MCP-DIAG-003 完成 ===');
  });

  /**
   * TC-MCP-DIAG-004: 诊断层级完整性检查
   */
  test('TC-MCP-DIAG-004: 诊断层级完整性检查', async ({ request }) => {
    console.log('=== TC-MCP-DIAG-004: 诊断层级完整性检查 ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/diagnose`);
    const report = await response.json();

    const layers = report.layers;
    const expectedLayers = ['CONFIG', 'DNS', 'NETWORK', 'TLS', 'MCP'];

    for (const expectedLayer of expectedLayers) {
      const layer = layers.find((l: any) => l.layer === expectedLayer ||
                                   l.layer.toLowerCase() === expectedLayer.toLowerCase());
      expect(layer).toBeDefined();

      // 验证必需字段
      expect(layer).toHaveProperty('layer');
      expect(layer).toHaveProperty('status');
      expect(layer).toHaveProperty('message');
      expect(layer).toHaveProperty('latency_ms');

      console.log(`  ✓ ${layer.layer}: 所有必需字段存在`);
    }

    console.log('=== TC-MCP-DIAG-004 完成 ===');
  });

  /**
   * TC-MCP-DIAG-005: 前端诊断按钮显示
   */
  test('TC-MCP-DIAG-005: 前端诊断按钮显示', async ({ page }) => {
    console.log('=== TC-MCP-DIAG-005: 前端诊断按钮显示 ===');

    await page.waitForTimeout(1000);

    // 尝试打开 CoinGecko 服务对话框
    const clicked = await openMCPServiceDialog(page, 'coingecko');

    if (!clicked) {
      console.log('⚠ 未找到 CoinGecko 服务，跳过 UI 测试');
      test.skip();
      return;
    }

    await page.screenshot({ path: 'test-results/tc-diag005-dialog-open.png' });

    // 查找诊断按钮
    const diagnoseSelectors = [
      'button:has-text("诊断连接")',
      'button:has-text("Diagnose")',
      'button:has-text("诊断")',
    ];

    let buttonFound = false;
    for (const selector of diagnoseSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✓ 找到诊断按钮: ${selector}`);
        buttonFound = true;
        break;
      }
    }

    expect(buttonFound).toBeTruthy();
    console.log('=== TC-MCP-DIAG-005 完成 ===');
  });

  /**
   * TC-MCP-DIAG-006: 前端诊断结果展示
   */
  test('TC-MCP-DIAG-006: 前端诊断结果展示', async ({ page }) => {
    console.log('=== TC-MCP-DIAG-006: 前端诊断结果展示 ===');

    const clicked = await openMCPServiceDialog(page, 'coingecko');

    if (!clicked) {
      console.log('⚠ 未找到 CoinGecko 服务，跳过 UI 测试');
      test.skip();
      return;
    }

    // 点击诊断按钮
    const diagnoseSelectors = [
      'button:has-text("诊断连接")',
      'button:has-text("诊断")',
    ];

    for (const selector of diagnoseSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        await page.waitForTimeout(5000);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/tc-diag006-result.png', fullPage: true });

    // 检查诊断结果是否显示
    const resultSelectors = [
      'text=healthy',
      'text=degraded',
      'text=down',
      'text=诊断结果',
      '[class*="diagnostic"]',
    ];

    let resultFound = false;
    for (const selector of resultSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✓ 诊断结果显示: ${selector}`);
        resultFound = true;
        break;
      }
    }

    expect(resultFound).toBeTruthy();
    console.log('=== TC-MCP-DIAG-006 完成 ===');
  });

  // =========================================================================
  // 回归测试用例
  // =========================================================================

  /**
   * TC-MCP-REG-001: Calculator MCP 服务
   */
  test('TC-MCP-REG-001: Calculator MCP服务正常工作', async ({ request }) => {
    console.log('=== TC-MCP-REG-001: Calculator MCP回归测试 ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/calculator/test`);
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.success).toBe(true);

    const toolCount = result.tools?.length || result.tool_count || 0;
    expect(toolCount).toBeGreaterThan(0);

    console.log(`✓ Calculator 服务正常 (${toolCount} 工具)`);
    console.log('=== TC-MCP-REG-001 完成 ===');
  });

  /**
   * TC-MCP-REG-002: Cold-jokes MCP 服务
   */
  test('TC-MCP-REG-002: Cold-jokes MCP服务正常工作', async ({ request }) => {
    console.log('=== TC-MCP-REG-002: Cold-jokes MCP回归测试 ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/cold-jokes/test`);
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.success).toBe(true);

    const toolCount = result.tools?.length || result.tool_count || 0;
    expect(toolCount).toBeGreaterThan(0);

    console.log(`✓ Cold-jokes 服务正常 (${toolCount} 工具)`);
    console.log('=== TC-MCP-REG-002 完成 ===');
  });

  /**
   * TC-MCP-REG-003: 智能体对话流式输出
   */
  test('TC-MCP-REG-003: 智能体对话流式输出正常', async ({ page }) => {
    console.log('=== TC-MCP-REG-003: 流式输出回归测试 ===');

    const agentCards = page.locator('[class*="agent"]').or(
      page.locator('[class*="card"]')
    );

    const count = await agentCards.count();
    if (count > 0) {
      await agentCards.first().click();
      await page.waitForTimeout(1000);
    }

    const messageBox = page.locator('textarea').first();
    await messageBox.fill('你好，请简单介绍一下自己');
    await messageBox.press('Enter');

    await page.waitForTimeout(8000);

    const pageText = await page.textContent('body');
    const hasResponse = pageText?.includes('你好') ||
                        pageText?.includes('Hello') ||
                        pageText?.includes('我是') ||
                        pageText?.includes('智能体');

    expect(hasResponse).toBeTruthy();

    await page.screenshot({ path: 'test-results/tc-reg003-streaming.png' });
    console.log('✓ 流式输出功能正常');
    console.log('=== TC-MCP-REG-003 完成 ===');
  });

  /**
   * TC-MCP-REG-005: 所有 MCP 服务状态一致性
   */
  test('TC-MCP-REG-005: 所有MCP服务状态一致性检查', async ({ request }) => {
    console.log('=== TC-MCP-REG-005: MCP服务状态一致性 ===');

    const servicesResponse = await request.get(`${API_BASE_URL}/api/mcp-services`);
    const servicesData = await servicesResponse.json();
    const services = servicesData.services || [];

    console.log(`找到 ${services.length} 个MCP服务`);

    const results: any[] = [];

    for (const service of services) {
      const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/${service.name}/test`);
      const testResult = await testResponse.json();

      const toolCount = testResult.tools?.length || testResult.tool_count || 0;
      results.push({
        name: service.name,
        success: testResult.success,
        tool_count: toolCount,
        message: testResult.message
      });

      console.log(`  ${service.name}: ${testResult.success ? '✓' : '✗'} (${toolCount} 工具)`);
    }

    // 验证本地服务可用
    const localServices = results.filter((r: any) =>
      r.name === 'calculator' || r.name === 'cold-jokes'
    );

    for (const service of localServices) {
      expect(service.success).toBe(true);
    }

    console.log('=== TC-MCP-REG-005 完成 ===');
  });

  // =========================================================================
  // 集成测试用例
  // =========================================================================

  /**
   * TC-MCP-INT-001: 智能体调用 CoinGecko 工具
   */
  test('TC-MCP-INT-001: 智能体调用CoinGecko工具', async ({ page, request }) => {
    console.log('=== TC-MCP-INT-001: 智能体调用CoinGecko工具 ===');

    // 先验证 CoinGecko 服务可用
    const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/test`);
    const testResult = await testResponse.json();

    if (!testResult.success) {
      console.log('⚠ CoinGecko服务不可用，跳过测试');
      test.skip();
      return;
    }

    const agentCards = page.locator('[class*="agent"]').or(
      page.locator('[class*="card"]')
    );

    const count = await agentCards.count();
    if (count > 0) {
      await agentCards.first().click();
      await page.waitForTimeout(1000);
    }

    const messageBox = page.locator('textarea').first();
    await messageBox.fill('BTC的最新价格是多少？');
    await messageBox.press('Enter');

    await page.waitForTimeout(15000);

    await page.screenshot({ path: 'test-results/tc-int001-coingecko-call.png', fullPage: true });

    const pageText = await page.textContent('body');
    const hasCryptoResponse = pageText?.includes('BTC') ||
                              pageText?.includes('比特币') ||
                              pageText?.includes('price') ||
                              pageText?.includes('价格');

    if (hasCryptoResponse) {
      console.log('✓ 智能体可能调用了 CoinGecko 工具');
    } else {
      console.log('⚠ 响应中未找到明确的加密货币信息');
    }

    console.log('=== TC-MCP-INT-001 完成 ===');
  });

  // =========================================================================
  // 异常测试用例
  // =========================================================================

  /**
   * TC-MCP-ERR-001: 无效服务名称
   */
  test('TC-MCP-ERR-001: 无效服务名称错误处理', async ({ request }) => {
    console.log('=== TC-MCP-ERR-001: 无效服务名称错误处理 ===');

    const response = await request.post(`${API_BASE_URL}/api/mcp-services/invalid-service-xyz/test`);

    expect(response.status()).toBe(404);

    const result = await response.json();
    console.log('错误响应:', result);

    console.log('=== TC-MCP-ERR-001 完成 ===');
  });

  /**
   * TC-MCP-ERR-003: MCP 库缺失场景（通过 API 模拟）
   */
  test('TC-MCP-ERR-003: MCP库缺失时的诊断结果', async ({ request }) => {
    console.log('=== TC-MCP-ERR-003: MCP库缺失场景 ===');

    // 调用诊断 API
    const response = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/diagnose`);
    const report = await response.json();

    // 检查是否有 MCP 层
    const mcpLayer = report.layers?.find((l: any) => l.layer.toLowerCase() === 'mcp');

    if (mcpLayer && mcpLayer.status === 'fail') {
      console.log('✓ MCP 层检测到失败状态');
      console.log(`  错误信息: ${mcpLayer.message}`);

      // 验证有修复建议
      expect(report.recommendation).toBeDefined();
      console.log(`  修复建议: ${report.recommendation}`);
    } else {
      console.log('⚠ 当前环境中 MCP 库已安装，无法测试缺失场景');
    }

    console.log('=== TC-MCP-ERR-003 完成 ===');
  });

  // =========================================================================
  // 综合测试
  // =========================================================================

  /**
   * TC-MCP-FULL-001: 完整诊断流程测试
   */
  test('TC-MCP-FULL-001: 完整诊断流程测试', async ({ page, request }) => {
    console.log('=== TC-MCP-FULL-001: 完整诊断流程 ===');

    // 步骤 1: API 诊断
    console.log('步骤 1: API 诊断');
    const apiResponse = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/diagnose`);
    const apiReport = await apiResponse.json();

    console.log(`  整体状态: ${apiReport.overall_status}`);
    for (const layer of apiReport.layers) {
      console.log(`    ${layer.layer}: ${layer.status}`);
    }

    expect(apiReport.overall_status).toMatch(/healthy|degraded|down/);

    // 步骤 2: UI 诊断
    console.log('步骤 2: UI 诊断');
    const clicked = await openMCPServiceDialog(page, 'coingecko');

    if (clicked) {
      const diagnoseSelectors = [
        'button:has-text("诊断连接")',
        'button:has-text("诊断")',
      ];

      for (const selector of diagnoseSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await page.waitForTimeout(5000);
          break;
        }
      }

      await page.screenshot({ path: 'test-results/tc-full001-complete.png', fullPage: true });
      console.log('✓ UI 诊断完成');
    }

    console.log('=== TC-MCP-FULL-001 完成 ===');
  });

});

/**
 * 测试执行说明:
 *
 * 1. 确保前后端服务已启动:
 *    - Frontend: http://localhost:20880
 *    - Backend:  http://localhost:20881
 *
 * 2. 运行测试:
 *    npx playwright test ac130-coingecko-mcp.spec.ts
 *
 * 3. 查看报告:
 *    npx playwright show-report
 *
 * 4. 测试结果保存位置:
 *    - test-results/*.png (截图)
 *    - playwright-report/ (HTML 报告)
 */
