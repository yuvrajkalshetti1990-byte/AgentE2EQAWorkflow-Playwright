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

  test('TC-NEG-04: Submit checkout form with Zip/Postal Code empty', async ({ page }) => {
    // 1. Fill First Name and Last Name, leave Zip empty
    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="lastName"]').fill('Doe');

    // 2. Click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error shows Postal Code is required and user stays on the page
    await expect(page.locator('[data-test="error"]')).toContainText('Error: Postal Code is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
