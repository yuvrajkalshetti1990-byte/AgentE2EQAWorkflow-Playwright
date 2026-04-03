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

  test('TC-SCRUM-14-HP-07: Employee profile tabs are accessible immediately after onboarding', async ({ page }) => {
    test.setTimeout(60000);
    const ts = Date.now();
    const firstName = `TabTest${ts}`;
    const lastName = 'SCRUM14';

    // 1. Create the employee with unique ID to avoid parallel race
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);
    const empIdInput7 = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput7.clear();
    await empIdInput7.pressSequentially(`P07${ts.toString().slice(-6)}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // 2. Verify the profile tab menu is visible
    await expect(page.locator('.orangehrm-tabs-item', { hasText: 'Personal Details' })).toBeVisible();
    await expect(page.locator('.orangehrm-tabs-item', { hasText: 'Contact Details' })).toBeVisible();
    await expect(page.locator('.orangehrm-tabs-item', { hasText: 'Emergency Contacts' })).toBeVisible();
    await expect(page.locator('.orangehrm-tabs-item', { hasText: 'Job' })).toBeVisible();

    // 3. Click on the 'Contact Details' tab
    await page.locator('.orangehrm-tabs-item', { hasText: 'Contact Details' }).click();
    await expect(page.getByRole('heading', { name: 'Contact Details' })).toBeVisible();

    // 4. Click on the 'Job' tab
    await page.locator('.orangehrm-tabs-item', { hasText: 'Job' }).click();
    await expect(page.getByRole('heading', { name: 'Job Details' })).toBeVisible();

    // 5. Teardown
    await page.goto(`${BASE}/web/index.php/pim/viewEmployeeList`);
    await page.locator('.oxd-input-group').filter({ hasText: 'Employee Name' }).locator('input').pressSequentially(firstName.slice(0, 7));
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
