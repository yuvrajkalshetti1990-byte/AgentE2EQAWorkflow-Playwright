import { test } from '@playwright/test';

test('seed', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.locator('[name="username"]').fill('Admin');
  await page.locator('[name="password"]').fill('admin123');
  await page.locator('[type="submit"]').click();
  await page.waitForURL(/dashboard\/index/, { timeout: 15000 });
});
