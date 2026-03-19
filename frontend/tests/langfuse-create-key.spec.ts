import { test, expect } from '@playwright/test';

test.describe('Langfuse API Key Setup', () => {
  test.setTimeout(120000);

  const testEmail = 'demo@agent-builder.local';
  const testPassword = 'Demo@123456';

  test('Create API key in Langfuse', async ({ page }) => {
    console.log('📍 Step 1: 登录 Langfuse...');
    await page.goto('http://localhost:3000/auth/sign-in');
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForTimeout(5000);

    let currentUrl = page.url();
    console.log('  当前 URL:', currentUrl);

    // 如果需要 onboarding
    if (currentUrl.includes('onboarding') || currentUrl === 'http://localhost:3000/') {
      console.log('  完成 onboarding...');

      // 填写组织名称
      const orgInput = page.locator('input').first();
      if (await orgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await orgInput.fill('Demo Organization');
        await page.locator('button[type="submit"], button:has-text("Continue")').first().click();
        await page.waitForTimeout(3000);
      }

      // 填写项目名称
      const projectInput = page.locator('input').first();
      if (await projectInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await projectInput.fill('Agent Builder Demo');
        await page.locator('button[type="submit"], button:has-text("Create")').first().click();
        await page.waitForTimeout(3000);
      }

      currentUrl = page.url();
      console.log('  Onboarding 后 URL:', currentUrl);
    }

    // 导航到项目设置
    console.log('\n📍 Step 2: 导航到项目设置...');
    await page.goto('http://localhost:3000/project/1/settings/general');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-project-settings.png', fullPage: true });

    // 查找 API Keys 页面链接
    const apiKeyLink = page.locator('a:has-text("API Keys"), a[href*="api-keys"], nav a:has-text("Keys")').first();
    if (await apiKeyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await apiKeyLink.click();
      await page.waitForTimeout(3000);
    } else {
      // 直接访问 API Keys 页面
      await page.goto('http://localhost:3000/project/1/settings/api-keys');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-api-keys-page.png', fullPage: true });
    console.log('  截图保存: test-results/langfuse-api-keys-page.png');

    // 检查是否已有 API Key
    const existingKey = page.locator('code, pre, [class*="key"]').first();
    if (await existingKey.isVisible({ timeout: 3000 }).catch(() => false)) {
      const keyText = await existingKey.textContent();
      console.log('\n📋 现有 API Key:', keyText);
    }

    // 创建新的 API Key
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('\n📍 Step 3: 创建新的 API Key...');
      await createButton.click();
      await page.waitForTimeout(2000);

      // 填写名称
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Agent Builder Key');
      }

      // 提交
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-new-key.png', fullPage: true });
      console.log('  截图保存: test-results/langfuse-new-key.png');
    }

    // 获取 API Keys
    console.log('\n⏳ 保持浏览器打开 2 分钟，请手动复制 API 密钥...');
    console.log('   Public Key 格式: pk-lf-xxxxx');
    console.log('   Secret Key 格式: sk-lf-xxxxx');

    await page.waitForTimeout(120000);
  });
});
