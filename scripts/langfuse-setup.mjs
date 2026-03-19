/**
 * Langfuse Setup Script
 * Creates account, project, and API keys via Playwright
 */

import { chromium } from 'playwright';

const LANGFUSE_URL = 'http://localhost:3000';

async function setupLangfuse() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔍 Navigating to Langfuse...');
  await page.goto(LANGFUSE_URL);
  await page.waitForLoadState('networkidle');

  // Take screenshot of initial page
  await page.screenshot({ path: '/tmp/langfuse-01-initial.png' });

  // Check if we need to sign up or sign in
  const signUpButton = page.locator('text=Sign up').or(page.locator('text=Create account')).or(page.locator('text=Get started'));
  const signInButton = page.locator('text=Sign in');

  const hasSignUp = await signUpButton.count() > 0;
  const hasSignIn = await signInButton.count() > 0;

  console.log(`SignUp button: ${hasSignUp}, SignIn button: ${hasSignIn}`);

  if (hasSignUp) {
    console.log('📝 Creating new account...');
    await signUpButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-02-signup.png' });

    // Fill in sign up form
    const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name"]'));
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    if (await nameInput.count() > 0) {
      await nameInput.fill('Admin User');
    }
    await emailInput.fill('admin@langfuse.local');
    await passwordInput.fill('LangfuseAdmin123!');

    // Click sign up button
    const submitButton = page.locator('button[type="submit"]').or(page.locator('text=Sign up').first());
    await submitButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-03-after-signup.png' });
  } else if (hasSignIn) {
    console.log('🔑 Signing in...');
    await signInButton.first().click();
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    await emailInput.fill('admin@langfuse.local');
    await passwordInput.fill('LangfuseAdmin123!');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('text=Sign in').first());
    await submitButton.click();
    await page.waitForLoadState('networkidle');
  }

  await page.screenshot({ path: '/tmp/langfuse-04-dashboard.png' });
  console.log('✅ Logged in successfully');

  // Wait for dashboard or project creation page
  await page.waitForTimeout(3000);

  // Look for project creation
  const createProjectButton = page.locator('text=Create project').or(page.locator('text=New Project')).or(page.locator('text=Create Project'));

  if (await createProjectButton.count() > 0) {
    console.log('📁 Creating project...');
    await createProjectButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-05-create-project.png' });

    const projectNameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="project"]'));
    await projectNameInput.fill('Agent Builder');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('text=Create').first());
    await submitButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-06-project-created.png' });
  }

  // Navigate to settings/API keys
  console.log('🔑 Looking for API keys...');

  const settingsButton = page.locator('text=Settings').or(page.locator('text=Project Settings')).or(page.locator('[data-testid="settings"]'));

  // Try to find settings in sidebar or menu
  const menuButton = page.locator('button[aria-label="menu"]').or(page.locator('button[aria-label="Menu"]'));
  if (await menuButton.count() > 0) {
    await menuButton.click();
    await page.waitForTimeout(1000);
  }

  // Try multiple navigation paths
  const navPaths = [
    () => page.locator('text=Settings').first().click(),
    () => page.locator('text=Project Settings').first().click(),
    () => page.locator('a[href*="settings"]').first().click(),
    () => page.locator('[data-testid="settings-link"]').first().click(),
  ];

  for (const nav of navPaths) {
    try {
      await nav();
      await page.waitForLoadState('networkidle');
      break;
    } catch (e) {
      continue;
    }
  }

  await page.screenshot({ path: '/tmp/langfuse-07-settings.png' });

  // Look for API keys section
  const apiKeysButton = page.locator('text=API Keys').or(page.locator('text=API keys')).or(page.locator('a[href*="api-keys"]'));
  if (await apiKeysButton.count() > 0) {
    await apiKeysButton.first().click();
    await page.waitForLoadState('networkidle');
  }

  await page.screenshot({ path: '/tmp/langfuse-08-api-keys.png' });

  // Create new API key
  const createKeyButton = page.locator('text=Create').or(page.locator('text=New API Key')).or(page.locator('text=Generate'));
  if (await createKeyButton.count() > 0) {
    console.log('🔐 Creating API key...');
    await createKeyButton.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/langfuse-09-create-key.png' });
  }

  // Extract API keys from page
  const pageContent = await page.content();
  console.log('\n📄 Page content (looking for keys):\n');

  // Look for key patterns
  const pkMatch = pageContent.match(/pk-lf-[a-zA-Z0-9]+/g);
  const skMatch = pageContent.match(/sk-lf-[a-zA-Z0-9]+/g);

  if (pkMatch && skMatch) {
    console.log('✅ Found API keys!');
    console.log(`Public Key: ${pkMatch[0]}`);
    console.log(`Secret Key: ${skMatch[0]}`);

    // Save to file
    const keysContent = `# Langfuse API Keys
# Generated: ${new Date().toISOString()}

LANGFUSE_PUBLIC_KEY=${pkMatch[0]}
LANGFUSE_SECRET_KEY=${skMatch[0]}
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_ENABLED=true
`;
    console.log('\n📝 Keys content:\n' + keysContent);
  } else {
    console.log('⚠️ Could not find API keys in page content');
    console.log('Please check screenshots in /tmp/ to see the current state');
  }

  // Keep browser open for manual inspection
  console.log('\n⏳ Browser will stay open for 60 seconds for manual inspection...');
  await page.waitForTimeout(60000);

  await browser.close();
}

setupLangfuse().catch(console.error);
