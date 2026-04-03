// spec: SCRUM-14-pim-new-employee-onboarding-test-plan.md
// seed: Playwright/OrangeHRM/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';

async function ensureAuth(page: any) {
  await page.goto(`${BASE}/web/index.php/dashboard/index`);
  if (page.url().includes('/auth/login')) {
    await page.locator('[name="username"]').fill('Admin');
    await page.locator('[name="password"]').fill('admin123');
    await page.locator('[type="submit"]').click();
    await page.waitForURL(/dashboard\/index/, { timeout: 15000 });
  }
}

test.describe('PIM — New Employee Onboarding — Negative / Validation', () => {
  test.beforeEach(async ({ page }) => { await ensureAuth(page); });

  test('TC-SCRUM-14-NEG-05: Create Login Details with an already-used username shows Already exists error', async ({ page }) => {
    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 2. Enter unique name fields
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially('DupUserNeg' + Date.now());
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially('Test');

    // 3. Toggle the 'Create Login Details' switch
    await page.locator('.user-form-header .oxd-switch-wrapper label').click();
    await expect(page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input')).toBeVisible();

    // 4. Enter 'Admin' in Username (already exists)
    await page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input').pressSequentially('Admin');

    // 5. Enter matching passwords
    await page.locator('.oxd-input-group').filter({ hasText: /^Password$/ }).locator('input').pressSequentially('TestPwd@2024');
    await page.locator('.oxd-input-group').filter({ hasText: 'Confirm Password' }).locator('input').pressSequentially('TestPwd@2024');

    // 6. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: A validation error 'Already exists' appears near the Username field
    await expect(page.getByText(/already exists/i)).toBeVisible();

    // expect: Form does not submit — Add Employee heading still visible
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
