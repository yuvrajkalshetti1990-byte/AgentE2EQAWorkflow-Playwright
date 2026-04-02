// spec: Playwright/OrangeHRM/SCRUM-9-pim-employee-lifecycle-test-plan.md
// seed: Playwright/OrangeHRM/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Happy Path – Add Employee', () => {
  test('TC-PIM-HP-01: Add a new employee with required fields only', async ({ page }) => {
    // 1. Navigate to PIM > Add Employee page (/web/index.php/pim/addEmployee)
    await page.goto('/web/index.php/pim/addEmployee');

    // expect: Add Employee form is displayed
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    // expect: First Name, Middle Name, and Last Name text fields are visible
    const firstNameInput = page.getByPlaceholder('First Name');
    const middleNameInput = page.getByPlaceholder('Middle Name');
    const lastNameInput = page.getByPlaceholder('Last Name');
    await expect(firstNameInput).toBeVisible();
    await expect(middleNameInput).toBeVisible();
    await expect(lastNameInput).toBeVisible();

    // expect: Employee Id field is pre-populated with an auto-generated value
    const employeeIdInput = page
      .locator('.oxd-form-row')
      .filter({ has: page.locator('label', { hasText: 'Employee Id' }) })
      .locator('input.oxd-input');
    await expect(employeeIdInput).not.toHaveValue('');

    // expect: Save and Cancel buttons are present
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // 2. Clear any pre-filled values and type 'Test' in the First Name field
    await firstNameInput.clear();
    await firstNameInput.fill('Test');

    // expect: First Name field contains 'Test'
    await expect(firstNameInput).toHaveValue('Test');

    // 3. Leave Middle Name empty and type 'Automation' in the Last Name field
    await lastNameInput.clear();
    await lastNameInput.fill('Automation');

    // expect: Last Name field contains 'Automation'
    await expect(lastNameInput).toHaveValue('Automation');

    // expect: Middle Name field remains empty
    await expect(middleNameInput).toHaveValue('');

    // 4. Note the auto-generated Employee Id value shown in the Employee Id field
    // expect: Employee Id field is pre-populated
    const employeeId = await employeeIdInput.inputValue();
    expect(employeeId).not.toBe('');

    // 5. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: User is redirected to the new employee's Personal Details profile page
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // expect: A success toast notification appears confirming the save
    await expect(page.locator('.oxd-toast--success')).toBeVisible({ timeout: 10000 });

    // expect: The employee name 'Test Automation' is displayed in the profile header
    await expect(page.locator('.orangehrm-edit-employee-name-header')).toContainText('Test Automation');

    // expect: The Personal Details tab is active by default
    await expect(page).toHaveURL(/viewPersonalDetails/);

    // 6. Navigate back to PIM > Employee List and search for the newly added employee by first name 'Test'
    await page.goto('/web/index.php/pim/viewEmployeeList');

    // Type 'Test' in the Employee Name autocomplete search field
    const searchInput = page.locator('.oxd-autocomplete-text-input > input');
    await searchInput.fill('Test');

    // Wait for autocomplete dropdown and select 'Test Automation'
    await expect(page.locator('.oxd-autocomplete-dropdown')).toBeVisible({ timeout: 10000 });
    await page.locator('.oxd-autocomplete-dropdown').getByRole('option', { name: 'Test Automation' }).click();

    // Click Search
    await page.getByRole('button', { name: 'Search' }).click();

    // expect: The employee 'Test Automation' appears in the search results table
    await expect(page.locator('.oxd-table-body')).toContainText('Test Automation', { timeout: 10000 });

    // Cleanup: Delete the created employee to keep the shared demo environment clean
    const employeeRow = page
      .locator('.oxd-table-row')
      .filter({ hasText: 'Test Automation' })
      .first();

    // Click the Delete icon button (last icon-button in the actions cell — Edit, then Delete)
    await employeeRow.locator('button.oxd-icon-button').last().click();

    // expect: Confirmation dialog appears; confirm deletion
    await expect(page.locator('.orangehrm-dialog-popup')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();

    // expect: Employee is removed from the list
    await expect(page.locator('.oxd-table-body')).not.toContainText('Test Automation', { timeout: 10000 });
  });
});
