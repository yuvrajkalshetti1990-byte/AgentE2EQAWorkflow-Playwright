// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-7: Submitting the checkout form with Last Name empty shows a validation error

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

  // AC-7: Submitting the checkout form with Last Name empty shows a validation error
  test('TC-NEG-03: Submit checkout form with Last Name empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-03: last-name empty validation');
    const checkoutPage = new CheckoutPage(page);

    // 1. Fill first name and postal code only (last name left empty)
    await checkoutPage.fillInfo('John', '', '12345');

    // 2. Click Continue
    await checkoutPage.submitEmpty();

    // 3. Assert error shows Last Name is required and user stays on the page
    console.log('[ASSERT] Expected error for Last Name is required, url: %s', page.url());
    await checkoutPage.assertError('Error: Last Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
