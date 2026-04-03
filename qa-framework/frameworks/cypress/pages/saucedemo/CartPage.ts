export class CartPage {
  private readonly checkoutButton = '[data-test="checkout"]';
  private readonly cartItems      = '.cart_item';
  private readonly removeButton   = '[data-test^="remove"]';

  assertOnPage(): void {
    cy.url().should('include', '/cart.html');
  }

  getCartItems(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.cartItems);
  }

  clickCheckout(): void {
    cy.get(this.checkoutButton).click();
  }

  removeItem(productName: string): void {
    cy.contains('.cart_item_label', productName)
      .parents('.cart_item')
      .find(this.removeButton)
      .click();
  }
}
