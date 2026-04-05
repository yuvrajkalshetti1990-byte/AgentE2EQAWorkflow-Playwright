// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-4: Cancel from the Checkout Overview page returns user to inventory with cart preserved

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

test.describe('Happy Path – Full Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWithDefaults();
  });

  // AC-4: Cancel from the Checkout Overview page returns user to inventory with cart preserved
  test('TC-HP-03: Checkout cancellation from the Overview page', async ({ page }) => {
    console.log('[STEP] Starting TC-HP-03: cancel from checkout overview');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    const checkoutPage  = new CheckoutPage(page);

    // 1. Add Sauce Labs Onesie to cart and verify badge
    await inventoryPage.addToCart('add-to-cart-sauce-labs-onesie');
    await inventoryPage.assertCartBadge('1');

    // 2. Navigate to cart and verify item
    await inventoryPage.goToCart();
    await cartPage.assertItem(0, 'Sauce Labs Onesie', '$7.99');

    // 3. Click Checkout and fill info
    await cartPage.clickCheckout();
    await checkoutPage.fillInfo('Alice', 'Walker', '10001');

    // 4. Click Continue to proceed to overview and verify
    await checkoutPage.clickContinue();
    await checkoutPage.assertOverviewItem(0, 'Sauce Labs Onesie', '$7.99');
    await checkoutPage.assertOverviewSummary('Item total: $7.99', 'Tax:', 'Total:');

    // 5. Click Cancel on Overview page — returns to inventory
    await checkoutPage.clickCancel();

    // 6. Verify cart badge still shows 1 (order was not placed)
    await inventoryPage.assertCartBadge('1');

    // 7. Verify the Onesie is still in the cart by checking its Remove button is shown
    console.log('[ASSERT] Verifying cart still contains item after cancel (cart not cleared)');
    await expect(page.locator('[data-test="remove-sauce-labs-onesie"]')).toBeVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
