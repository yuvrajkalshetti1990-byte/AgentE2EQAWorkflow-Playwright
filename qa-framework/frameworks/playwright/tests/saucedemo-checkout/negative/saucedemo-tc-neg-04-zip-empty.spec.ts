// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-8: Submitting the checkout form with Zip/Postal Code empty shows a validation error

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    console.log('[STEP] Logging in and navigating to checkout info page');
    await new LoginPage(page).loginWithDefaults();
    await inventoryPage.addToCart('add-to-cart-sauce-labs-backpack');
    await inventoryPage.goToCart();
    await cartPage.clickCheckout();
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
