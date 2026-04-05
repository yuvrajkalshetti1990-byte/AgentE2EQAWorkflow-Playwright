// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-9: Clicking the X button on a validation error dismisses the error message

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

  // AC-9: Clicking the X button on a validation error dismisses the error message
  test('TC-NEG-05: Error dismissal by clicking the X on the error message', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-05: error dismissal via X button');
    const checkoutPage = new CheckoutPage(page);

    // 1. Submit empty form to trigger error
    await checkoutPage.submitEmpty();
    await checkoutPage.assertError('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 2. Click the X close button on the error message
    await checkoutPage.dismissError();

    // 3. Assert error is dismissed and no longer visible
    await checkoutPage.assertErrorNotVisible();

    // 4. Assert form fields remain editable (user can still enter data)
    console.log('[ASSERT] Verifying form fields are still editable after error dismissal');
    await checkoutPage.assertFormEditable();
    console.log('[NAV] Final url: %s', page.url());
  });
});
