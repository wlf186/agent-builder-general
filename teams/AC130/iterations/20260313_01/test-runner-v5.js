const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:20880';
const SCREENSHOT_DIR = '/work/agent-builder-general/teams/AC130/iterations/20260313_01';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(testName, message) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试用例: ${testName}`);
  console.log(`消息: ${message}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 导航到主页
    console.log('导航到主页...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(2000);

    // 查找并点击 test 智能体卡片
    const textLocator = page.locator('text="test"').first();
    await textLocator.click();
    console.log('✅ 已点击 test 智能体卡片');

    // 等待页面切换到配置视图
    console.log('等待配置视图加载...');
    await sleep(3000);

    // 截图 - 调试视图
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-debug-view.png`, fullPage: true });

    // 查找所有 textarea 元素
    const textareas = page.locator('textarea');
    const textareaCount = await textareas.count();
    console.log(`找到 ${textareaCount} 个 textarea 元素`);

    // 查找所有 input 元素
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`找到 ${inputCount} 个 input 元素`);

    // 查找输入框 - 尝试所有可能的元素
    let inputElement = null;
    let inputSelector = null;

    // 首先尝试 textarea
    if (textareaCount > 0) {
      for (let i = 0; i < textareaCount; i++) {
        const ta = textareas.nth(i);
        const placeholder = await ta.getAttribute('placeholder');
        const isVisible = await ta.isVisible();
        console.log(`Textarea ${i}: placeholder="${placeholder}", visible=${isVisible}`);
        if (isVisible && (!placeholder || placeholder.includes('输入') || placeholder.includes('message') || placeholder.includes('发送'))) {
          inputElement = ta;
          inputSelector = `textarea:nth-of-type(${i + 1})`;
          break;
        }
      }
    }

    // 如果没找到，尝试 input
    if (!inputElement && inputCount > 0) {
      for (let i = 0; i < inputCount; i++) {
        const inp = inputs.nth(i);
        const type = await inp.getAttribute('type');
        const placeholder = await inp.getAttribute('placeholder');
        const isVisible = await inp.isVisible();
        console.log(`Input ${i}: type="${type}", placeholder="${placeholder}", visible=${isVisible}`);
        if (isVisible && type !== 'hidden' && type !== 'submit') {
          inputElement = inp;
          inputSelector = `input:nth-of-type(${i + 1})`;
          break;
        }
      }
    }

    if (!inputElement) {
      console.log('⚠ 未找到合适的输入框');
      throw new Error('未找到合适的输入框');
    }

    console.log(`✅ 找到输入框: ${inputSelector}`);

    // 输入消息
    await inputElement.fill(message);
    console.log(`已输入消息: ${message}`);
    await sleep(500);

    // 截图 - 发送前
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-before-send.png`, fullPage: true });

    // 尝试发送 - 查找发送按钮
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`找到 ${buttonCount} 个按钮`);

    let sent = false;
    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const isVisible = await btn.isVisible();
      if (isVisible && text && (text.includes('发送') || text.toLowerCase().includes('send'))) {
        console.log(`找到发送按钮: "${text}"`);
        await btn.click();
        sent = true;
        break;
      }
    }

    if (!sent) {
      // 尝试按 Enter 键
      console.log('尝试按 Enter 键...');
      await inputElement.press('Enter');
    }

    // 等待响应
    console.log('等待响应 (30秒)...');
    
    let waitCount = 0;
    let lastMessageCount = 0;
    while (waitCount < 30) {
      await sleep(1000);
      waitCount++;
      
      // 检查消息数量变化
      const messages = page.locator('[class*="message"]');
      const count = await messages.count();
      if (count > lastMessageCount) {
        console.log(`检测到新消息 (${count} 条)`);
        lastMessageCount = count;
      }
      
      // 检查是否有内容
      if (count > 0) {
        const lastMessage = messages.last();
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 20) {
          console.log(`检测到完整响应 (${text.length} 字符)`);
          break;
        }
      }
    }

    // 截图 - 响应后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });
    console.log('截图保存: after-response');

    // 分析页面内容
    const allText = await page.textContent('body');
    console.log('\n=== 页面文本分析 ===');
    
    // 统计关键信息
    const hasThinking = allText.includes('思考过程') || allText.includes('thinking');
    const hasTool = allText.includes('工具调用') || allText.includes('tool_call');
    const hasResponse = allText.includes(message) && allText.length > message.length + 50;
    
    console.log(`包含思考过程: ${hasThinking ? '✅' : '❌'}`);
    console.log(`包含工具调用: ${hasTool ? '✅' : '❌'}`);
    console.log(`包含响应内容: ${hasResponse ? '✅' : '❌'}`);

    // 查找并打印所有消息
    const messages = page.locator('[class*="message"], [class*="chat"]');
    const messageCount = await messages.count();
    console.log(`\n找到 ${messageCount} 个消息/聊天元素`);

    for (let i = 0; i < Math.min(messageCount, 5); i++) {
      const msg = messages.nth(i);
      const text = await msg.textContent();
      const className = await msg.getAttribute('class');
      const preview = text ? text.substring(0, 200).replace(/\n/g, ' ') : '(空)';
      console.log(`[${i}] ${className}: ${preview}...`);
    }

    return {
      testName,
      message,
      hasThinking,
      hasTool,
      hasResponse,
      messageCount,
      success: true
    };

  } catch (error) {
    console.error(`测试执行出错: ${error.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-error.png`, fullPage: true });
    return {
      testName,
      message,
      error: error.message,
      success: false
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('AC130 问题复现测试 V5');
  console.log(`截图目录: ${SCREENSHOT_DIR}`);

  const results = [];

  // 测试用例1: 冷笑话
  results.push(await runTest('test01-cold-joke', '讲一个冷笑话'));

  return results;
}

main().then(results => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
