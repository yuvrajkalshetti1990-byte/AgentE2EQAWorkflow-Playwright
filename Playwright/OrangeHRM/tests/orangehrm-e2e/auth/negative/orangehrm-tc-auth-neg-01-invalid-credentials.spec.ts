// spec: SCRUM-8 — Authentication: Invalid Credentials
// seed: tests/seed.spec.ts (overridden — this test requires a clean unauthenticated state)

import { test, expect } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';

// Override project-level storageState so this test starts unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication — Invalid Credentials', () => {
  test('Login with wrong password shows Invalid credentials error', async ({ page }) => {
    // 1. Navigate to the OrangeHRM login page
    await page.goto(`${BASE}/web/index.php/auth/login`);

    // 2. Enter username "Admin" in the username field
    await page.locator('[name="username"]').fill('Admin');

    // 3. Enter an incorrect password
    await page.locator('[name="password"]').fill('wrongpassword');

    // 4. Click the Login button
    await page.locator('[type="submit"]').click();

    // 5. Verify error message "Invalid credentials" is displayed
    await expect(page.locator('.oxd-alert-content-text')).toContainText('Invalid credentials', { timeout: 10000 });

    // 6. Verify user remains on the login page
    await expect(page).toHaveURL(/auth\/login/);
  });
});
