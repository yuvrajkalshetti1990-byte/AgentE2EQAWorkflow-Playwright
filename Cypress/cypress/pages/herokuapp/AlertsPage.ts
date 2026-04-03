export class AlertsPage {
  private readonly jsAlertButton   = 'button[onclick="jsAlert()"]';
  private readonly jsConfirmButton = 'button[onclick="jsConfirm()"]';
  private readonly resultText      = '#result';

  visit(): void {
    cy.visit('https://the-internet.herokuapp.com/javascript_alerts');
  }

  clickJsAlert(): void {
    cy.get(this.jsAlertButton).click();
  }

  clickJsConfirm(): void {
    cy.get(this.jsConfirmButton).click();
  }

  getResultText(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.resultText);
  }
}
