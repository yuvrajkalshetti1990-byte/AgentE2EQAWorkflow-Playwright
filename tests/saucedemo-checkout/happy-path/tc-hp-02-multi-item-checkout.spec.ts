// spec: specs/saucedemo-checkout-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Happy Path – Full Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and authenticate
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory\.html/);
  });

  test('TC-HP-02: Complete multi-item checkout with correct price calculations', async ({ page }) => {
    // 1. Add Sauce Labs Backpack to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();

    // 2. Add Sauce Labs Bike Light to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();

    // 3. Verify cart badge shows '2'
    await expect(page.locator('.shopping_cart_badge')).toHaveText('2');

    // 4. Navigate to cart page
    await page.goto('https://www.saucedemo.com/cart.html');

    // 5. Verify both items appear in cart with correct names and prices
    const cartItemNames = page.locator('.inventory_item_name');
    const cartItemPrices = page.locator('.inventory_item_price');
    await expect(cartItemNames).toHaveCount(2);
    await expect(cartItemNames.nth(0)).toHaveText('Sauce Labs Backpack');
    await expect(cartItemNames.nth(1)).toHaveText('Sauce Labs Bike Light');
    await expect(cartItemPrices.nth(0)).toHaveText('$29.99');
    await expect(cartItemPrices.nth(1)).toHaveText('$9.99');

    // 6. Verify Continue Shopping and Checkout buttons are visible
    await expect(page.locator('[data-test="continue-shopping"]')).toBeVisible();
    await expect(page.locator('[data-test="checkout"]')).toBeVisible();

    // 7. Click Checkout button
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 8. Fill in checkout information
    await page.locator('[data-test="firstName"]').fill('Jane');
    await page.locator('[data-test="lastName"]').fill('Smith');
    await page.locator('[data-test="postalCode"]').fill('90210');

    // 9. Click Continue to proceed to overview
    await page.locator('[data-test="continue"]').click();
    await expect(page).toHaveURL(/checkout-step-two\.html/);

    // 10. Verify overview shows both items
    await expect(page.locator('.inventory_item_name').nth(0)).toHaveText('Sauce Labs Backpack');
    await expect(page.locator('.inventory_item_name').nth(1)).toHaveText('Sauce Labs Bike Light');

    // 11. Verify item total, tax, and overall total
    await expect(page.locator('.summary_subtotal_label')).toContainText('Item total: $39.98');
    await expect(page.locator('.summary_tax_label')).toContainText('Tax: $3.20');
    await expect(page.locator('.summary_total_label')).toContainText('Total: $43.18');

    // 12. Click Finish to place the order
    await page.locator('[data-test="finish"]').click();
    await expect(page).toHaveURL(/checkout-complete\.html/);

    // 13. Verify order confirmation and cart is cleared
    await expect(page.locator('h2')).toHaveText('Thank you for your order!');
    await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  });
});
