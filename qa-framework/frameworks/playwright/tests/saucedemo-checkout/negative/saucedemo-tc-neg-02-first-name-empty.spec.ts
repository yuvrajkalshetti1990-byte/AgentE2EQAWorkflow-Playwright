// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-6: Submitting the checkout form with First Name empty shows a validation error

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
