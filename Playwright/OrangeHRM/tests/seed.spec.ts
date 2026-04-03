// OrangeHRM shared authentication seed
// Logs in as Admin and saves storage state so all tests reuse the session.
// Referenced by orangehrm.playwright.config.ts as a setup project.

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../.env') });

export const AUTH_FILE = path.resolve(__dirname, '../.auth/admin.json');

setup('authenticate: OrangeHRM Admin', async ({ page }) => {
  const username = process.env.ORANGEHRM_USERNAME;
  const password = process.env.ORANGEHRM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing credentials: set ORANGEHRM_USERNAME and ORANGEHRM_PASSWORD env vars.\n' +
      'Locally: create a .env file or export them in your shell.\n' +
      'CI: add them as GitHub Secrets (ORANGEHRM_USERNAME, ORANGEHRM_PASSWORD).'
    );
  }

  await page.goto(
    'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login'
  );

  await page.locator('[name="username"]').fill(username);
  await page.locator('[name="password"]').fill(password);
  await page.locator('[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });

  // Persist the authenticated session for all downstream tests
  await page.context().storageState({ path: AUTH_FILE });
});
