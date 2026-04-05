import { Page, expect } from '@playwright/test';

/**
 * SauceDemo Cart Page Object
 *
 * Covers: /cart.html
 */
export class CartPage {
  readonly pageTitle              = '.title';
  readonly checkoutButton         = '[data-test="checkout"]';
  readonly continueShoppingButton = '[data-test="continue-shopping"]';
  readonly cartItems              = '.cart_item';
  readonly itemNames              = '.inventory_item_name';
  readonly itemPrices             = '.inventory_item_price';
  readonly itemDescriptions       = '.inventory_item_desc';
  readonly cartQuantities         = '.cart_quantity';

  constructor(private readonly page: Page) {}

  async assertPageLoaded(): Promise<void> {
    console.log('[ASSERT] Expected Cart page title "Your Cart"');
    await expect(this.page.locator(this.pageTitle)).toHaveText('Your Cart');
  }

  async assertItemCount(count: number): Promise<void> {
    console.log('[ASSERT] Expected %d item(s) in cart', count);
    await expect(this.page.locator(this.cartItems)).toHaveCount(count);
  }

  /**
   * Assert name and price of a cart item by 0-based index.
   */
  async assertItem(index: number, name: string, price: string): Promise<void> {
    console.log('[ASSERT] Cart item[%d]: name="%s" price="%s"', index, name, price);
    await expect(this.page.locator(this.itemNames).nth(index)).toHaveText(name);
    await expect(this.page.locator(this.itemPrices).nth(index)).toHaveText(price);
  }

  async clickCheckout(): Promise<void> {
    console.log('[STEP] Clicking Checkout button');
    await this.page.locator(this.checkoutButton).click();
    console.log('[NAV] url=%s', this.page.url());
    await expect(this.page).toHaveURL(/checkout-step-one\.html/);
  }
}
