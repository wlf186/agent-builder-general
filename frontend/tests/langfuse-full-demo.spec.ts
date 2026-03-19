import { test, expect } from '@playwright/test';

test.describe('Langfuse Full Demo', () => {
  test.setTimeout(300000);

  const testEmail = 'demo@agent-builder.local';
  const testPassword = 'Demo@123456';

  test('Login to Langfuse and view traces', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const pageAgent = await context1.newPage();
    const pageLangfuse = await context2.newPage();

    // ========== Step 1: Agent Builder 发送消息 ==========
    console.log('\n📍 Step 1: 打开 Agent Builder...');
    await pageAgent.goto('http://localhost:20880');
    await pageAgent.waitForTimeout(2000);

    console.log('  点击第一个智能体...');
    const firstAgent = pageAgent.locator('h3, h2').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 10000 });
    await firstAgent.click();
    await pageAgent.waitForTimeout(2000);

    console.log('📍 Step 2: 发送测试消息...');
    const inputSelector = pageAgent.locator('input[type="text"][placeholder]').first();
    await inputSelector.waitFor({ state: 'visible', timeout: 10000 });

    const testMessage = `计算 25 + 17 等于多少？`;
    await inputSelector.fill(testMessage);
    await pageAgent.waitForTimeout(500);

    const sendButton = pageAgent.locator('button[type="submit"], button:has-text("发送")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await inputSelector.press('Enter');
    }

    console.log('  等待 AI 响应...');
    await pageAgent.waitForTimeout(15000);

    await pageAgent.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/agent-response.png', fullPage: true });
    console.log('  ✅ 消息已发送');

    // ========== Step 2: Langfuse 登录并查看追踪 ==========
    console.log('\n📍 Step 3: 登录 Langfuse...');
    await pageLangfuse.goto('http://localhost:3000/auth/sign-in');
    await pageLangfuse.waitForTimeout(2000);

    // 填写登录表单
    const emailInput = pageLangfuse.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = pageLangfuse.locator('input[type="password"]').first();

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);

    const signInBtn = pageLangfuse.locator('button[type="submit"], button:has-text("Sign in")').first();
    await signInBtn.click();
    console.log('  点击登录...');

    await pageLangfuse.waitForTimeout(5000);

    // 检查是否需要 onboarding
    let currentUrl = pageLangfuse.url();
    console.log('  当前 URL:', currentUrl);

    if (currentUrl.includes('onboarding')) {
      console.log('  完成 onboarding...');
      // 填写组织名称
      const orgInput = pageLangfuse.locator('input[name="name"], input[placeholder*="organization"], input[placeholder*="Organization"]').first();
      if (await orgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await orgInput.fill('Demo Organization');
        const continueBtn = pageLangfuse.locator('button:has-text("Continue"), button:has-text("Create"), button[type="submit"]').first();
        await continueBtn.click();
        await pageLangfuse.waitForTimeout(3000);
      }

      // 创建项目
      const projectInput = pageLangfuse.locator('input[placeholder*="project"], input[name="projectName"]').first();
      if (await projectInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await projectInput.fill('Agent Builder Demo');
        const createBtn = pageLangfuse.locator('button:has-text("Create"), button[type="submit"]').first();
        await createBtn.click();
        await pageLangfuse.waitForTimeout(3000);
      }
    }

    currentUrl = pageLangfuse.url();
    console.log('  登录后 URL:', currentUrl);
    await pageLangfuse.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-logged-in.png', fullPage: true });

    // ========== Step 3: 查看追踪 ==========
    console.log('\n📍 Step 4: 查看 Traces...');
    await pageLangfuse.waitForTimeout(2000);

    // 导航到 Traces 页面
    const tracesLink = pageLangfuse.locator('a:has-text("Traces"), nav a[href*="traces"]').first();
    if (await tracesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tracesLink.click();
      await pageLangfuse.waitForTimeout(3000);
    } else {
      // 直接访问 traces 页面
      await pageLangfuse.goto('http://localhost:3000/traces');
      await pageLangfuse.waitForTimeout(3000);
    }

    await pageLangfuse.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-traces.png', fullPage: true });
    console.log('  ✅ Traces 页面截图保存');

    console.log('\n📋 演示完成！');
    console.log('  - Agent 响应: test-results/agent-response.png');
    console.log('  - Langfuse 登录: test-results/langfuse-logged-in.png');
    console.log('  - Langfuse Traces: test-results/langfuse-traces.png');

    // 保持浏览器打开 3 分钟
    console.log('\n⏳ 浏览器保持打开 3 分钟...');
    await pageAgent.waitForTimeout(180000);

    await context1.close();
    await context2.close();
  });
});
