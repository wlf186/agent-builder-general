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

  // 监听网络请求
  const responses = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/chat') || url.includes('/stream')) {
      responses.push({ status: response.status(), url });
      console.log(`Network: ${response.status()} ${url}`);
    }
  });

  try {
    // 导航到主页
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(2000);

    // 点击 test 智能体卡片
    await page.locator('text="test"').first().click();
    await sleep(3000);

    // 等待环境初始化
    let envWaitCount = 0;
    while (envWaitCount < 60) {
      await sleep(1000);
      envWaitCount++;
      const bodyText = await page.textContent('body');
      const loaders = page.locator('.animate-spin');
      if (!bodyText.includes('环境初始化中') && await loaders.count() === 0) {
        break;
      }
    }

    // 查找聊天卡片内的输入框
    const chatCard = page.locator('[data-chat-card="true"]');
    const inputElement = chatCard.locator('input[type="text"]').first();
    await inputElement.fill(message);
    await sleep(500);

    // 点击发送按钮
    await chatCard.locator('button:has-text("发送")').first().click();

    // 等待响应
    console.log('等待响应...');
    let respWaitCount = 0;
    while (respWaitCount < 30) {
      await sleep(1000);
      respWaitCount++;
      const messages = page.locator('[class*="message"]');
      const msgCount = await messages.count();
      if (msgCount > 0) {
        const lastMessage = messages.last();
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 30) {
          console.log(`✅ 响应完成 (${text.length} 字符)`);
          break;
        }
      }
      const loaders = page.locator('.animate-spin');
      if (await loaders.count() === 0 && await messages.count() > 0) {
        await sleep(2000);
        break;
      }
    }

    // 截图 - 响应后（展开思考过程前）
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });

    // 尝试点击展开思考过程
    console.log('尝试展开思考过程...');
    const thinkingButtons = page.locator('button:has-text("思考过程"), [class*="thinking"], button[aria-label*="thinking"]');
    const thinkingBtnCount = await thinkingButtons.count();
    console.log(`找到 ${thinkingBtnCount} 个思考过程相关按钮`);
    
    if (thinkingBtnCount > 0) {
      for (let i = 0; i < thinkingBtnCount; i++) {
        try {
          await thinkingButtons.nth(i).click();
          await sleep(500);
          console.log(`已点击思考过程按钮 ${i + 1}`);
        } catch (e) {
          // 继续尝试
        }
      }
    }

    // 截图 - 展开后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-expanded.png`, fullPage: true });

    // 获取完整的页面内容
    const bodyText = await page.textContent('body');
    
    // 分析消息内容
    const messages = page.locator('[class*="message"]');
    const messageCount = await messages.count();
    console.log(`\n找到 ${messageCount} 个消息元素`);

    let messageContents = [];
    for (let i = 0; i < messageCount; i++) {
      const msg = messages.nth(i);
      const text = await msg.textContent();
      const className = await msg.getAttribute('class');
      messageContents.push({
        index: i,
        className: className,
        text: text || '',
        length: text?.length || 0
      });
    }

    // 分析思考过程
    const hasThinkingText = bodyText.includes('思考过程') || bodyText.includes('thinking');
    const hasToolText = bodyText.includes('工具调用') || bodyText.includes('tool_call');
    
    // 检查是否有实际的思考内容
    const thinkingContentElements = page.locator('[class*="thinking-content"], [class*="thinkingContent"], .bg-amber-50, .bg-yellow-50');
    const thinkingContentCount = await thinkingContentElements.count();
    
    let thinkingText = '';
    if (thinkingContentCount > 0) {
      for (let i = 0; i < thinkingContentCount; i++) {
        const text = await thinkingContentElements.nth(i).textContent();
        if (text && text.trim().length > 10) {
          thinkingText += text + '\n';
        }
      }
    }

    // 检查工具调用
    const toolCallElements = page.locator('[class*="tool-call"], [class*="tool_call"], [class*="ToolCall"], .bg-blue-50, .bg-indigo-50');
    const toolCallCount = await toolCallElements.count();
    
    let toolCallText = '';
    if (toolCallCount > 0) {
      for (let i = 0; i < toolCallCount; i++) {
        const text = await toolCallElements.nth(i).textContent();
        if (text && text.trim().length > 5) {
          toolCallText += text + '\n';
        }
      }
    }

    return {
      testName,
      message,
      hasThinkingText,
      hasToolText,
      thinkingContentCount,
      thinkingText: thinkingText.substring(0, 500),
      toolCallCount,
      toolCallText: toolCallText.substring(0, 500),
      messageContents: messageContents.map(m => ({
        index: m.index,
        length: m.length,
        textPreview: m.text.substring(0, 100)
      })),
      success: true
    };

  } catch (error) {
    console.error(`测试执行出错: ${error.message}`);
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
  console.log('AC130 问题复现测试 - 详细分析');
  console.log(`截图目录: ${SCREENSHOT_DIR}`);

  const results = [];

  // 测试用例1: 冷笑话
  results.push(await runTest('test01-cold-joke', '讲一个冷笑话'));

  // 测试用例2: 数学计算
  results.push(await runTest('test02-math', '3294/919+213'));

  // 测试用例3: BTC价格
  results.push(await runTest('test03-btc', 'BTC的最新价格'));

  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log('测试汇总');
  console.log('='.repeat(60));

  results.forEach((result, index) => {
    console.log(`\n测试 ${index + 1}: ${result.testName}`);
    console.log(`  消息: ${result.message}`);
    if (result.success) {
      console.log(`  页面包含"思考过程"文本: ${result.hasThinkingText ? '✅' : '❌'}`);
      console.log(`  思考内容元素数量: ${result.thinkingContentCount}`);
      console.log(`  思考内容: ${result.thinkingText || '(无)'}`);
      console.log(`  页面包含"工具调用"文本: ${result.hasToolText ? '✅' : '❌'}`);
      console.log(`  工具调用元素数量: ${result.toolCallCount}`);
      console.log(`  工具调用内容: ${result.toolCallText || '(无)'}`);
      console.log(`  消息内容:`);
      result.messageContents.forEach(m => {
        console.log(`    [${m.index}] ${m.textPreview}... (${m.length} 字符)`);
      });
    } else {
      console.log(`  状态: ❌ 失败 - ${result.error}`);
    }
  });

  return results;
}

main().then(results => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
