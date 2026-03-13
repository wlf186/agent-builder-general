/**
 * 迭代-2603131100 前端消息重复Bug验证测试 (Node.js)
 */

import { chromium } from 'playwright';

const BACKEND_URL = 'http://localhost:20881';
const FRONTEND_URL = 'http://localhost:20880';

const results = [];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testNoDuplicateMessages() {
  console.log('\n=== 测试1: 前端消息不重复验证 ===');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 监听控制台
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[Console Error]', msg.text());
      }
    });

    // 访问主页
    console.log('访问主页...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await sleep(3000);

    // 检查是否有智能体列表
    const hasAgentList = await page.locator('text=测试助手, text=test-no-duplicate').count() > 0;

    if (!hasAgentList) {
      // 创建智能体
      console.log('创建测试智能体...');
      const createButton = page.locator('button:has-text("新建智能体"), button:has-text("New Agent")').first();
      if (await createButton.count() > 0) {
        await createButton.click();
        await sleep(500);

        // 填写表单
        await page.fill('input[name="name"]', 'ui-test-agent');
        await page.fill('textarea[name="description"]', 'UI测试助手');

        // 选择模型
        const select = page.locator('[role="combobox"], select').first();
        if (await select.count() > 0) {
          await select.click();
          await sleep(300);
          await page.click('text=TESTLLM');
        }

        // 保存
        await page.click('button:has-text("保存"), button:has-text("Save")');
        await sleep(1000);
      }
    }

    // 选择智能体
    console.log('选择智能体...');
    const agentButton = page.locator('text=test-no-duplicate, text=ui-test-agent, text=测试助手').first();
    if (await agentButton.count() > 0) {
      await agentButton.click();
    }
    await sleep(2000);

    // 找到消息输入框
    console.log('定位消息输入框...');
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 10000 });

    // 发送第一条消息
    const testMessage1 = `测试消息-${Date.now()}`;
    console.log(`发送消息1: ${testMessage1}`);
    await textarea.fill(testMessage1);
    await page.keyboard.press('Enter');
    await sleep(10000); // 等待响应

    // 检查用户消息是否重复
    console.log('检查消息数量...');
    const allText = await page.textContent('body');
    const messageMatches = (allText.match(testMessage1) || []).length;
    console.log(`消息 "${testMessage1}" 出现次数: ${messageMatches}`);

    // 截图
    await page.screenshot({ path: '/tmp/test_ui_messages.png', fullPage: true });

    const passed = messageMatches === 1;

    await browser.close();

    return {
      name: '前端消息不重复',
      passed,
      details: `用户消息出现${messageMatches}次(期望1次)`
    };

  } catch (error) {
    await browser.close();
    return {
      name: '前端消息不重复',
      passed: false,
      details: `测试异常: ${error.message}`
    };
  }
}

async function runTests() {
  console.log('========================================');
  console.log('  迭代-2603131100 前端测试开始');
  console.log('========================================');

  results.push(await testNoDuplicateMessages());

  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | ${result.name}`);
    console.log(`       ${result.details}`);
    console.log('');

    if (result.passed) passed++;
    else failed++;
  });

  console.log('========================================');
  console.log(`  总计: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');

  // 保存结果
  const fs = await import('fs');
  const existingResults = JSON.parse(fs.readFileSync('/work/agent-builder-general/teams/tf141/iterations/iteration-2603131100/test_results.json', 'utf8'));
  existingResults.results.push(...results);
  existingResults.summary.total += results.length;
  existingResults.summary.passed += passed;
  existingResults.summary.failed += failed;

  fs.writeFileSync(
    '/work/agent-builder-general/teams/tf141/iterations/iteration-2603131100/test_results.json',
    JSON.stringify(existingResults, null, 2)
  );

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
