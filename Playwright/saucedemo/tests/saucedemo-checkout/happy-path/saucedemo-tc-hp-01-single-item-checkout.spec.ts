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

  test('TC-HP-01: Complete single-item checkout from login to order confirmation', async ({ page }) => {
    // 1. Verify inventory page is displayed with Products heading
    await expect(page.locator('.title')).toHaveText('Products');

    // 2. Click 'Add to cart' button for Sauce Labs Backpack
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();

    // 3. Verify cart badge shows '1' and button changed to Remove
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
    await expect(page.locator('[data-test="remove-sauce-labs-backpack"]')).toBeVisible();

    // 4. Navigate to cart page
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.locator('.title')).toHaveText('Your Cart');

    // 5. Verify Backpack appears in cart with correct details
    await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Backpack');
    await expect(page.locator('.inventory_item_price')).toHaveText('$29.99');
    await expect(page.locator('[data-test="continue-shopping"]')).toBeVisible();
    await expect(page.locator('[data-test="checkout"]')).toBeVisible();

    // 6. Click the Checkout button
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 7. Fill in checkout information
    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('12345');

    // 8. Click Continue to proceed to overview
    await page.locator('[data-test="continue"]').click();
    await expect(page).toHaveURL(/checkout-step-two\.html/);

    // 9. Verify overview page details
    await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Backpack');
    await expect(page.locator('.inventory_item_price')).toHaveText('$29.99');
    await expect(page.locator('.summary_info')).toContainText('SauceCard #31337');
    await expect(page.locator('.summary_info')).toContainText('Free Pony Express Delivery!');
    await expect(page.locator('.summary_subtotal_label')).toContainText('Item total: $29.99');
    await expect(page.locator('.summary_tax_label')).toContainText('Tax: $2.40');
    await expect(page.locator('.summary_total_label')).toContainText('Total: $32.39');
    await expect(page.locator('[data-test="cancel"]')).toBeVisible();
    await expect(page.locator('[data-test="finish"]')).toBeVisible();

    // 10. Click Finish to place the order
    await page.locator('[data-test="finish"]').click();
    await expect(page).toHaveURL(/checkout-complete\.html/);

    // 11. Verify order confirmation page
    await expect(page.locator('h2')).toHaveText('Thank you for your order!');
    await expect(page.locator('.complete-text')).toHaveText(
      'Your order has been dispatched, and will arrive just as fast as the pony can get there!'
    );
    await expect(page.locator('[data-test="back-to-products"]')).toBeVisible();

    // 12. Click Back Home button
    await page.locator('[data-test="back-to-products"]').click();
    await expect(page).toHaveURL(/inventory\.html/);

    // 13. Verify cart badge is absent (cart is cleared after order)
    await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  });
});
