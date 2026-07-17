import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    baseURL: 'https://meet.livekit.phuket-tourist.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'chromium-tablet',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'chromium-desktop-1280',
      use: {
        viewport: { width: 1280, height: 720 },
        headless: true,
      },
    },
    {
      name: 'chromium-desktop-1440',
      use: {
        viewport: { width: 1440, height: 900 },
        headless: true,
      },
    },
    {
      name: 'chromium-desktop-1920',
      use: {
        viewport: { width: 1920, height: 1080 },
        headless: true,
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});