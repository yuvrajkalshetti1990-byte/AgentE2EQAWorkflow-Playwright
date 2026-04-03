export class InventoryPage {
  private readonly sortDropdown   = '[data-test="product_sort_container"]';
  private readonly productNames   = '.inventory_item_name';
  private readonly cartBadge      = '.shopping_cart_badge';
  private readonly cartLink       = '.shopping_cart_link';

  assertOnPage(): void {
    cy.url().should('include', '/inventory.html');
  }

  sortBy(option: string): void {
    cy.get(this.sortDropdown).select(option);
  }

  getFirstProductName(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.productNames).first();
  }

  addToCartByName(productName: string): void {
    cy.contains(this.productNames, productName)
      .parents('.inventory_item')
      .find('button')
      .click();
  }

  getAddToCartButtons(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('[data-test^="add-to-cart"]');
  }

  getCartBadge(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.cartBadge);
  }

  goToCart(): void {
    cy.get(this.cartLink).click();
  }
}
