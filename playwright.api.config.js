// @ts-check
import { defineConfig } from '@playwright/test';

/**
 * OpenOnco API Test Configuration
 * 
 * Runs API tests against vercel dev server
 */

export default defineConfig({
  testDir: './tests',
  testMatch: 'api.spec.js', // Only run API tests
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    ['html', { outputFolder: 'playwright-report-api' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.API_URL || 'http://localhost:3001',
    actionTimeout: 10000,
  },

  timeout: 30000,

  /* Start vercel dev server for API routes */
  webServer: process.env.API_URL ? undefined : {
    command: 'npx vercel dev --listen 3001 --yes --token=$VERCEL_TOKEN',
    url: 'http://localhost:3001/api/v1/stats',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
