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
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/chat') || url.includes('/stream')) {
      console.log(`Network: ${response.status()} ${url}`);
    }
  });

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

    // 查找输入框 - 使用正确的 placeholder
    const inputLocator = page.locator('textarea[placeholder*="输入消息"], textarea[placeholder*="message"]').first();
    
    // 等待输入框可见
    await inputLocator.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ 找到输入框');

    // 输入消息
    await inputLocator.fill(message);
    console.log(`已输入消息: ${message}`);
    await sleep(500);

    // 截图 - 发送前
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-before-send.png`, fullPage: true });

    // 按 Shift+Enter 发送（根据 AgentChat.tsx 的代码）
    await page.keyboard.press('Shift+Enter');
    console.log('已按 Shift+Enter 发送消息');

    // 等待响应
    console.log('等待响应 (30秒)...');
    
    // 等待响应出现
    let responseReceived = false;
    let waitCount = 0;
    while (!responseReceived && waitCount < 30) {
      await sleep(1000);
      waitCount++;
      
      // 检查是否有新的消息元素出现
      const messages = page.locator('[class*="message"]');
      const count = await messages.count();
      if (count > 0) {
        // 检查最后一条消息的内容
        const lastMessage = messages.last();
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 10) {
          console.log(`检测到响应内容 (${text.length} 字符)`);
          responseReceived = true;
        }
      }
    }

    // 截图 - 响应后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });
    console.log('截图保存: after-response');

    // 获取所有消息元素
    const messages = page.locator('[class*="message"]');
    const messageCount = await messages.count();
    console.log(`\n找到 ${messageCount} 条消息`);

    // 遍历所有消息并打印内容
    for (let i = 0; i < messageCount; i++) {
      const msg = messages.nth(i);
      const text = await msg.textContent();
      const className = await msg.getAttribute('class');
      console.log(`\n消息 ${i + 1} [${className}]:`);
      console.log(text?.substring(0, 500) || '(空)');
    }

    // 检查思考过程
    const thinkingElements = page.locator('[class*="thinking"]');
    const thinkingCount = await thinkingElements.count();
    console.log(`\n找到 ${thinkingCount} 个思考过程元素`);
    
    if (thinkingCount > 0) {
      for (let i = 0; i < thinkingCount; i++) {
        const thinking = thinkingElements.nth(i);
        const text = await thinking.textContent();
        console.log(`思考过程 ${i + 1}: ${text?.substring(0, 500) || '(空)'}`);
      }
    }

    // 检查工具调用
    const toolElements = page.locator('[class*="tool-call"], [class*="tool_call"], [class*="ToolCall"]');
    const toolCount = await toolElements.count();
    console.log(`\n找到 ${toolCount} 个工具调用元素`);
    
    if (toolCount > 0) {
      for (let i = 0; i < toolCount; i++) {
        const tool = toolElements.nth(i);
        const text = await tool.textContent();
        console.log(`工具调用 ${i + 1}: ${text?.substring(0, 200) || '(空)'}`);
      }
    }

    return {
      testName,
      message,
      messageCount,
      thinkingCount,
      toolCount,
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
  console.log('AC130 问题复现测试 V4');
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
      console.log(`  消息数量: ${result.messageCount}`);
      console.log(`  思考过程: ${result.thinkingCount > 0 ? '✅ 有' : '❌ 无'}`);
      console.log(`  工具调用: ${result.toolCount > 0 ? '✅ 有' : '❌ 无'}`);
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
