// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-4: Cancel from the Checkout Overview page returns user to inventory with cart preserved

import { test, expect } from '@playwright/test';

test.describe('Happy Path – Full Checkout Flow', () => {
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

  // AC-4: Cancel from the Checkout Overview page returns user to inventory with cart preserved
  test('TC-HP-03: Checkout cancellation from the Overview page', async ({ page }) => {
    console.log('[STEP] Starting TC-HP-03: cancel from checkout overview');
    await page.locator('[data-test="add-to-cart-sauce-labs-onesie"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

    // 2. Navigate to cart page
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');

    // 3. Click Checkout button
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 4. Fill in checkout information
    await page.locator('[data-test="firstName"]').fill('Alice');
    await page.locator('[data-test="lastName"]').fill('Walker');
    await page.locator('[data-test="postalCode"]').fill('10001');

    // 5. Click Continue to proceed to overview
    await page.locator('[data-test="continue"]').click();
    await expect(page).toHaveURL(/checkout-step-two\.html/);

    // 6. Verify overview page shows item with price summary
    await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');
    await expect(page.locator('.summary_subtotal_label')).toContainText('Item total: $7.99');

    // 7. Click Cancel on Overview page
    await page.locator('[data-test="cancel"]').click();

    // 8. Verify user is returned to inventory page
    await expect(page).toHaveURL(/inventory\.html/);

    // 9. Verify cart badge still shows 1 (order was not placed)
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

    // 10. Verify the Onesie is still in the cart by checking its Remove button is shown
    console.log('[ASSERT] Verifying cart still contains item after cancel (cart not cleared)');
    await expect(page.locator('[data-test="remove-sauce-labs-onesie"]')).toBeVisible();
    console.log('[NAV] Final url: %s', page.url());
  });
});
