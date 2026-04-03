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

  test('TC-SCRUM-14-NEG-06: Create Login Details with mismatched Password and Confirm Password shows mismatch error', async ({ page }) => {
    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 2. Enter unique name fields
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially('PwdMismNeg' + Date.now());
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially('Test');

    // 3. Toggle the 'Create Login Details' switch
    await page.locator('.user-form-header .oxd-switch-wrapper label').click();
    await expect(page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input')).toBeVisible();

    // 4. Enter a unique username
    await page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input').pressSequentially('pwd.mismatch.' + Date.now());

    // 5. Enter 'TestPwd@2024' in Password
    await page.locator('.oxd-input-group').filter({ hasText: /^Password$/ }).locator('input').pressSequentially('TestPwd@2024');

    // 6. Enter a DIFFERENT value in Confirm Password
    await page.locator('.oxd-input-group').filter({ hasText: 'Confirm Password' }).locator('input').pressSequentially('DifferentPwd@9999');

    // 7. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: A validation error 'Passwords do not match' appears
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();

    // expect: Form does not submit — Add Employee heading still visible
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
