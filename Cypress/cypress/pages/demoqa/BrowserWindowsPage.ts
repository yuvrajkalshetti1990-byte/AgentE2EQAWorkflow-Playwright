export class BrowserWindowsPage {
  private readonly newTabButton    = '#tabButton';
  private readonly newWindowButton = '#windowButton';

  visit(): void {
    cy.visit('https://demoqa.com/browser-windows');
  }

  clickNewTab(): void {
    cy.get(this.newTabButton).click();
  }

  clickNewWindow(): void {
    cy.get(this.newWindowButton).click();
  }

  /**
   * Stubs window.open before clicking so Cypress can assert it was called.
   * Returns the alias name for use in assertions.
   */
  stubWindowOpen(alias = 'windowOpen'): void {
    cy.window().then((win) => {
      cy.stub(win, 'open').as(alias);
    });
  }
}
