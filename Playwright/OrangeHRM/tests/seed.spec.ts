// OrangeHRM shared authentication seed
// Logs in as Admin and saves storage state so all tests reuse the session.
// Referenced by orangehrm.playwright.config.ts as a setup project.

import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const AUTH_FILE = path.resolve(__dirname, '../.auth/admin.json');

setup('authenticate: OrangeHRM Admin', async ({ page }) => {
  await page.goto(
    'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login'
  );

  await page.locator('[name="username"]').fill(
    process.env.ORANGEHRM_USERNAME ?? 'Admin'
  );
  await page.locator('[name="password"]').fill(
    process.env.ORANGEHRM_PASSWORD ?? 'admin123'
  );
  await page.locator('[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });

  // Persist the authenticated session for all downstream tests
  await page.context().storageState({ path: AUTH_FILE });
});
