import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ],
  webServer: [
    {
      command: 'npm run dev -w api',
      url: 'http://localhost:3001/products',
      reuseExistingServer: true
    },
    {
      command: 'npm run dev -w web',
      url: 'http://localhost:3000',
      reuseExistingServer: true
    }
  ]
});
