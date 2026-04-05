// Jira: SCRUM-14 — SauceDemo Checkout E2E Tests
// AC-5: Submitting the checkout form with all fields empty shows a validation error

import { test, expect } from '@playwright/test';
import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

test.describe('Negative / Validation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWithDefaults();
  });

  // AC-5: Submitting the checkout form with all fields empty shows a validation error
  test('TC-NEG-01: Submit checkout form with all fields empty', async ({ page }) => {
    console.log('[STEP] Starting TC-NEG-01: all-fields-empty validation');
    // 1. Add any item to cart and navigate to checkout info page
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await new InventoryPage(page).goToCart();
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one\.html/);

    // 2. Leave all fields empty and click Continue
    await page.locator('[data-test="continue"]').click();

    // 3. Assert error message is displayed and user stays on same page
    console.log('[ASSERT] Expected error for First Name is required, url: %s', page.url());
    await expect(page.locator('[data-test="error"]')).toContainText('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one\.html/);
  });
});
