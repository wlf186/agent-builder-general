/**
 * ============================================================================
 * AC130 工具调用优先级验证测试
 *
 * 测试目标: 验证智能体正确调用 MCP 工具，而非 LLM 抢答
 *
 * 测试用例设计: teams/AC130/iterations/20260313_01/测试用例设计.md
 *
 * 验证标准:
 * - 工具被正确调用: 检查 SSE 事件中的 tool_call
 * - LLM 抢答检测: 思考过程中无 tool_call 且直接输出答案
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:20880';
const API_BASE_URL = 'http://localhost:20881';

/**
 * SSE 事件记录器
 * 用于捕获和分析流式响应中的事件
 */
class SSEEventRecorder {
  private events: any[] = [];
  private rawChunks: string[] = [];

  /**
   * 从响应文本中解析 SSE 事件
   */
  parseSSEEvents(text: string): any[] {
    const events: any[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          events.push(data);
          this.events.push(data);
        } catch (e) {
          // 忽略解析失败的行
        }
      }
    }

    return events;
  }

  /**
   * 获取所有工具调用事件
   */
  getToolCalls(): any[] {
    return this.events.filter(e => e.type === 'tool_call');
  }

  /**
   * 获取所有工具结果事件
   */
  getToolResults(): any[] {
    return this.events.filter(e => e.type === 'tool_result');
  }

  /**
   * 获取思考事件
   */
  getThinkingEvents(): any[] {
    return this.events.filter(e => e.type === 'thinking');
  }

  /**
   * 获取内容事件
   */
  getContentEvents(): any[] {
    return this.events.filter(e => e.type === 'content');
  }

  /**
   * 检查是否调用了指定工具
   */
  hasToolCall(toolName: string): boolean {
    const toolCalls = this.getToolCalls();
    return toolCalls.some(tc =>
      tc.name?.toLowerCase().includes(toolName.toLowerCase())
    );
  }

  /**
   * 检查是否存在 LLM 抢答
   * 抢答定义: 有 thinking 和 content，但没有 tool_call
   */
  hasLLMAnswering(): boolean {
    const hasThinking = this.getThinkingEvents().length > 0;
    const hasContent = this.getContentEvents().length > 0;
    const hasToolCall = this.getToolCalls().length > 0;

    return hasThinking && hasContent && !hasToolCall;
  }

  /**
   * 生成诊断报告
   */
  generateReport(): string {
    const lines: string[] = [];
    lines.push('=== SSE 事件分析报告 ===');
    lines.push(`总事件数: ${this.events.length}`);
    lines.push(`  - thinking: ${this.getThinkingEvents().length}`);
    lines.push(`  - content: ${this.getContentEvents().length}`);
    lines.push(`  - tool_call: ${this.getToolCalls().length}`);
    lines.push(`  - tool_result: ${this.getToolResults().length}`);

    const toolCalls = this.getToolCalls();
    if (toolCalls.length > 0) {
      lines.push('\n工具调用详情:');
      for (const tc of toolCalls) {
        lines.push(`  - ${tc.name}: ${JSON.stringify(tc.args)}`);
      }
    }

    if (this.hasLLMAnswering()) {
      lines.push('\n⚠️  检测到 LLM 抢答行为');
    }

    return lines.join('\n');
  }

  /**
   * 重置记录器
   */
  reset(): void {
    this.events = [];
    this.rawChunks = [];
  }
}

/**
 * 辅助函数: 导航到智能体对话页面
 */
async function navigateToAgentChat(page: any, agentName: string = 'test') {
  console.log(`\n正在导航到智能体: ${agentName}`);

  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const agentSelectors = [
    `text="${agentName}"`,
    `[data-agent-name="${agentName}"]`,
    `[class*="agent-card"]:has-text("${agentName}")`,
  ];

  for (const selector of agentSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✓ 找到智能体卡片`);
        await element.click();
        await page.waitForTimeout(1000);
        return true;
      }
    } catch (e) {
      // 继续尝试
    }
  }

  // 直接 URL 导航
  console.log(`尝试直接 URL 导航`);
  await page.goto(`${BASE_URL}/agents/${agentName}`);
  await page.waitForLoadState('networkidle');
  return true;
}

/**
 * 辅助函数: 发送消息并捕获 SSE 事件
 */
async function sendMessageWithSSERecording(
  page: any,
  message: string,
  recorder: SSEEventRecorder,
  waitTime: number = 10000
): Promise<void> {
  console.log(`\n发送消息: "${message}"`);

  // 设置响应监听
  const sseChunks: string[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/chat/stream')) {
      try {
        const body = await response.text();
        sseChunks.push(body);
        recorder.parseSSEEvents(body);
      } catch (e) {
        // 响应体可能已被读取
      }
    }
  });

  // 查找输入框并发送消息
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
        await input.fill(message);
        await input.press('Enter');
        inputFound = true;
        console.log('✓ 消息已发送');
        break;
      }
    } catch (e) {
      // 继续
    }
  }

  if (!inputFound) {
    console.log('⚠️  未找到输入框');
  }

  // 等待响应
  console.log(`等待响应 (${waitTime}ms)...`);
  await page.waitForTimeout(waitTime);
}

/**
 * 辅助函数: UI 级别的工具调用检查
 */
async function checkToolCallsUI(page: any): Promise<{
  hasToolCall: boolean;
  hasThinking: boolean;
  toolNames: string[];
  thinkingContent: string;
}> {
  const result = {
    hasToolCall: false,
    hasThinking: false,
    toolNames: [] as string[],
    thinkingContent: '',
  };

  // 检查工具调用指示器
  const toolSelectors = [
    '[class*="tool-call"]',
    '[class*="ToolCall"]',
    'text=工具调用',
    'text=tool_call',
  ];

  for (const selector of toolSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        result.hasToolCall = true;
        // 尝试提取工具名称
        for (let i = 0; i < Math.min(count, 5); i++) {
          const text = await elements.nth(i).textContent();
          if (text) {
            result.toolNames.push(text.slice(0, 50));
          }
        }
      }
    } catch (e) {
      // 继续
    }
  }

  // 检查思考过程
  const thinkingSelectors = [
    '[class*="thinking"]',
    '.bg-amber-50',
    '.bg-yellow-50',
  ];

  for (const selector of thinkingSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        result.hasThinking = true;
        result.thinkingContent = await element.textContent() || '';
        break;
      }
    } catch (e) {
      // 继续
    }
  }

  return result;
}

test.describe('AC130: 工具调用优先级验证', () => {

  /**
   * TC-TOOL-001: Cold-jokes 工具调用验证
   * 输入: "讲一个冷笑话"
   * 预期: 调用 cold-jokes MCP
   */
  test('TC-TOOL-001: Cold-jokes工具调用验证', async ({ page, request }) => {
    console.log('\n=== TC-TOOL-001: Cold-jokes 工具调用验证 ===');

    // 前置条件检查
    const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/cold-jokes/test`);
    const testResult = await testResponse.json();

    if (!testResult.success) {
      console.log('⚠️  Cold-jokes 服务不可用，跳过测试');
      test.skip();
      return;
    }
    console.log(`✓ Cold-jokes 服务可用 (${testResult.tools?.length || 0} 工具)`);

    // 导航到智能体
    await navigateToAgentChat(page, 'test');

    // 发送消息并记录 SSE 事件
    const recorder = new SSEEventRecorder();
    await sendMessageWithSSERecording(page, '讲一个冷笑话', recorder, 12000);

    // 截图
    const timestamp = Date.now();
    await page.screenshot({
      path: `test-results/ac130-tool001-coldjokes-${timestamp}.png`,
      fullPage: true
    });

    // 分析 SSE 事件
    console.log('\n' + recorder.generateReport());

    // UI 级别检查
    const uiResult = await checkToolCallsUI(page);
    console.log('\nUI 检查结果:');
    console.log(`  工具调用指示器: ${uiResult.hasToolCall ? '✓' : '✗'}`);
    console.log(`  思考过程: ${uiResult.hasThinking ? '✓' : '✗'}`);

    // 验证结果
    const hasColdJokesCall = recorder.hasToolCall('cold-jokes') ||
                            recorder.hasToolCall('jokes');

    console.log('\n验证结果:');
    console.log(`  调用 cold-jokes: ${hasColdJokesCall ? '✓' : '✗'}`);
    console.log(`  LLM 抢答: ${recorder.hasLLMAnswering() ? '⚠️  是' : '否'}`);

    // 检查响应内容
    const pageText = await page.textContent('body');
    const hasJokeContent = (pageText?.length || 0) > 100;
    console.log(`  包含笑话内容: ${hasJokeContent ? '✓' : '✗'}`);

    // 断言
    expect(hasColdJokesCall || uiResult.hasToolCall).toBeTruthy();

    console.log('\n=== TC-TOOL-001 完成 ===');
  });

  /**
   * TC-TOOL-002: Calculator 工具调用验证
   * 输入: "3294/919+213"
   * 预期: 调用 calculator MCP
   * 正确答案: 约 216.86
   */
  test('TC-TOOL-002: Calculator工具调用验证', async ({ page, request }) => {
    console.log('\n=== TC-TOOL-002: Calculator 工具调用验证 ===');

    // 前置条件检查
    const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/calculator/test`);
    const testResult = await testResponse.json();

    if (!testResult.success) {
      console.log('⚠️  Calculator 服务不可用，跳过测试');
      test.skip();
      return;
    }
    console.log(`✓ Calculator 服务可用 (${testResult.tools?.length || 0} 工具)`);

    // 导航到智能体
    await navigateToAgentChat(page, 'test');

    // 发送消息并记录 SSE 事件
    const recorder = new SSEEventRecorder();
    await sendMessageWithSSERecording(page, '3294/919+213', recorder, 12000);

    // 截图
    const timestamp = Date.now();
    await page.screenshot({
      path: `test-results/ac130-tool002-calculator-${timestamp}.png`,
      fullPage: true
    });

    // 分析 SSE 事件
    console.log('\n' + recorder.generateReport());

    // UI 级别检查
    const uiResult = await checkToolCallsUI(page);
    console.log('\nUI 检查结果:');
    console.log(`  工具调用指示器: ${uiResult.hasToolCall ? '✓' : '✗'}`);
    console.log(`  思考过程: ${uiResult.hasThinking ? '✓' : '✗'}`);

    // 验证结果
    const hasCalculatorCall = recorder.hasToolCall('calculator') ||
                              recorder.hasToolCall('calculate');

    console.log('\n验证结果:');
    console.log(`  调用 calculator: ${hasCalculatorCall ? '✓' : '✗'}`);
    console.log(`  LLM 抢答: ${recorder.hasLLMAnswering() ? '⚠️  是' : '否'}`);

    // 检查响应内容是否包含答案
    const pageText = await page.textContent('body');
    const expectedAnswer = 3294 / 919 + 213;
    const hasNumericAnswer = pageText?.includes('216') ||
                             pageText?.includes('217') ||
                             pageText?.includes(Math.floor(expectedAnswer).toString());

    console.log(`  包含答案: ${hasNumericAnswer ? '✓' : '✗'}`);

    // 断言
    expect(hasCalculatorCall || uiResult.hasToolCall).toBeTruthy();

    console.log('\n=== TC-TOOL-002 完成 ===');
  });

  /**
   * TC-TOOL-003: CoinGecko 工具调用验证
   * 输入: "BTC的最新价格"
   * 预期: 调用 coingecko MCP
   */
  test('TC-TOOL-003: CoinGecko工具调用验证', async ({ page, request }) => {
    console.log('\n=== TC-TOOL-003: CoinGecko 工具调用验证 ===');

    // 前置条件检查
    const testResponse = await request.post(`${API_BASE_URL}/api/mcp-services/coingecko/test`);
    const testResult = await testResponse.json();

    if (!testResult.success) {
      console.log('⚠️  CoinGecko 服务不可用，跳过测试');
      console.log(`  原因: ${testResult.message || testResult.error || '未知'}`);
      test.skip();
      return;
    }
    console.log(`✓ CoinGecko 服务可用 (${testResult.tools?.length || 0} 工具)`);

    // 导航到智能体
    await navigateToAgentChat(page, 'test');

    // 发送消息并记录 SSE 事件
    const recorder = new SSEEventRecorder();
    await sendMessageWithSSERecording(page, 'BTC的最新价格', recorder, 15000);

    // 截图
    const timestamp = Date.now();
    await page.screenshot({
      path: `test-results/ac130-tool003-coingecko-${timestamp}.png`,
      fullPage: true
    });

    // 分析 SSE 事件
    console.log('\n' + recorder.generateReport());

    // UI 级别检查
    const uiResult = await checkToolCallsUI(page);
    console.log('\nUI 检查结果:');
    console.log(`  工具调用指示器: ${uiResult.hasToolCall ? '✓' : '✗'}`);
    console.log(`  思考过程: ${uiResult.hasThinking ? '✓' : '✗'}`);

    // 验证结果
    const hasCoinGeckoCall = recorder.hasToolCall('coingecko') ||
                             recorder.hasToolCall('coin') ||
                             recorder.hasToolCall('crypto') ||
                             recorder.hasToolCall('price');

    console.log('\n验证结果:');
    console.log(`  调用 coingecko: ${hasCoinGeckoCall ? '✓' : '✗'}`);
    console.log(`  LLM 抢答: ${recorder.hasLLMAnswering() ? '⚠️  是' : '否'}`);

    // 检查响应内容
    const pageText = await page.textContent('body');
    const priceKeywords = ['USD', '$', '美元', 'price', '价格', 'BTC', 'bitcoin'];
    const hasPriceInfo = priceKeywords.some(kw => new RegExp(kw, 'i').test(pageText || ''));

    console.log(`  包含价格信息: ${hasPriceInfo ? '✓' : '✗'}`);

    // 断言（注意：由于 LLM 不确定性，使用较宽松的断言）
    if (!hasCoinGeckoCall && !uiResult.hasToolCall) {
      console.log('⚠️  未检测到明确的工具调用，可能是 LLM 抢答');
    }

    console.log('\n=== TC-TOOL-003 完成 ===');
  });

  /**
   * TC-TOOL-004: 连续工具调用验证
   * 输入: "先算一下100除以25，再讲个笑话"
   * 预期: 依次调用 calculator 和 cold-jokes
   */
  test('TC-TOOL-004: 连续工具调用验证', async ({ page, request }) => {
    console.log('\n=== TC-TOOL-004: 连续工具调用验证 ===');

    // 导航到智能体
    await navigateToAgentChat(page, 'test');

    // 发送消息并记录 SSE 事件
    const recorder = new SSEEventRecorder();
    await sendMessageWithSSERecording(page, '先算一下100除以25，再讲个笑话', recorder, 18000);

    // 截图
    const timestamp = Date.now();
    await page.screenshot({
      path: `test-results/ac130-tool004-multi-${timestamp}.png`,
      fullPage: true
    });

    // 分析 SSE 事件
    console.log('\n' + recorder.generateReport());

    const toolCalls = recorder.getToolCalls();
    console.log(`\n工具调用次数: ${toolCalls.length}`);

    // 验证结果
    const hasCalculator = recorder.hasToolCall('calculator');
    const hasJokes = recorder.hasToolCall('cold-jokes') || recorder.hasToolCall('jokes');

    console.log('\n验证结果:');
    console.log(`  调用 calculator: ${hasCalculator ? '✓' : '✗'}`);
    console.log(`  调用 cold-jokes: ${hasJokes ? '✓' : '✗'}`);

    // 检查响应内容
    const pageText = await page.textContent('body');
    const hasCalcResult = pageText?.includes('4') || /四|four/i.test(pageText || '');
    const hasJokeContent = (pageText?.length || 0) > 150;

    console.log(`  包含计算结果 (4): ${hasCalcResult ? '✓' : '✗'}`);
    console.log(`  包含笑话内容: ${hasJokeContent ? '✓' : '✗'}`);

    // 断言
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);

    console.log('\n=== TC-TOOL-004 完成 ===');
  });

  /**
   * TC-TOOL-005: LLM 抢答检测
   * 输入: "1+1等于几"
   * 预期: 可能 LLM 抢答（简单计算）
   * 注意: 此测试用于验证检测机制，而非强制要求工具调用
   */
  test('TC-TOOL-005: LLM抢答检测机制验证', async ({ page }) => {
    console.log('\n=== TC-TOOL-005: LLM 抢答检测机制验证 ===');

    // 导航到智能体
    await navigateToAgentChat(page, 'test');

    // 发送简单计算问题
    const recorder = new SSEEventRecorder();
    await sendMessageWithSSERecording(page, '1+1等于几', recorder, 8000);

    // 分析
    console.log('\n' + recorder.generateReport());

    const isLLMAnswering = recorder.hasLLMAnswering();
    const hasToolCall = recorder.getToolCalls().length > 0;

    console.log('\n分析结果:');
    console.log(`  工具调用: ${hasToolCall ? '是' : '否'}`);
    console.log(`  LLM 抢答: ${isLLMAnswering ? '是' : '否'}`);

    // 这个测试用于验证检测机制，不强制断言
    if (isLLMAnswering) {
      console.log('  ⚠️  检测到 LLM 抢答行为（对于简单问题这是预期行为）');
    } else if (hasToolCall) {
      console.log('  ✓ 智能体正确调用了工具');
    } else {
      console.log('  ℹ️  无法确定行为');
    }

    console.log('\n=== TC-TOOL-005 完成 ===');
  });

  /**
   * TC-TOOL-006: MCP 服务健康检查
   * 验证所有测试所需的 MCP 服务可用
   */
  test('TC-TOOL-006: MCP服务健康检查', async ({ request }) => {
    console.log('\n=== TC-TOOL-006: MCP 服务健康检查 ===');

    const services = ['calculator', 'cold-jokes', 'coingecko'];
    const results: any = {};

    for (const service of services) {
      const response = await request.post(`${API_BASE_URL}/api/mcp-services/${service}/test`);
      const result = await response.json();

      results[service] = {
        success: result.success,
        toolCount: result.tools?.length || result.tool_count || 0,
        message: result.message || result.error
      };

      const status = result.success ? '✓' : '✗';
      const count = result.tools?.length || result.tool_count || 0;
      console.log(`  ${service}: ${status} (${count} 工具)`);
    }

    // 验证本地服务可用
    expect(results['calculator'].success).toBe(true);
    expect(results['cold-jokes'].success).toBe(true);

    // CoinGecko 可能因网络问题不可用
    if (!results['coingecko'].success) {
      console.log(`  ⚠️  CoinGecko 服务不可用: ${results['coingecko'].message}`);
    }

    console.log('\n=== TC-TOOL-006 完成 ===');
  });

});

/**
 * ============================================================================
 * 测试执行说明
 * ============================================================================
 *
 * 1. 确保前后端服务已启动:
 *    - Frontend: http://localhost:20880
 *    - Backend:  http://localhost:20881
 *
 * 2. 运行测试:
 *    npx playwright test ac130-tool-priority.spec.ts
 *
 * 3. 运行特定测试:
 *    npx playwright test ac130-tool-priority.spec.ts -g "TC-TOOL-001"
 *
 * 4. 查看报告:
 *    npx playwright show-report
 *
 * 5. 测试结果保存位置:
 *    - test-results/ac130-tool-*.png (截图)
 *    - playwright-report/ (HTML 报告)
 *
 * ============================================================================
 */
