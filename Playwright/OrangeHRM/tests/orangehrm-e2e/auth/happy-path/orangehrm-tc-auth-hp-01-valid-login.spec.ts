// spec: SCRUM-8 — Authentication: Valid Login, Invalid Credentials, and Session Handling
// seed: tests/seed.spec.ts (overridden — this test requires a clean unauthenticated state)

import { test, expect } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';

// Override project-level storageState so this test starts unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication — Valid Login', () => {
  test('Valid login with correct credentials navigates to dashboard', async ({ page }) => {
    // 1. Navigate to the OrangeHRM login page
    await page.goto(`${BASE}/web/index.php/auth/login`);

    // 2. Verify the login page is displayed with username and password fields
    await expect(page.locator('[name="username"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();

    // 3. Enter username "Admin" in the username field
    await page.locator('[name="username"]').fill('Admin');

    // 4. Enter password "admin123" in the password field
    await page.locator('[name="password"]').fill('admin123');

    // 5. Click the Login button
    await page.locator('[type="submit"]').click();

    // 6. Verify successful login — URL should contain "dashboard/index"
    await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });
  });
});
