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

  test('TC-SCRUM-14-HP-04: Add employee with Create Login Details enabled (Status: Disabled)', async ({ page }) => {
    const ts = Date.now();
    const firstName = `LoginDis${ts}`;
    const lastName = 'SCRUM14';
    const username = `emp.dis.${ts}`;

    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
    await expect(page.locator('.user-form-header input[type="checkbox"]')).not.toBeChecked();

    // 2. Enter unique first and last name
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);

    // 3. Check the 'Create Login Details' toggle switch
    await page.locator('.user-form-header .oxd-switch-wrapper label').click();
    await expect(page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input')).toBeVisible();

    // 4. Enter a unique username
    await page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('input').pressSequentially(username);

    // 5. Enter matching password and confirm password
    await page.locator('.oxd-input-group').filter({ hasText: /^Password$/ }).locator('input').pressSequentially('TestPwd@2024');
    await page.locator('.oxd-input-group').filter({ hasText: 'Confirm Password' }).locator('input').pressSequentially('TestPwd@2024');

    // Set unique Employee Id to avoid parallel test race conditions
    const empIdInput4 = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput4.clear();
    await empIdInput4.pressSequentially(`P04${ts.toString().slice(-6)}`);

    // 6. Set Status to 'Disabled'
    await page.getByRole('radio', { name: 'Disabled' }).click({ force: true });
    await expect(page.getByRole('radio', { name: 'Disabled' })).toBeChecked();

    // 7. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // 8. Teardown
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(firstName.slice(0, 9));
    await page.waitForTimeout(1000);
    const option = page.getByRole('option').first();
    if (await option.isVisible()) await option.click();
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');
    await page.locator('.oxd-table-row', { hasText: firstName }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(page.getByText('Successfully Deleted')).toBeVisible();
  });
});
