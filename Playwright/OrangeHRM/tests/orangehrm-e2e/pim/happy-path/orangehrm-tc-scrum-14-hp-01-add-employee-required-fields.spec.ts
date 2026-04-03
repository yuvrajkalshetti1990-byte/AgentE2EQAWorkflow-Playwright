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

  test('TC-SCRUM-14-HP-01: Add new employee with required fields only (First Name and Last Name)', async ({ page }) => {
    const ts = Date.now();
    const firstName = `OnboardHP01${ts}`;
    const lastName = 'SCRUM14';

    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'First Name' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Last Name' })).toBeVisible();
    await expect(page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input')).not.toBeEmpty();
    await expect(page.locator('.user-form-header input[type="checkbox"]')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // 2. Enter unique first name using pressSequentially
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);

    // 3. Leave Middle Name empty and enter last name
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);

    // 4. Set unique Employee Id to avoid parallel test race conditions
    const empIdInput = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput.clear();
    await empIdInput.pressSequentially(`P01${ts.toString().slice(-6)}`);

    // 5. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Redirected to the new employee's Personal Details profile page
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // expect: Personal Details tab is active by default
    await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();

    // 6. Teardown: navigate to Employee List, search and delete
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(firstName.slice(0, 10));
    await page.waitForTimeout(1000);
    const option = page.getByRole('option').first();
    if (await option.isVisible()) await option.click();
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.oxd-table-row', { hasText: firstName }).getByRole('button').nth(1).click();
    await expect(page.getByRole('button', { name: 'Yes, Delete' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect(page.getByText('Successfully Deleted')).toBeVisible();
  });
});
