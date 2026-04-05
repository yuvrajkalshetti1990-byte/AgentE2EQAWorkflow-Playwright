import { Page, expect } from '@playwright/test';

/**
 * SauceDemo Checkout Page Object
 *
 * Covers: /checkout-step-one.html, /checkout-step-two.html, /checkout-complete.html
 */
export class CheckoutPage {
  readonly firstNameInput    = '[data-test="firstName"]';
  readonly lastNameInput     = '[data-test="lastName"]';
  readonly postalCodeInput   = '[data-test="postalCode"]';
  readonly continueButton    = '[data-test="continue"]';
  readonly cancelButton      = '[data-test="cancel"]';
  readonly finishButton      = '[data-test="finish"]';
  readonly errorMessage      = '[data-test="error"]';
  readonly overviewItemName  = '.inventory_item_name';
  readonly overviewItemPrice = '.inventory_item_price';
  readonly summaryInfo       = '.summary_info';
  readonly subtotalLabel     = '.summary_subtotal_label';
  readonly taxLabel          = '.summary_tax_label';
  readonly totalLabel        = '.summary_total_label';

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

  async assertOverviewItem(index: number, name: string, price: string): Promise<void> {
    console.log('[ASSERT] Overview item[%d]: name="%s" price="%s"', index, name, price);
    await expect(this.page.locator(this.overviewItemName).nth(index)).toHaveText(name);
    await expect(this.page.locator(this.overviewItemPrice).nth(index)).toHaveText(price);
  }

  async assertOverviewSummary(subtotal: string, tax: string, total: string): Promise<void> {
    console.log('[ASSERT] Overview summary: subtotal=%s tax=%s total=%s', subtotal, tax, total);
    await expect(this.page.locator(this.subtotalLabel)).toContainText(subtotal);
    await expect(this.page.locator(this.taxLabel)).toContainText(tax);
    await expect(this.page.locator(this.totalLabel)).toContainText(total);
  }

  async assertOverviewPaymentShipping(payment: string, shipping: string): Promise<void> {
    console.log('[ASSERT] Overview payment="%s" shipping="%s"', payment, shipping);
    await expect(this.page.locator(this.summaryInfo)).toContainText(payment);
    await expect(this.page.locator(this.summaryInfo)).toContainText(shipping);
  }

  async assertCancelFinishVisible(): Promise<void> {
    console.log('[ASSERT] Verifying Cancel and Finish buttons are visible');
    await expect(this.page.locator(this.cancelButton)).toBeVisible();
    await expect(this.page.locator(this.finishButton)).toBeVisible();
  }

  async clickCancel(): Promise<void> {
    console.log('[STEP] Clicking Cancel on overview page');
    await this.page.locator(this.cancelButton).click();
    console.log('[NAV] url=%s', this.page.url());
    await expect(this.page).toHaveURL(/inventory\.html/);
  }

  async clickBackToProducts(): Promise<void> {
    console.log('[STEP] Clicking Back to Products');
    await this.page.locator('[data-test="back-to-products"]').click();
    console.log('[NAV] url=%s', this.page.url());
    await expect(this.page).toHaveURL(/inventory\.html/);
  }

  async submitEmpty(): Promise<void> {
    console.log('[STEP] Clicking Continue with empty form');
    await this.page.locator(this.continueButton).click();
  }

  async assertError(text: string): Promise<void> {
    console.log('[ASSERT] Expected error: %s', text);
    await expect(this.page.locator(this.errorMessage)).toContainText(text);
  }

  async dismissError(): Promise<void> {
    console.log('[STEP] Dismissing error message by clicking X');
    await this.page.locator(`${this.errorMessage} button`).click();
  }

  async assertErrorNotVisible(): Promise<void> {
    console.log('[ASSERT] Expected error message to be hidden');
    await expect(this.page.locator(this.errorMessage)).not.toBeVisible();
  }

  async assertFormEditable(): Promise<void> {
    console.log('[ASSERT] Verifying form fields are editable');
    await expect(this.page.locator(this.firstNameInput)).toBeEditable();
    await expect(this.page.locator(this.lastNameInput)).toBeEditable();
    await expect(this.page.locator(this.postalCodeInput)).toBeEditable();
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
