const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:20880';
const SCREENSHOT_DIR = '/work/agent-builder-general/teams/AC130/iterations/20260313_01';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureThinkingProcess(page) {
  const thinkingSelectors = [
    '.bg-amber-50',
    '.bg-yellow-50',
    '[class*="thinking"]',
    '[class*="Thinking"]',
    '.text-amber-900',
    '.text-yellow-900',
  ];

  for (const selector of thinkingSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        const text = await element.textContent();
        if (text && text.trim().length > 0) {
          console.log(`找到思考过程 (selector: ${selector})`);
          return text;
        }
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }

  return null;
}

async function checkToolCall(page) {
  const toolSelectors = [
    '[class*="tool-call"]',
    '[class*="tool_call"]',
    '[class*="ToolCall"]',
    '.bg-blue-50',
    '.bg-indigo-50',
    '[class*="tool"][class*="border"]',
  ];

  for (const selector of toolSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        console.log(`发现 tool_call (selector: ${selector})`);
        return true;
      }
    } catch (e) {
      // 继续尝试
    }
  }

  return false;
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
    await page.goto(BASE_URL);
    await sleep(2000);

    // 查找并点击 test 智能体
    const agentSelectors = [
      `text="test"`,
      `[data-agent-name="test"]`,
      `[class*="agent-card"]:has-text("test")`,
    ];

    let clicked = false;
    for (const selector of agentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          clicked = true;
          console.log('已点击 test 智能体');
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!clicked) {
      // 尝试直接导航
      await page.goto(`${BASE_URL}/agents/test`);
    }

    await sleep(2000);

    // 查找输入框并输入消息
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
          console.log(`已发送消息: ${message}`);
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
    await sleep(8000);

    // 截图
    const screenshotPath = `${SCREENSHOT_DIR}/${testName.replace(/\s+/g, '-')}-full.png`;
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`截图保存: ${screenshotPath}`);

    // 捕获思考过程
    const thinkingText = await captureThinkingProcess(page);
    console.log('\n=== 思考过程 ===');
    console.log(thinkingText || '未找到思考过程');

    // 检查 tool_call
    const hasToolCall = await checkToolCall(page);
    console.log('\n=== tool_call 检查 ===');
    console.log(hasToolCall ? '✅ 发现 tool_call' : '❌ 未发现 tool_call');

    // 获取完整响应
    const messages = page.locator('[class*="message"], .prose');
    const lastMessage = await messages.last().textContent();
    console.log('\n=== 完整响应 ===');
    console.log(lastMessage || '');

    return {
      testName,
      message,
      thinking: thinkingText,
      hasToolCall,
      response: lastMessage,
      screenshotPath
    };

  } catch (error) {
    console.error(`测试执行出错: ${error.message}`);
    return {
      testName,
      message,
      error: error.message
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('AC130 问题复现测试开始');
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
    if (result.error) {
      console.log(`  状态: ❌ 失败 - ${result.error}`);
    } else {
      console.log(`  思考过程: ${result.thinking ? '✅ 有' : '❌ 无'}`);
      console.log(`  tool_call: ${result.hasToolCall ? '✅ 有' : '❌ 无'}`);
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
