import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'vite --host 127.0.0.1 --port 4300',
      url: 'http://127.0.0.1:4300',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { BFF_TARGET: 'http://127.0.0.1:4301' },
    },
    {
      command: 'npm run dev:bff',
      url: 'http://127.0.0.1:4301',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: '4301' },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/responsive\.spec\.ts/, /bff-integration\.spec\.ts/],
    },
    {
      name: 'iphone',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'ipad',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium' },
    },
    {
      name: 'desktop-2k',
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
      },
    },
    {
      name: 'bff-integration',
      testMatch: /bff-integration\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
