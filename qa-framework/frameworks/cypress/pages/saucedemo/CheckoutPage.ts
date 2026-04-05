export class CheckoutPage {
  // Step One selectors
  private readonly firstNameInput  = '[data-test="firstName"]';
  private readonly lastNameInput   = '[data-test="lastName"]';
  private readonly postalCodeInput = '[data-test="postalCode"]';
  private readonly continueButton  = '[data-test="continue"]';

  // Step Two selectors
  private readonly finishButton    = '[data-test="finish"]';
  private readonly subtotalLabel   = '.summary_subtotal_label';
  private readonly taxLabel        = '.summary_tax_label';

  // Confirmation selectors
  private readonly confirmationHeader = 'h2.complete-header';

  assertOnStepOne(): void {
    cy.url().should('include', '/checkout-step-one.html');
  }

  fillForm(firstName: string, lastName: string, postalCode: string): void {
    cy.get(this.firstNameInput).clear().type(firstName);
    cy.get(this.lastNameInput).clear().type(lastName);
    cy.get(this.postalCodeInput).clear().type(postalCode);
  }

  getFirstNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.firstNameInput);
  }

  clickContinue(): void {
    cy.get(this.continueButton).click();
  }

  assertOnStepTwo(): void {
    cy.url().should('include', '/checkout-step-two.html');
  }

  getSubtotal(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.subtotalLabel);
  }

  clickFinish(): void {
    cy.get(this.finishButton).click();
  }

  getConfirmationMessage(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.confirmationHeader);
  }
}
