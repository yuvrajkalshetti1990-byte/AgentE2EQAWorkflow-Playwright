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

  test('TC-SCRUM-14-NEG-03: Submit Add Employee form with Last Name empty shows required error', async ({ page }) => {
    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 2. Enter 'FirstNegTest' in First Name and leave Last Name empty
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially('FirstNegTest');

    // 3. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: 'Required' validation error appears below Last Name
    await expect(page.getByText('Required')).toBeVisible();

    // expect: Form does not submit — Add Employee heading still visible
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
