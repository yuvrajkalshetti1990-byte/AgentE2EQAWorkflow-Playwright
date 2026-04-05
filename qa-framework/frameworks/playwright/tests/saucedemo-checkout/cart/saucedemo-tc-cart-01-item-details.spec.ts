// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-1: Cart page displays all cart item details (name, description, quantity, price, action buttons)

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';

test.describe('Cart Review', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginWithDefaults();
  });

  // AC-1: Cart page displays all cart item details (name, description, quantity, price, action buttons)
  test('TC-CART-01: Cart page displays all required item details', async ({ page }) => {
    console.log('[STEP] Starting TC-CART-01: verifying cart item details');
    const inventoryPage = new InventoryPage(page);
    const cartPage      = new CartPage(page);

    // 1. Add two items to cart
    await inventoryPage.addToCart('add-to-cart-sauce-labs-backpack');
    await inventoryPage.addToCart('add-to-cart-sauce-labs-bolt-t-shirt');
    await inventoryPage.assertCartBadge('2');

    // 2. Navigate to cart page
    await inventoryPage.goToCart();
    await cartPage.assertPageLoaded();
    await cartPage.assertItemCount(2);

    // 3. Verify each item's name and price
    await cartPage.assertItem(0, 'Sauce Labs Backpack', '$29.99');
    await cartPage.assertItem(1, 'Sauce Labs Bolt T-Shirt', '$15.99');

    // 4. Verify item descriptions are visible
    console.log('[ASSERT] Verifying item descriptions are visible');
    await expect(page.locator(cartPage.itemDescriptions).nth(0)).toBeVisible();
    await expect(page.locator(cartPage.itemDescriptions).nth(1)).toBeVisible();

    // 5. Verify item quantities default to 1
    await expect(page.locator(cartPage.cartQuantities).nth(0)).toHaveText('1');
    await expect(page.locator(cartPage.cartQuantities).nth(1)).toHaveText('1');

    // 6. Verify action buttons at the bottom of the cart
    console.log('[ASSERT] Verifying Continue Shopping and Checkout buttons are visible');
    await expect(page.locator(cartPage.continueShoppingButton)).toBeVisible();
    await expect(page.locator(cartPage.checkoutButton)).toBeVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
