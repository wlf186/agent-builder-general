/**
 * Langfuse Setup Test
 * Creates account, project, and API keys
 */

import { test, expect } from '@playwright/test';

const LANGFUSE_URL = 'http://localhost:3000';

test('Setup Langfuse account and create API keys', async ({ page }) => {
  // Set longer timeout
  test.setTimeout(180000);

  // Navigate to Langfuse
  await page.goto(LANGFUSE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/langfuse-01.png' });

  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Try to sign in with existing account first
  const signInLink = page.getByText('Sign in', { exact: false }).or(page.getByRole('link', { name: 'Sign in' }));
  if (await signInLink.count() > 0) {
    console.log('Found Sign In link, clicking...');
    await signInLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/langfuse-02-signin.png' });
  }

  // Fill in credentials
  const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
  const passwordInput = page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]'));

  await emailInput.fill('admin@langfuse.local');
  await passwordInput.fill('LangfuseAdmin123!');

  await page.screenshot({ path: '/tmp/langfuse-03-filled.png' });

  // Submit form
  const submitButton = page.getByRole('button', { name: /sign in|continue/i }).or(page.locator('button[type="submit"]'));
  await submitButton.first().click();

  // Wait for navigation
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/langfuse-04-after-submit.png' });

  // Check current URL after sign in
  console.log('URL after sign in:', page.url());

  // Check for onboarding or project creation
  const onboardingInput = page.getByRole('textbox', { name: /project/i }).or(page.locator('input[name="projectName"]'));
  if (await onboardingInput.count() > 0) {
    console.log('Found onboarding form, filling project name...');
    await onboardingInput.fill('Agent Builder');
    await page.screenshot({ path: '/tmp/langfuse-05-onboarding.png' });

    const continueButton = page.getByRole('button', { name: /continue|create/i }).or(page.locator('button[type="submit"]'));
    await continueButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/langfuse-06-project-created.png' });
  }

  // Navigate to settings/API keys
  console.log('Looking for Settings...');

  // Try to find settings link in sidebar or menu
  const sidebarMenu = page.locator('[data-testid="sidebar"]').or(page.locator('nav')).or(page.locator('aside'));
  if (await sidebarMenu.count() > 0) {
    console.log('Found sidebar, looking for settings...');
  }

  // Try to find settings link
  const settingsLink = page.getByRole('link', { name: /settings/i }).or(page.getByText('Settings'));
  if (await settingsLink.count() > 0) {
    await settingsLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/langfuse-07-settings.png' });
  }

  // Look for API keys section
  const apiKeysLink = page.getByRole('link', { name: /api.*key/i }).or(page.getByText('API Keys'));
  if (await apiKeysLink.count() > 0) {
    await apiKeysLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/langfuse-08-apikeys.png' });
  }

  // Create new API key
  const newKeyButton = page.getByRole('button', { name: /create|new|generate/i });
  if (await newKeyButton.count() > 0) {
    console.log('Creating new API key...');
    await newKeyButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/langfuse-09-newkey.png' });
  }

  // Extract keys from page
  const pageText = await page.innerText('body');

  // Find public key
  const pkMatch = pageText.match(/pk-lf-[a-zA-Z0-9]+/g);
  const skMatch = pageText.match(/sk-lf-[a-zA-Z0-9]+/g);

  console.log('\n=== PAGE TEXT (first 3000 chars) ===');
  console.log(pageText.substring(0, 3000));
  console.log('=== END ===\n');

  if (pkMatch && skMatch) {
    console.log('\n=== LANGFUSE API KEYS ===');
    console.log(`LANGFUSE_PUBLIC_KEY=${pkMatch[0]}`);
    console.log(`LANGFUSE_SECRET_KEY=${skMatch[0]}`);
    console.log('========================\n');
  } else {
    console.log('Could not find API keys on page');
    console.log('Page URL:', page.url());
  }

  // Keep browser open for a moment
  await page.waitForTimeout(5000);
});
