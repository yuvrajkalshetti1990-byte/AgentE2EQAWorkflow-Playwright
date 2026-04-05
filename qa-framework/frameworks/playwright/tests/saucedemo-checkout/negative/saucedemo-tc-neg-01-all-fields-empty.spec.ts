// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-5: Submitting the checkout form with all fields empty shows a validation error

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWithDefaults();
  });

  // AC-5: Submitting the checkout form with all fields empty shows a validation error
  test('TC-NEG-01: Submit checkout form with all fields empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-01: all-fields-empty validation');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    const checkoutPage  = new CheckoutPage(page);

    // 1. Add any item to cart and navigate to checkout info page
    await inventoryPage.addToCart('add-to-cart-sauce-labs-backpack');
    await inventoryPage.goToCart();
    await cartPage.clickCheckout();

    // 2. Leave all fields empty and submit
    await checkoutPage.submitEmpty();

    // 3. Assert error message is displayed and user stays on same page
    console.log('[ASSERT] Expected error for First Name is required, url: %s', page.url());
    await checkoutPage.assertError('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
