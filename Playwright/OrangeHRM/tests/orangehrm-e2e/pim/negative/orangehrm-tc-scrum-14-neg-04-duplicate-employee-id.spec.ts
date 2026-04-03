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

  test('TC-SCRUM-14-NEG-04: Submit Add Employee form with a duplicate Employee ID shows error', async ({ page }) => {
    // 1. Navigate to Employee List and note the ID from the first row
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('.oxd-table-body .oxd-table-row').first();
    const idCell = firstRow.locator('.oxd-table-cell').nth(1);
    await expect(idCell).not.toBeEmpty();
    const existingId = (await idCell.innerText()).trim();

    // 2. Navigate to Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 3. Enter unique name fields
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially('DupIdNeg' + Date.now());
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially('Test');

    // 4. Clear the auto-generated Employee Id and enter the existing one
    const empIdInput = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput.clear();
    await empIdInput.pressSequentially(existingId);

    // 5. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Error message indicating the Employee Id already exists
    await expect(page.getByText(/already exists/i)).toBeVisible();

    // expect: Form does not submit — Add Employee heading still visible
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
