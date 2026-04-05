import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Runtime environment validation — confirms BASE_URL is reachable and matches expected host.
  // Set ENV_CHECK_SKIP=true to bypass (emergency only; never set in CI).
  globalSetup: './global-setup.ts',

  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./reporters/flaky-reporter.ts'],
  ],
  use: {
    // Allow per-run override via BASE_URL env var; SauceDemo is the default.
    // Example: BASE_URL=https://demoqa.com npx playwright test ...
    baseURL: process.env.BASE_URL ?? 'https://www.saucedemo.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/seed.spec.ts', '**/example.spec.ts', '**/*.notimplemented.spec.ts'],
    },
    // Firefox and WebKit disabled — Chromium-only for CI performance.
    // Re-enable for cross-browser runs by removing the comment blocks below.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    //   testIgnore: ['**/seed.spec.ts', '**/example.spec.ts', '**/*.notimplemented.spec.ts'],
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   testIgnore: ['**/seed.spec.ts', '**/example.spec.ts', '**/*.notimplemented.spec.ts'],
    // },
  ],
});

