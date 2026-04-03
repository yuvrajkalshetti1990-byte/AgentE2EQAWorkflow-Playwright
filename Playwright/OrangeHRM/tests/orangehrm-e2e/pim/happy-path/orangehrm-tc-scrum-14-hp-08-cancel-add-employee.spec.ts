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

test.describe('PIM — New Employee Onboarding — Happy Path', () => {
  test.beforeEach(async ({ page }) => { await ensureAuth(page); });

  test('TC-SCRUM-14-HP-08: Cancel Add Employee form returns to list without creating a record', async ({ page }) => {
    const firstName = 'CancelHP08Test';
    const lastName = 'SCRUM14Cancel';

    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // 2. Enter first and last name without submitting
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);
    await expect(page.getByRole('textbox', { name: 'First Name' })).toHaveValue(firstName);
    await expect(page.getByRole('textbox', { name: 'Last Name' })).toHaveValue(lastName);

    // 3. Click the Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();

    // expect: Redirected away from Add Employee form
    await expect(page).not.toHaveURL(/pim\/addEmployee/);

    // expect: No save confirmation toast
    await expect(page.getByText('Successfully Saved')).not.toBeVisible();

    // 4. Search Employee List — the employee should NOT exist
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(firstName);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');

    // expect: No employee named CancelHP08Test appears
    await expect(page.locator('.oxd-table-row', { hasText: firstName })).not.toBeVisible();
  });
});
