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

  test('TC-SCRUM-14-HP-02: Add new employee with optional Middle Name and custom Employee ID', async ({ page }) => {
    const ts = Date.now();
    const firstName = 'John';
    const middleName = 'Michael';
    const lastName = `CustomOpt${ts}`;
    const customId = 'CID' + ts.toString().slice(-6);

    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 2. Enter First Name, Middle Name, and Last Name
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Middle Name' }).pressSequentially(middleName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);
    await expect(page.getByRole('textbox', { name: 'First Name' })).toHaveValue(firstName);
    await expect(page.getByRole('textbox', { name: 'Middle Name' })).toHaveValue(middleName);

    // 3. Clear the auto-generated Employee Id and enter a custom unique ID
    const empIdInput = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput.clear();
    await empIdInput.pressSequentially(customId);
    await expect(empIdInput).toHaveValue(customId);

    // 4. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Redirected to the new employee's Personal Details page
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // 5. Teardown: delete the created employee
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(lastName.slice(0, 9));
    await page.waitForTimeout(1000);
    const option = page.getByRole('option').first();
    if (await option.isVisible()) await option.click();
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.oxd-table-row', { hasText: lastName }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(page.getByText('Successfully Deleted')).toBeVisible();
  });
});
