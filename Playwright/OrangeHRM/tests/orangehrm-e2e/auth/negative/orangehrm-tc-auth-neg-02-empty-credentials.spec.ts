// spec: SCRUM-8 — Authentication: Empty Credentials Validation
// seed: tests/seed.spec.ts (overridden — this test requires a clean unauthenticated state)

import { test, expect } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';

// Override project-level storageState so this test starts unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication — Empty Credentials Validation', () => {
  test('Login with empty username and password shows Required validation errors', async ({ page }) => {
    // 1. Navigate to the OrangeHRM login page
    await page.goto(`${BASE}/web/index.php/auth/login`);

    // 2. Leave username and password fields empty and click Login
    await page.locator('[type="submit"]').click();

    // 3. Verify "Required" validation error is shown for the username field
    const requiredErrors = page.locator('.oxd-input-field-error-message', { hasText: 'Required' });
    await expect(requiredErrors.first()).toBeVisible();

    // 4. Verify user remains on the login page
    await expect(page).toHaveURL(/auth\/login/);
  });
});
