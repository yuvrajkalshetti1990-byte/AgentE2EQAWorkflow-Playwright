// spec: specs/saucedemo-checkout-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Cart Review (AC1)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and authenticate
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory\.html/);
  });

  test('TC-CART-01: Cart page displays all required item details', async ({ page }) => {
    // 1. Add Sauce Labs Backpack and Sauce Labs Bolt T-Shirt to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]').click();

    // 2. Verify cart badge shows '2'
    await expect(page.locator('.shopping_cart_badge')).toHaveText('2');

    // 3. Navigate to cart page
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.locator('.title')).toHaveText('Your Cart');

    // 4. Verify Sauce Labs Backpack details
    const cartItems = page.locator('.cart_item');
    await expect(cartItems).toHaveCount(2);
    await expect(page.locator('.inventory_item_name').nth(0)).toHaveText('Sauce Labs Backpack');
    await expect(page.locator('.inventory_item_price').nth(0)).toHaveText('$29.99');

    // 5. Verify Sauce Labs Bolt T-Shirt details
    await expect(page.locator('.inventory_item_name').nth(1)).toHaveText('Sauce Labs Bolt T-Shirt');
    await expect(page.locator('.inventory_item_price').nth(1)).toHaveText('$15.99');

    // 6. Verify item descriptions are visible
    const descriptions = page.locator('.inventory_item_desc');
    await expect(descriptions.nth(0)).toBeVisible();
    await expect(descriptions.nth(1)).toBeVisible();

    // 7. Verify item quantities default to 1
    const quantities = page.locator('.cart_quantity');
    await expect(quantities.nth(0)).toHaveText('1');
    await expect(quantities.nth(1)).toHaveText('1');

    // 8. Verify action buttons at the bottom of the cart
    await expect(page.locator('[data-test="continue-shopping"]')).toBeVisible();
    await expect(page.locator('[data-test="checkout"]')).toBeVisible();
  });
});
