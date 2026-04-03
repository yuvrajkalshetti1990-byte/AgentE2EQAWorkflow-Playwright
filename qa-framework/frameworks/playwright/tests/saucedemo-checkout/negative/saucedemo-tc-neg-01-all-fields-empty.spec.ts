// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-5: Submitting the checkout form with all fields empty shows a validation error

import { test, expect } from '@playwright/test';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    const username = process.env.SAUCE_USERNAME ?? 'standard_user';
    const password = process.env.SAUCE_PASSWORD ?? 'secret_sauce';
    console.log('[STEP] Logging in as %s', username);
    await page.goto('https://www.saucedemo.com');
    console.log('[NAV] url=%s title=%s', page.url(), await page.title());
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    await page.locator('[data-test="login-button"]').click();
    console.log('[ASSERT] Expected URL to contain /inventory.html, got: %s', page.url());
    await expect(page).toHaveURL(/inventory\.html/);
  });

  // AC-5: Submitting the checkout form with all fields empty shows a validation error
  test('TC-NEG-01: Submit checkout form with all fields empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-01: all-fields-empty validation');
    // 1. Add any item to cart and navigate to checkout info page
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.goto('https://www.saucedemo.com/cart.html');
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 2. Leave all fields empty and click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error message is displayed and user stays on same page
    console.log('[ASSERT] Expected error for First Name is required, url: %s', page.url());
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
