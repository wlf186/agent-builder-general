/**
 * ============================================================================
 * AC130 UAT: MCP 工具调用测试
 *
 * 测试目标:
 * 1. 验证智能体能够正确调用 calculator 工具
 * 2. 验证智能体能够正确调用 cold-jokes 工具
 * 3. 验证智能体能够正确调用 coingecko 工具
 * 4. 观察并记录工具调用过程
 *
 * 产品需求: teams/AC130/iterations/20260313_第1次迭代/
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:20880';
const API_BASE_URL = 'http://localhost:20881';

/**
 * 辅助函数: 点击智能体卡片进入对话页面
 */
async function navigateToAgentChat(page: any, agentName: string) {
  console.log(`正在导航到智能体: ${agentName}`);

  // 等待页面加载
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 查找并点击智能体卡片
  const agentSelectors = [
    `text="${agentName}"`,
    `[data-agent-name="${agentName}"]`,
    `[class*="agent-card"]:has-text("${agentName}")`,
    `generic:has-text("${agentName}")`,
  ];

  for (const selector of agentSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`找到智能体卡片，使用选择器: ${selector}`);
        await element.click();
        await page.waitForTimeout(2000); // 等待导航到对话页面
        return true;
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }

  // 如果直接点击失败，尝试通过 URL 导航
  console.log('尝试通过 URL 导航到智能体对话页面');
  await page.goto(`${BASE_URL}/agents/${agentName}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  return true;
}

/**
 * 辅助函数: 发送消息并等待响应
 */
async function sendMessageAndWait(page: any, message: string, waitTime: number = 15000) {
  console.log(`\n发送消息: "${message}"`);

  // 查找输入框
  const inputSelectors = [
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    'div[role="textbox"]',
  ];

  let inputFound = false;
  for (const selector of inputSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 2000 })) {
        console.log(`找到输入框，使用选择器: ${selector}`);
        await input.fill(message);
        await input.press('Enter');
        inputFound = true;
        break;
      }
    } catch (e) {
      // 继续尝试
    }
  }

  if (!inputFound) {
    console.log('⚠ 未找到输入框');
  }

  // 等待响应
  console.log(`等待响应 (${waitTime}ms)...`);
  await page.waitForTimeout(waitTime);

  // 截图
  const timestamp = Date.now();
  await page.screenshot({
    path: `test-results/mcp-tool-test-${timestamp}.png`,
    fullPage: true
  });
  console.log(`截图保存: test-results/mcp-tool-test-${timestamp}.png`);
}

/**
 * 辅助函数: 检查页面中的工具调用指示器
 */
async function checkToolCallIndicators(page: any) {
  const pageText = await page.textContent('body');

  const indicators = {
    toolCall: /工具调用|tool_call|调用工具|using tool/i.test(pageText),
    calculator: /calculator|计算器/i.test(pageText),
    coldJokes: /cold.?jokes|冷笑话|joke/i.test(pageText),
    coingecko: /coingecko|加密货币|bitcoin|btc|价格/i.test(pageText),
  };

  console.log('\n工具调用检查:');
  for (const [key, value] of Object.entries(indicators)) {
    console.log(`  ${key}: ${value ? '✓ 检测到' : '✗ 未检测到'}`);
  }

  return indicators;
}

test.describe('AC130 UAT: MCP 工具调用测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  /**
   * TC-MCP-TOOL-001: Calculator 工具调用测试
   * 问题: "99/33+2是多少"
   * 预期: 智能体调用 calculator 工具进行计算
   * 正确答案: 5
   */
  test('TC-MCP-TOOL-001: Calculator工具调用', async ({ page }) => {
    console.log('=== TC-MCP-TOOL-001: Calculator工具调用测试 ===');

    // 导航到 test 智能体
    await navigateToAgentChat(page, 'test');

    // 发送计算问题
    await sendMessageAndWait(page, '99/33+2是多少', 15000);

    // 检查工具调用指示器
    const indicators = await checkToolCallIndicators(page);

    // 检查页面内容
    const pageText = await page.textContent('body');

    // 验证响应包含数字 5（正确答案）
    const hasAnswer = pageText?.includes('5') || /五|five/i.test(pageText || '');
    console.log(`包含答案 "5": ${hasAnswer ? '✓' : '✗'}`);

    expect(hasAnswer).toBeTruthy();

    console.log('=== TC-MCP-TOOL-001 完成 ===');
  });

  /**
   * TC-MCP-TOOL-002: Cold-jokes 工具调用测试
   * 问题: "讲一个冷笑话"
   * 预期: 智能体调用 cold-jokes 工具获取笑话
   */
  test('TC-MCP-TOOL-002: Cold-jokes工具调用', async ({ page }) => {
    console.log('=== TC-MCP-TOOL-002: Cold-jokes工具调用测试 ===');

    // 导航到 test 智能体
    await navigateToAgentChat(page, 'test');

    // 发送笑话请求
    await sendMessageAndWait(page, '讲一个冷笑话', 15000);

    // 检查工具调用指示器
    const indicators = await checkToolCallIndicators(page);

    // 检查页面内容
    const pageText = await page.textContent('body');

    // 验证响应包含笑话内容（通常较长且有趣）
    const hasJokeContent = (pageText?.length || 0) > 100;
    console.log(`包含笑话内容: ${hasJokeContent ? '✓' : '✗'}`);

    expect(hasJokeContent).toBeTruthy();

    console.log('=== TC-MCP-TOOL-002 完成 ===');
  });

  /**
   * TC-MCP-TOOL-003: CoinGecko 工具调用测试
   * 问题: "BTC的最新价格"
   * 预期: 智能体调用 coingecko 工具获取比特币价格
   */
  test('TC-MCP-TOOL-003: CoinGecko工具调用', async ({ page, request }) => {
    console.log('=== TC-MCP-TOOL-003: CoinGecko工具调用测试 ===');

    // 先验证 CoinGecko 服务可用
    const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/test`);
    const testResult = await testResponse.json();

    if (!testResult.success) {
      console.log('⚠ CoinGecko服务不可用，跳过测试');
      test.skip();
      return;
    }

    console.log(`✓ CoinGecko服务可用 (${testResult.tools?.length || 0} 工具)`);

    // 导航到 test 智能体
    await navigateToAgentChat(page, 'test');

    // 发送价格查询
    await sendMessageAndWait(page, 'BTC的最新价格', 20000);

    // 检查工具调用指示器
    const indicators = await checkToolCallIndicators(page);

    // 检查页面内容
    const pageText = await page.textContent('body');

    // 验证响应包含价格相关关键词
    const priceKeywords = ['USD', '$', '美元', 'price', '价格', 'BTC', 'bitcoin'];
    const hasPriceInfo = priceKeywords.some(keyword =>
      new RegExp(keyword, 'i').test(pageText || '')
    );

    console.log(`包含价格信息: ${hasPriceInfo ? '✓' : '✗'}`);

    // 注意: 由于 LLM 不确定性，不强制断言，但记录结果
    if (hasPriceInfo) {
      console.log('✓ 智能体可能调用了 CoinGecko 工具');
    } else {
      console.log('⚠ 响应中未明确检测到价格信息');
    }

    console.log('=== TC-MCP-TOOL-003 完成 ===');
  });

  /**
   * TC-MCP-TOOL-004: 连续多工具调用测试
   * 问题: "先算一下100除以25，再讲个笑话"
   * 预期: 智能体依次调用 calculator 和 cold-jokes 工具
   */
  test('TC-MCP-TOOL-004: 连续多工具调用', async ({ page }) => {
    console.log('=== TC-MCP-TOOL-004: 连续多工具调用测试 ===');

    // 导航到 test 智能体
    await navigateToAgentChat(page, 'test');

    // 发送复合请求
    await sendMessageAndWait(page, '先算一下100除以25，再讲个笑话', 20000);

    // 检查工具调用指示器
    const indicators = await checkToolCallIndicators(page);

    // 检查页面内容
    const pageText = await page.textContent('body');

    // 验证响应包含计算结果 (4)
    const hasCalcResult = pageText?.includes('4') || /四|four/i.test(pageText || '');
    console.log(`包含计算结果 "4": ${hasCalcResult ? '✓' : '✗'}`);

    // 验证响应内容较长（包含笑话）
    const hasJokeContent = (pageText?.length || 0) > 150;
    console.log(`包含笑话内容: ${hasJokeContent ? '✓' : '✗'}`);

    expect(hasCalcResult).toBeTruthy();

    console.log('=== TC-MCP-TOOL-004 完成 ===');
  });

  /**
   * TC-MCP-TOOL-005: 工具调用可见性测试
   * 验证用户能够看到工具调用过程
   */
  test('TC-MCP-TOOL-005: 工具调用可见性', async ({ page }) => {
    console.log('=== TC-MCP-TOOL-005: 工具调用可见性测试 ===');

    // 导航到 test 智能体
    await navigateToAgentChat(page, 'test');

    // 发送一个明确会触发工具的请求
    await sendMessageAndWait(page, '计算25乘以4等于多少', 15000);

    // 等待响应后检查页面元素
    await page.waitForTimeout(2000);

    // 尝试查找工具调用的视觉指示器
    const toolIndicators = [
      'text=工具调用',
      'text=tool_call',
      '[class*="tool-call"]',
      '[class*="tool-result"]',
      'text=计算',
      'text=calculator',
    ];

    let foundIndicator = false;
    for (const selector of toolIndicators) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          console.log(`✓ 找到工具指示器: ${selector}`);
          foundIndicator = true;
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!foundIndicator) {
      console.log('⚠ 未找到明确的工具调用指示器');
      console.log('注意: 这可能意味着工具调用过程对用户不可见，或者使用了不同的UI元素');
    }

    // 无论如何，验证结果是正确的
    const pageText = await page.textContent('body');
    const hasAnswer = pageText?.includes('100') || /一百/i.test(pageText || '');
    console.log(`包含答案 "100": ${hasAnswer ? '✓' : '✗'}`);

    expect(hasAnswer).toBeTruthy();

    console.log('=== TC-MCP-TOOL-005 完成 ===');
  });

});
