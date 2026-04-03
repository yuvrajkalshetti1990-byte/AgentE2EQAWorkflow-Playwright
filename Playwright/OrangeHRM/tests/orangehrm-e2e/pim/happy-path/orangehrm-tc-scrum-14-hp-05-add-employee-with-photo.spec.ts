// spec: SCRUM-14-pim-new-employee-onboarding-test-plan.md
// seed: Playwright/OrangeHRM/tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import path from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const BASE = 'https://opensource-demo.orangehrmlive.com';
const TEST_PHOTO_PATH = path.resolve(__dirname, 'test-photo.png');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

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
  test.beforeAll(() => { writeFileSync(TEST_PHOTO_PATH, PNG_1X1); });
  test.afterAll(() => { try { unlinkSync(TEST_PHOTO_PATH); } catch { /* ignore */ } });
  test.beforeEach(async ({ page }) => { await ensureAuth(page); });

  test('TC-SCRUM-14-HP-05: Add employee with profile photo upload', async ({ page }) => {
    const ts = Date.now();
    const firstName = `PhotoTest${ts}`;
    const lastName = 'SCRUM14';

    // 1. Navigate to the Add Employee form
    await page.goto(`${BASE}/web/index.php/pim/addEmployee`);
    await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
    await expect(page.locator('.employee-image-wrapper')).toBeVisible();

    // 2. Enter unique first and last name
    await page.getByRole('textbox', { name: 'First Name' }).pressSequentially(firstName);
    await page.getByRole('textbox', { name: 'Last Name' }).pressSequentially(lastName);

    // Set unique Employee Id to avoid parallel test race conditions
    const empIdInput5 = page.locator('.oxd-input-group').filter({ hasText: 'Employee Id' }).locator('input');
    await empIdInput5.clear();
    await empIdInput5.pressSequentially(`P05${ts.toString().slice(-6)}`);

    // 3. Upload a valid image via the file input
    await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO_PATH);

    // expect: Photo area still visible after upload
    await expect(page.locator('.employee-image-wrapper')).toBeVisible();

    // 4. Click the Save button
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

    // 5. Teardown
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
