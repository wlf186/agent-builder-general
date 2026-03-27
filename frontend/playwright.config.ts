import { defineConfig, devices } from '@playwright/test';

/**
 * 全局环境检查：远程 X11 环境禁止使用 Test Runner
 *
 * 原因：Test Runner 自动管理浏览器生命周期，在远程 X11 中会导致
 * "Target page, context or browser has been closed" 错误
 *
 * 解决方案：远程 X11 环境必须使用 `node xxx.mjs` 直接运行脚本
 */
function checkDisplayEnvironment() {
  const display = process.env.DISPLAY || '';
  const isHeaded = !process.env.CI && process.env.HEADLESS !== 'true';

  // 只在 headed 模式下检查
  if (isHeaded && display) {
    const isLocal = display.startsWith(':') || display.startsWith('unix:');
    if (!isLocal) {
      const errorMsg = `
⛔⛔⛔ 绝对红线：远程 X11 环境禁止使用 Playwright Test Runner ⛔⛔⛔

检测到远程显示器: DISPLAY=${display}

原因: Test Runner 会自动关闭浏览器，在远程 X11 中会导致连接断裂

解决方案:
  ❌ npx playwright test xxx.spec.ts --headed
  ✅ node xxx.mjs  (直接运行脚本)

参考: docs/references/testing-guide.md
`;
      throw new Error(errorMsg);
    }
  }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:20880',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 全局环境检查
  globalSetup: require.resolve('./tests/global-setup'),
  // 不使用 webServer，手动管理服务生命周期
  // webServer: {
  //   command: 'echo "Using existing server"',
  //   port: 20880,
  //   reuseExistingServer: true,
  // },
});
