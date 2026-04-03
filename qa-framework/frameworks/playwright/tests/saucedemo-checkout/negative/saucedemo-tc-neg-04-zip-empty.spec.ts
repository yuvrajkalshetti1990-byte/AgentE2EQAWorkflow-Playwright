// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-8: Submitting the checkout form with Zip/Postal Code empty shows a validation error

import { test, expect } from '@playwright/test';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    const username = process.env.SAUCE_USERNAME ?? 'standard_user';
    const password = process.env.SAUCE_PASSWORD ?? 'secret_sauce';
    console.log('[STEP] Logging in and navigating to checkout info page');
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory\.html/);
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.goto('https://www.saucedemo.com/cart.html');
    await page.locator('[data-test="checkout"]').click();
    console.log('[NAV] url=%s', page.url());
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });

  // AC-8: Submitting the checkout form with Zip/Postal Code empty shows a validation error
  test('TC-NEG-04: Submit checkout form with Zip/Postal Code empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-04: zip-code empty validation');
    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="lastName"]').fill('Doe');

    // 2. Click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error shows Postal Code is required and user stays on the page
    console.log('[ASSERT] Expected error for Postal Code is required, url: %s', page.url());
    await expect(page.locator('[data-test="error"]')).toContainText('Error: Postal Code is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
