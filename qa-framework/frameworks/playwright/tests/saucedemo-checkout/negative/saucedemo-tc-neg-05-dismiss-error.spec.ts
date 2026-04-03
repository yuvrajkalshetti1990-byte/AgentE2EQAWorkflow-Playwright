// spec: specs/saucedemo-checkout-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and authenticate
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory\.html/);

    // Add item and navigate to checkout info page
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.goto('https://www.saucedemo.com/cart.html');
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });

  test('TC-NEG-05: Error dismissal by clicking the X on the error message', async ({ page }) => {
    // 1. Leave all fields empty and click Continue to trigger error
    await page.locator('[data-test="continue"]').click();
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');

    // 2. Click the X close button on the error message
    await page.locator('[data-test="error"] button').click();

    // 3. Assert error is dismissed and no longer visible
    await expect(page.locator('[data-test="error"]')).not.toBeVisible();

    // 4. Assert form fields remain editable (user can still enter data)
    await expect(page.locator('[data-test="firstName"]')).toBeEditable();
    await expect(page.locator('[data-test="lastName"]')).toBeEditable();
    await expect(page.locator('[data-test="postalCode"]')).toBeEditable();
  });
});
