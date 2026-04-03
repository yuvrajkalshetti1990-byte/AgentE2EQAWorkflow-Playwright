// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-9: Clicking the X button on a validation error dismisses the error message

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

  // AC-9: Clicking the X button on a validation error dismisses the error message
  test('TC-NEG-05: Error dismissal by clicking the X on the error message', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-05: error dismissal via X button');
    await page.locator('[data-test="continue"]').click();
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');

    // 2. Click the X close button on the error message
    await page.locator('[data-test="error"] button').click();

    // 3. Assert error is dismissed and no longer visible
    await expect(page.locator('[data-test="error"]')).not.toBeVisible();

    // 4. Assert form fields remain editable (user can still enter data)
    console.log('[ASSERT] Verifying form fields are still editable after error dismissal');
    await expect(page.locator('[data-test="firstName"]')).toBeEditable();
    await expect(page.locator('[data-test="lastName"]')).toBeEditable();
    await expect(page.locator('[data-test="postalCode"]')).toBeEditable();
    console.log('[NAV] Final url: %s', page.url());
  });
});
