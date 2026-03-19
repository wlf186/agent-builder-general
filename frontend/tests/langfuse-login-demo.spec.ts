/**
 * Langfuse 登录演示 - Headed 模式
 */

import { test, expect } from '@playwright/test';

test.use({
  headless: false,
  slowMo: 500,
});

const LANGFUSE_URL = 'http://localhost:3000';
const EMAIL = 'admin@langfuse.local';
const PASSWORD = 'LangfuseAdmin123!';

test('Langfuse 登录演示', async ({ page }) => {
  console.log('\n========================================');
  console.log('Langfuse 登录演示');
  console.log('========================================\n');

  // 1. 访问 Langfuse 登录页
  console.log(`1. 访问 ${LANGFUSE_URL}/auth/sign-in`);
  await page.goto(`${LANGFUSE_URL}/auth/sign-in`);

  // 等待 SPA 加载完成（Langfuse 是 Next.js SPA）
  console.log('   等待页面加载...');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`   当前 URL: ${currentUrl}`);

  // 2. 等待表单加载
  console.log('\n2. 等待登录表单加载...');
  const emailInput = page.locator('input[type="email"]').first();

  // 等待邮箱输入框可见
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  console.log('   登录表单已加载');

  // 截图
  await page.screenshot({ path: 'test-results/langfuse-login-page.png', fullPage: true });
  console.log('   已保存截图: test-results/langfuse-login-page.png');

  // 3. 填写登录信息
  console.log('\n3. 填写登录信息...');
  console.log(`   输入邮箱: ${EMAIL}`);
  await emailInput.fill(EMAIL);

  const passwordInput = page.locator('input[type="password"]').first();
  console.log(`   输入密码: ******`);
  await passwordInput.fill(PASSWORD);

  // 截图填写后的表单
  await page.screenshot({ path: 'test-results/langfuse-login-form-filled.png', fullPage: true });
  console.log('   已保存截图: test-results/langfuse-login-form-filled.png');

  // 4. 点击登录按钮
  console.log('\n4. 点击登录按钮...');

  // 等待按钮变为可见
  const signInButton = page.locator('button:has-text("Sign in"):visible').first();
  await signInButton.waitFor({ state: 'visible', timeout: 10000 });
  await signInButton.click();
  console.log('   已点击登录按钮');

  // 5. 等待登录结果
  console.log('\n5. 等待登录结果...');

  try {
    // 等待 URL 变化或页面跳转
    await page.waitForURL(/^(?!.*sign-in).*$/, { timeout: 15000 });
    console.log('   URL 已变化');
  } catch (e) {
    console.log('   URL 未变化，检查页面状态...');
  }

  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  const finalTitle = await page.title();
  console.log(`   最终 URL: ${finalUrl}`);
  console.log(`   页面标题: ${finalTitle}`);

  // 检查是否登录成功
  const bodyText = await page.locator('body').textContent();
  const hasError = bodyText?.includes('Invalid') || bodyText?.includes('Error') || bodyText?.includes('incorrect');
  const isLoggedIn = !finalUrl.includes('sign-in') && !hasError;

  if (isLoggedIn) {
    console.log('\n✅ 登录成功！');
  } else if (hasError) {
    console.log('\n❌ 登录失败 - 账号或密码错误');
  } else {
    console.log('\n⚠️ 登录状态未知');
  }

  // 截图最终状态
  await page.screenshot({ path: 'test-results/langfuse-login-result.png', fullPage: true });
  console.log('   已保存截图: test-results/langfuse-login-result.png');

  // 保持页面打开一段时间便于观察
  console.log('\n保持页面打开 5 秒...');
  await page.waitForTimeout(5000);

  console.log('\n========================================');
  console.log('演示完成');
  console.log('========================================\n');
});
