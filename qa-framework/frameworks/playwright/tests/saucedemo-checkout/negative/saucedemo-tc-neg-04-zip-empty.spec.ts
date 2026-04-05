// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-8: Submitting the checkout form with Zip/Postal Code empty shows a validation error

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

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
    const checkoutPage = new CheckoutPage(page);

    // 1. Fill first and last name only (postal code left empty)
    await checkoutPage.fillInfo('John', 'Doe', '');

    // 2. Click Continue
    await checkoutPage.submitEmpty();

    // 3. Assert error shows Postal Code is required and user stays on the page
    console.log('[ASSERT] Expected error for Postal Code is required, url: %s', page.url());
    await checkoutPage.assertError('Error: Postal Code is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
