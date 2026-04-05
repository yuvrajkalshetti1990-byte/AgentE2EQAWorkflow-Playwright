import { Page, expect } from '@playwright/test';

/**
 * SauceDemo Inventory Page Object
 *
 * Covers: /inventory.html
 */
export class InventoryPage {
  readonly pageTitle  = '.title';
  readonly cartBadge  = '.shopping_cart_badge';

  constructor(private readonly page: Page) {}

  async assertPageLoaded(): Promise<void> {
    console.log('[ASSERT] Expected Inventory page title "Products"');
    await expect(this.page.locator(this.pageTitle)).toHaveText('Products');
  }

  /**
   * Click an "Add to cart" button by its data-test attribute value.
   * @param itemDataTest  e.g. 'add-to-cart-sauce-labs-backpack'
   */
  async addToCart(itemDataTest: string): Promise<void> {
    console.log('[STEP] Adding item to cart: %s', itemDataTest);
    await this.page.locator(`[data-test="${itemDataTest}"]`).click();
  }

  async assertCartBadge(count: string): Promise<void> {
    console.log('[ASSERT] Expected cart badge to show "%s"', count);
    await expect(this.page.locator(this.cartBadge)).toHaveText(count);
  }

  /** Navigate to the cart page via direct URL (relative, uses baseURL). */
  async goToCart(): Promise<void> {
    console.log('[NAV] Navigating to cart page');
    await this.page.goto('/cart.html');
    console.log('[NAV] url=%s', this.page.url());
  }
}
