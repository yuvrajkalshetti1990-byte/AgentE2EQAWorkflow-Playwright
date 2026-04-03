// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-6: Submitting the checkout form with First Name empty shows a validation error

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

  // AC-6: Submitting the checkout form with First Name empty shows a validation error
  test('TC-NEG-02: Submit checkout form with First Name empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-02: first-name empty validation');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('12345');

    // 2. Click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error shows First Name is required and user stays on the page
    console.log('[ASSERT] Expected error for First Name is required, url: %s', page.url());
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
