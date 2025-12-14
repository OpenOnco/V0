// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * OpenOnco Playwright Test Configuration
 * 
 * Run tests: npx playwright test
 * Run with UI: npx playwright test --ui
 */

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },

  timeout: 60000,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
