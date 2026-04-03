// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-10: Order Overview page displays payment info, shipping info, and accurate price summary

import { test, expect } from '@playwright/test';

test.describe('Order Overview', () => {
  test.beforeEach(async ({ page }) => {
    const username = process.env.SAUCE_USERNAME ?? 'standard_user';
    const password = process.env.SAUCE_PASSWORD ?? 'secret_sauce';
    console.log('[STEP] Logging in as %s', username);
    await page.goto('https://www.saucedemo.com');
    console.log('[NAV] url=%s title=%s', page.url(), await page.title());
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    await page.locator('[data-test="login-button"]').click();
    console.log('[ASSERT] Expected URL to contain /inventory.html, got: %s', page.url());
    await expect(page).toHaveURL(/inventory\.html/);
  });

  // AC-10: Order Overview page displays payment info, shipping info, and accurate price summary
  test('TC-OVW-01: Overview page displays payment info, shipping info, and price summary', async ({ page }) => {
    console.log('[STEP] Starting TC-OVW-01: overview page details verification');
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
    console.log('[ASSERT] Verifying Cancel and Finish buttons are visible');
    await expect(page.locator('[data-test="cancel"]')).toBeVisible();
    await expect(page.locator('[data-test="finish"]')).toBeVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
