// spec: SCRUM-9-pim-employee-lifecycle-test-plan.md
// seed: Playwright/OrangeHRM/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('OrangeHRM PIM — Negative Validation Tests', () => {
  test('TC-PIM-NEG-01 Submit Add Employee form with First Name empty', async ({ page }) => {
    // 1. Navigate to /web/index.php/pim/addEmployee
    await page.goto('/web/index.php/pim/addEmployee');

    // 2. Leave First Name blank
    // (no action needed — field is empty by default)

    // 3. Enter 'Doe' in Last Name field
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially('Doe');

    // 4. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();

    // 5. Expect a 'Required' validation error message to appear under the First Name field
    await expect(page.getByText('Required')).toBeVisible();

    // 6. Expect the form does NOT submit (user remains on the Add Employee page)
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
  });
});
