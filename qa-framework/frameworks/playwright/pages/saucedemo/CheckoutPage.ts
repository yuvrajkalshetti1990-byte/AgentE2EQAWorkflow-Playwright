import { Page, expect } from '@playwright/test';

/**
 * SauceDemo Checkout Page Object
 *
 * Covers: /checkout-step-one.html, /checkout-step-two.html, /checkout-complete.html
 */
export class CheckoutPage {
  readonly firstNameInput  = '[data-test="firstName"]';
  readonly lastNameInput   = '[data-test="lastName"]';
  readonly postalCodeInput = '[data-test="postalCode"]';
  readonly continueButton  = '[data-test="continue"]';
  readonly cancelButton    = '[data-test="cancel"]';
  readonly finishButton    = '[data-test="finish"]';
  readonly errorMessage    = '[data-test="error"]';

  constructor(private readonly page: Page) {}

  async fillInfo(firstName: string, lastName: string, postalCode: string): Promise<void> {
    console.log('[STEP] Filling checkout info: %s %s, zip=%s', firstName, lastName, postalCode);
    await this.page.locator(this.firstNameInput).fill(firstName);
    await this.page.locator(this.lastNameInput).fill(lastName);
    await this.page.locator(this.postalCodeInput).fill(postalCode);
  }

  async clickContinue(): Promise<void> {
    console.log('[STEP] Clicking Continue to proceed to overview');
    await this.page.locator(this.continueButton).click();
    console.log('[NAV] url=%s', this.page.url());
    await expect(this.page).toHaveURL(/checkout-step-two\.html/);
  }

  async clickFinish(): Promise<void> {
    console.log('[STEP] Clicking Finish to place order');
    await this.page.locator(this.finishButton).click();
    console.log('[NAV] url=%s', this.page.url());
    await expect(this.page).toHaveURL(/checkout-complete\.html/);
  }

  async assertOrderConfirmation(): Promise<void> {
    console.log('[ASSERT] Expected order confirmation page');
    await expect(this.page.locator('h2')).toHaveText('Thank you for your order!');
    await expect(this.page.locator('.complete-text')).toHaveText(
      'Your order has been dispatched, and will arrive just as fast as the pony can get there!'
    );
    await expect(this.page.locator('[data-test="back-to-products"]')).toBeVisible();
  }
}
