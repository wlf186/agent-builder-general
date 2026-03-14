/**
 * ============================================================================
 * AC130 问题复现 - 思考过程和 tool_call 验证
 *
 * 测试目标:
 * 1. 验证智能体响应中是否有"思考过程"
 * 2. 验证智能体是否显示 tool_call 事件
 * 3. 记录完整的响应内容
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:20880';
const SCREENSHOT_DIR = '/work/agent-builder-general/teams/AC130/iterations/20260313_01';

/**
 * 辅助函数: 点击智能体卡片进入对话页面
 */
async function navigateToAgentChat(page: any, agentName: string) {
  console.log(`正在导航到智能体: ${agentName}`);

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 查找并点击智能体卡片
  const agentCard = page.locator(`.agent-card, [class*="agent-card"]`).filter({ hasText: agentName }).first();
  await agentCard.click();

  console.log(`已点击智能体: ${agentName}`);

  // 等待聊天界面加载
  await expect(page.locator('input[placeholder*="发送"], textarea[placeholder*="发送"], input[placeholder*="message"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * 辅助函数: 发送消息并等待响应
 */
async function sendMessageAndWait(page: any, message: string) {
  console.log(`\n>>> 发送消息: ${message}`);

  // 查找输入框并输入消息
  const inputBox = page.locator('input[placeholder*="发送"], textarea[placeholder*="发送"], input[placeholder*="message"]').first();
  await inputBox.fill(message);

  // 点击发送按钮
  const sendButton = page.locator('button:has-text("发送"), button[type="submit"]').first();
  await sendButton.click();

  // 等待响应
  await page.waitForTimeout(6000);
}

/**
 * 辅助函数: 捕获思考过程
 */
async function captureThinkingProcess(page: any): Promise<string | null> {
  // 尝试多种可能的选择器
  const thinkingSelectors = [
    '.bg-amber-50',
    '.bg-yellow-50',
    '[class*="thinking"]',
    '[class*="Thinking"]',
    '.text-amber-900',
    '.text-yellow-900',
  ];

  for (const selector of thinkingSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      const text = await element.textContent();
      if (text && text.trim().length > 0) {
        console.log(`找到思考过程 (selector: ${selector})`);
        return text;
      }
    }
  }

  return null;
}

/**
 * 辅助函数: 检查是否有 tool_call
 */
async function checkToolCall(page: any): Promise<boolean> {
  const toolSelectors = [
    '[class*="tool-call"]',
    '[class*="tool_call"]',
    '[class*="ToolCall"]',
    '.bg-blue-50',
    '.bg-indigo-50',
    '[class*="tool"][class*="border"]',
  ];

  for (const selector of toolSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      console.log(`发现 tool_call (selector: ${selector})`);
      return true;
    }
  }

  return false;
}

/**
 * 测试用例1: 冷笑话
 */
test('AC130-01: 冷笑话', async ({ page }) => {
  await page.goto(BASE_URL);
  await navigateToAgentChat(page, 'test');

  await sendMessageAndWait(page, '讲一个冷笑话');

  // 截图完整页面
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/test01-cold-joke-full.png`,
    fullPage: true
  });

  // 捕获思考过程
  const thinkingText = await captureThinkingProcess(page);
  console.log('\n=== 测试用例1 思考过程 ===');
  console.log(thinkingText || '未找到思考过程');

  // 检查 tool_call
  const hasToolCall = await checkToolCall(page);
  console.log('=== 测试用例1 tool_call 检查 ===');
  console.log(hasToolCall ? '发现 tool_call' : '未发现 tool_call');

  // 获取完整响应
  const messages = page.locator('[class*="message"], .prose');
  const lastMessage = await messages.last().textContent();
  console.log('\n=== 测试用例1 完整响应 ===');
  console.log(lastMessage || '');
});

/**
 * 测试用例2: 数学计算
 */
test('AC130-02: 数学计算', async ({ page }) => {
  await page.goto(BASE_URL);
  await navigateToAgentChat(page, 'test');

  await sendMessageAndWait(page, '3294/919+213');

  // 截图
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/test02-math-full.png`,
    fullPage: true
  });

  // 捕获思考过程
  const thinkingText = await captureThinkingProcess(page);
  console.log('\n=== 测试用例2 思考过程 ===');
  console.log(thinkingText || '未找到思考过程');

  // 检查 tool_call
  const hasToolCall = await checkToolCall(page);
  console.log('=== 测试用例2 tool_call 检查 ===');
  console.log(hasToolCall ? '发现 tool_call' : '未发现 tool_call');

  // 获取完整响应
  const messages = page.locator('[class*="message"], .prose');
  const lastMessage = await messages.last().textContent();
  console.log('\n=== 测试用例2 完整响应 ===');
  console.log(lastMessage || '');
});

/**
 * 测试用例3: BTC价格
 */
test('AC130-03: BTC价格', async ({ page }) => {
  await page.goto(BASE_URL);
  await navigateToAgentChat(page, 'test');

  await sendMessageAndWait(page, 'BTC的最新价格');

  // 截图
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/test03-btc-full.png`,
    fullPage: true
  });

  // 捕获思考过程
  const thinkingText = await captureThinkingProcess(page);
  console.log('\n=== 测试用例3 思考过程 ===');
  console.log(thinkingText || '未找到思考过程');

  // 检查 tool_call
  const hasToolCall = await checkToolCall(page);
  console.log('=== 测试用例3 tool_call 检查 ===');
  console.log(hasToolCall ? '发现 tool_call' : '未发现 tool_call');

  // 获取完整响应
  const messages = page.locator('[class*="message"], .prose');
  const lastMessage = await messages.last().textContent();
  console.log('\n=== 测试用例3 完整响应 ===');
  console.log(lastMessage || '');
});
