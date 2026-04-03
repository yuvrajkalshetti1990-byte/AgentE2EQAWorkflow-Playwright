export class IframePage {
  private readonly iframeSelector = '#mce_0_ifr';

  visit(): void {
    cy.safeVisit('https://the-internet.herokuapp.com/iframe');
  }

  /**
   * Returns the iframe body wrapped in Cypress context.
   * Usage: this.getIframeBody().clear().type('Hello')
   */
  getIframeBody(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .get(this.iframeSelector)
      .its('0.contentDocument.body')
      .should('not.be.empty')
      .then(cy.wrap);
  }
}
