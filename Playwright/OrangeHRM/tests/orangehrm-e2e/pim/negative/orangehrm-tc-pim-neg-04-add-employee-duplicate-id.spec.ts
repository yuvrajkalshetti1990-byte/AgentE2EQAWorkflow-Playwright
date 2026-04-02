// spec: Playwright/OrangeHRM/SCRUM-9-pim-employee-lifecycle-test-plan.md
// seed: Playwright/OrangeHRM/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('OrangeHRM PIM — Negative Validation Tests', () => {
  test('TC-PIM-NEG-04: Add Employee with a duplicate Employee ID', async ({ page }) => {
    // 1. Navigate to PIM > Add Employee page (/web/index.php/pim/addEmployee)
    await page.goto('/web/index.php/pim/addEmployee');

    // expect: Add Employee form is displayed
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // 2. Enter 'Duplicate' in the First Name field
    await page.getByPlaceholder('First Name').fill('Duplicate');

    // expect: First Name field contains 'Duplicate'
    await expect(page.getByPlaceholder('First Name')).toHaveValue('Duplicate');

    // 3. Enter 'Test' in the Last Name field
    await page.getByPlaceholder('Last Name').fill('Test');

    // expect: Last Name field contains 'Test'
    await expect(page.getByPlaceholder('Last Name')).toHaveValue('Test');

    // 4. Clear the Employee Id field and enter '0001' (a known existing Employee Id)
    const employeeIdInput = page
      .locator('.oxd-form-row')
      .filter({ has: page.locator('label', { hasText: 'Employee Id' }) })
      .locator('input.oxd-input');
    await employeeIdInput.clear();
    await employeeIdInput.fill('0001');

    // expect: Employee Id field shows '0001'
    await expect(employeeIdInput).toHaveValue('0001');

    // 5. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: An error message 'Employee Id already exists' appears on the page
    await expect(
      page.locator('.oxd-input-field-error-message', { hasText: 'Employee Id already exists' })
    ).toBeVisible({ timeout: 10000 });

    // expect: User remains on the Add Employee page (no redirect to personal details)
    await expect(page).not.toHaveURL(/viewPersonalDetails/);

    // expect: The Add Employee heading is still visible
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
