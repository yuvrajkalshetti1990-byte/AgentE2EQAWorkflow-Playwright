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

  test('TC-SCRUM-14-HP-06: Verify newly onboarded employee appears in Employee List', async ({ page }) => {
    const ts = Date.now();
    const firstName = `ListVirf${ts}`;
    const lastName = 'SCRUM14';

    // 1. Create a new employee with unique ID to avoid parallel race
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);
    const empIdInput6 = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput6.clear();
    await empIdInput6.pressSequentially(`P06${ts.toString().slice(-6)}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // 2. Navigate to Employee List and verify the employee appears
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();

    // 3. Search for the created employee
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(firstName.slice(0, 8));
    await page.waitForTimeout(1000);
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');

    // 4. Verify the employee row
    const employeeRow = page.locator('.oxd-table-row', { hasText: firstName });
    await expect(employeeRow).toBeVisible();
    await expect(employeeRow.getByText(lastName)).toBeVisible();
    await expect(employeeRow.getByRole('button').nth(0)).toBeVisible();
    await expect(employeeRow.getByRole('button').nth(1)).toBeVisible();

    // 5. Teardown
    await employeeRow.getByRole('button').nth(1).click();
    await expect(page.getByRole('button', { name: 'Yes, Delete' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(page.getByText('Successfully Deleted')).toBeVisible();
  });
});
