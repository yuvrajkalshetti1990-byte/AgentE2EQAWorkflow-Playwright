// spec: specs/saucedemo-checkout-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Order Overview (AC3)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and authenticate
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory\.html/);
  });

  test('TC-OVW-01: Overview page displays payment info, shipping info, and price summary', async ({ page }) => {
    // 1. Add Sauce Labs Fleece Jacket ($49.99) to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-fleece-jacket"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

    // 2. Navigate to cart and click Checkout
    await page.goto('https://www.saucedemo.com/cart.html');
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 3. Fill in checkout information
    await page.locator('[data-test="firstName"]').fill('Chris');
    await page.locator('[data-test="lastName"]').fill('Evans');
    await page.locator('[data-test="postalCode"]').fill('02101');

    // 4. Click Continue to proceed to overview
    await page.locator('[data-test="continue"]').click();
    await expect(page).toHaveURL(/checkout-step-two\.html/);

    // 5. Verify item is shown in the overview
    await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Fleece Jacket');
    await expect(page.locator('.inventory_item_price')).toHaveText('$49.99');

    // 6. Verify Payment Information section
    await expect(page.locator('.summary_info')).toContainText('SauceCard #31337');

    // 7. Verify Shipping Information section
    await expect(page.locator('.summary_info')).toContainText('Free Pony Express Delivery!');

    // 8. Verify price summary: Item total, Tax, and Total
    await expect(page.locator('.summary_subtotal_label')).toContainText('Item total: $49.99');
    await expect(page.locator('.summary_tax_label')).toContainText('Tax: $4.00');
    await expect(page.locator('.summary_total_label')).toContainText('Total: $53.99');

    // 9. Verify Cancel and Finish buttons are visible and clickable
    await expect(page.locator('[data-test="cancel"]')).toBeVisible();
    await expect(page.locator('[data-test="finish"]')).toBeVisible();
  });
});
