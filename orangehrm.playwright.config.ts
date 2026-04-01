import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.resolve(__dirname, 'OrangeHRM/.auth/admin.json');

export default defineConfig({
  testDir: './OrangeHRM/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'OrangeHRM/playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL:
      'https://opensource-demo.orangehrmlive.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // --- Auth setup (runs once, saves session to OrangeHRM/.auth/admin.json) ---
    {
      name: 'setup',
      testMatch: '**/seed.spec.ts',
    },

    // --- Test suites (depend on setup, reuse saved auth state) ---
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: '**/seed.spec.ts',
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: '**/seed.spec.ts',
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: '**/seed.spec.ts',
    },
  ],
});
