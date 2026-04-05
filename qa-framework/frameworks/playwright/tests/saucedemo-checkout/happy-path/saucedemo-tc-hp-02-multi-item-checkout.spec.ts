// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-3: Complete multi-item checkout with correct price calculations

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

test.describe('Happy Path – Full Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWithDefaults();
  });

  // AC-3: Complete multi-item checkout with correct price calculations
  test('TC-HP-02: Complete multi-item checkout with correct price calculations', async ({ page }) => {
    console.log('[STEP] Starting TC-HP-02: multi-item checkout and price verification');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    const checkoutPage  = new CheckoutPage(page);

    // 1. Add Sauce Labs Backpack and Bike Light to cart
    await inventoryPage.addToCart('add-to-cart-sauce-labs-backpack');
    await inventoryPage.addToCart('add-to-cart-sauce-labs-bike-light');
    await inventoryPage.assertCartBadge('2');

    // 2. Navigate to cart page and verify both items
    await inventoryPage.goToCart();
    await cartPage.assertPageLoaded();
    await cartPage.assertItem(0, 'Sauce Labs Backpack', '$29.99');
    await cartPage.assertItem(1, 'Sauce Labs Bike Light', '$9.99');

    // 3. Verify Continue Shopping and Checkout buttons are visible
    await expect(page.locator(cartPage.continueShoppingButton)).toBeVisible();
    await expect(page.locator(cartPage.checkoutButton)).toBeVisible();

    // 4. Click Checkout and fill info
    await cartPage.clickCheckout();
    await checkoutPage.fillInfo('Jane', 'Smith', '90210');

    // 5. Click Continue to proceed to overview
    await checkoutPage.clickContinue();

    // 6. Verify overview shows both items
    await checkoutPage.assertOverviewItem(0, 'Sauce Labs Backpack', '$29.99');
    await checkoutPage.assertOverviewItem(1, 'Sauce Labs Bike Light', '$9.99');

    // 7. Verify item total, tax, and overall total
    await checkoutPage.assertOverviewSummary('Item total: $39.98', 'Tax: $3.20', 'Total: $43.18');

    // 8. Click Finish to place the order and verify confirmation
    await checkoutPage.clickFinish();
    await checkoutPage.assertOrderConfirmation();

    // 9. Verify cart is cleared
    console.log('[ASSERT] Verifying order confirmation and empty cart badge');
    await expect(page.locator(inventoryPage.cartBadge)).not.toBeVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
