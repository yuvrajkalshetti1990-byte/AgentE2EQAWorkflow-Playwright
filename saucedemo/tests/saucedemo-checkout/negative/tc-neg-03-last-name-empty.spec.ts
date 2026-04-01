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

  test('TC-NEG-03: Submit checkout form with Last Name empty', async ({ page }) => {
    // 1. Fill First Name and Zip, leave Last Name empty
    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="postalCode"]').fill('12345');

    // 2. Click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error shows Last Name is required and user stays on the page
    await expect(page.locator('[data-test="error"]')).toContainText('Error: Last Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
