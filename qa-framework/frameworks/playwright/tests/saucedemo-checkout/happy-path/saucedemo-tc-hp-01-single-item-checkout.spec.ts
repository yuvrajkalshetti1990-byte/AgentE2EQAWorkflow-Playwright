// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-2: Complete single-item checkout from login through order confirmation

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

test.describe('Happy Path – Full Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginWithDefaults();
  });

  // AC-2: Complete single-item checkout from login through order confirmation
  test('TC-HP-01: Complete single-item checkout from login to order confirmation', async ({ page }) => {
    console.log('[STEP] Starting TC-HP-01: single-item checkout');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);
    const checkoutPage  = new CheckoutPage(page);

    await inventoryPage.assertPageLoaded();

    // 2. Add Sauce Labs Backpack to cart
    await inventoryPage.addToCart('add-to-cart-sauce-labs-backpack');
    await inventoryPage.assertCartBadge('1');
    await inventoryPage.assertItemAdded('sauce-labs-backpack');

    // 3. Navigate to cart and verify
    await inventoryPage.goToCart();
    await cartPage.assertPageLoaded();
    await cartPage.assertItem(0, 'Sauce Labs Backpack', '$29.99');
    await expect(page.locator(cartPage.continueShoppingButton)).toBeVisible();
    await expect(page.locator(cartPage.checkoutButton)).toBeVisible();

    // 4. Click Checkout
    await cartPage.clickCheckout();

    // 5. Fill checkout info and continue to overview
    await checkoutPage.fillInfo('John', 'Doe', '12345');
    await checkoutPage.clickContinue();

    // 6. Verify overview page details
    console.log('[ASSERT] Verifying overview page details');
    await checkoutPage.assertOverviewItem(0, 'Sauce Labs Backpack', '$29.99');
    await checkoutPage.assertOverviewPaymentShipping('SauceCard #31337', 'Free Pony Express Delivery!');
    await checkoutPage.assertOverviewSummary('Item total: $29.99', 'Tax: $2.40', 'Total: $32.39');
    await checkoutPage.assertCancelFinishVisible();

    // 7. Finish order and verify confirmation via CheckoutPage POM
    await checkoutPage.clickFinish();
    await checkoutPage.assertOrderConfirmation();

    // 8. Navigate back to products
    await checkoutPage.clickBackToProducts();
    console.log('[NAV] url=%s', page.url());
    await expect(page).toHaveURL(/inventory\.html/);
    console.log('[ASSERT] Verifying cart badge is absent after order completion');
    await inventoryPage.assertCartBadgeAbsent();
    console.log('[NAV] Final url: %s', page.url());
  });
});
