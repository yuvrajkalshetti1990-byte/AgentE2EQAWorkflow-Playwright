// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-10: Order Overview page displays payment info, shipping info, and accurate price summary

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

test.describe('Order Overview', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWithDefaults();
  });

  // AC-10: Order Overview page displays payment info, shipping info, and accurate price summary
  test('TC-OVW-01: Overview page displays payment info, shipping info, and price summary', async ({ page }) => {
    console.log('[STEP] Starting TC-OVW-01: overview page details verification');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    const checkoutPage  = new CheckoutPage(page);

    // 1. Add Sauce Labs Fleece Jacket ($49.99) to cart and verify badge
    await inventoryPage.addToCart('add-to-cart-sauce-labs-fleece-jacket');
    await inventoryPage.assertCartBadge('1');

    // 2. Navigate to cart and click Checkout
    await inventoryPage.goToCart();
    await cartPage.clickCheckout();

    // 3. Fill in checkout information and continue to overview
    await checkoutPage.fillInfo('Chris', 'Evans', '02101');
    await checkoutPage.clickContinue();
    await expect(page).toHaveURL(/checkout-step-two\.html/);

    // 4. Verify item is shown in the overview
    await checkoutPage.assertOverviewItem(0, 'Sauce Labs Fleece Jacket', '$49.99');

    // 5. Verify Payment and Shipping Information sections
    await checkoutPage.assertOverviewPaymentShipping('SauceCard #31337', 'Free Pony Express Delivery!');

    // 6. Verify price summary: Item total, Tax, and Total
    await checkoutPage.assertOverviewSummary('Item total: $49.99', 'Tax: $4.00', 'Total: $53.99');

    // 7. Verify Cancel and Finish buttons are visible and clickable
    console.log('[ASSERT] Verifying Cancel and Finish buttons are visible');
    await checkoutPage.assertCancelFinishVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
