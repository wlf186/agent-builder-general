/**
 * Langfuse Setup Test
 * Creates account, project, and API keys
 */

import { test, expect } from '@playwright/test';

const LANGFUSE_URL = 'http://localhost:3000';

test('Setup Langfuse account and create API keys', async ({ page }) => {
  // Navigate to Langfuse
  await page.goto(LANGFUSE_URL);
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: '/tmp/langfuse-01.png' });

  // Check if we're on sign up or sign in page
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Look for sign up option
  const signUpLink = page.locator('a:has-text("Sign up"), button:has-text("Sign up"), text=Sign up');
  const hasSignUp = await signUpLink.count() > 0;

  if (hasSignUp) {
    console.log('Found Sign Up link, clicking...');
    await signUpLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-02-signup.png' });
  }

  // Fill in credentials
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');

  // Fill name if available
  if (await nameInput.count() > 0) {
    await nameInput.fill('Admin User');
  }

  await emailInput.fill('admin@langfuse.local');
  await passwordInput.fill('LangfuseAdmin123!');

  await page.screenshot({ path: '/tmp/langfuse-03-filled.png' });

  // Submit form
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign up"), button:has-text("Sign in")');
  await submitButton.first().click();

  // Wait for navigation
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/langfuse-04-after-submit.png' });

  // Check for project creation
  const createProjectButton = page.locator('button:has-text("Create"), a:has-text("Create project"), text=Create project');
  if (await createProjectButton.count() > 0) {
    console.log('Creating project...');
    await createProjectButton.first().click();
    await page.waitForLoadState('networkidle');

    const projectNameInput = page.locator('input[name="name"], input[placeholder*="project"]');
    await projectNameInput.fill('Agent Builder');

    const createButton = page.locator('button[type="submit"], button:has-text("Create")');
    await createButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-05-project.png' });
  }

  // Navigate to settings
  const settingsLink = page.locator('a:has-text("Settings"), text=Settings, [href*="settings"]');
  if (await settingsLink.count() > 0) {
    await settingsLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-06-settings.png' });
  }

  // Navigate to API keys
  const apiKeysLink = page.locator('a:has-text("API"), text=API Keys, [href*="api-keys"]');
  if (await apiKeysLink.count() > 0) {
    await apiKeysLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-07-apikeys.png' });
  }

  // Create new API key
  const newKeyButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');
  if (await newKeyButton.count() > 0) {
    await newKeyButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-08-newkey.png' });
  }

  // Extract keys from page
  const pageContent = await page.content();

  // Find public key
  const pkMatch = pageContent.match(/pk-lf-[a-zA-Z0-9]+/g);
  const skMatch = pageContent.match(/sk-lf-[a-zA-Z0-9]+/g);

  if (pkMatch && skMatch) {
    console.log('\n=== LANGFUSE API KEYS ===');
    console.log(`LANGFUSE_PUBLIC_KEY=${pkMatch[0]}`);
    console.log(`LANGFUSE_SECRET_KEY=${skMatch[0]}`);
    console.log('========================\n');
  } else {
    console.log('Could not find API keys on page');
    console.log('Page URL:', page.url());
  }

  // Keep page open for a moment
  await page.waitForTimeout(5000);
});
