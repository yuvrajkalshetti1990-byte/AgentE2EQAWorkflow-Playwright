export class LoginPage {
  private readonly usernameInput = '[data-test="username"]';
  private readonly passwordInput = '[data-test="password"]';
  private readonly loginButton  = '[data-test="login-button"]';
  private readonly errorMessage = '[data-test="error"]';

  visit(): void {
    cy.safeVisit('https://www.saucedemo.com/');
  }

  enterUsername(username: string): void {
    cy.get(this.usernameInput).clear().type(username);
  }

  enterPassword(password: string): void {
    cy.get(this.passwordInput).clear().type(password);
  }

  clickLogin(): void {
    cy.get(this.loginButton).click();
  }

  login(username: string, password: string): void {
    this.enterUsername(username);
    this.enterPassword(password);
    this.clickLogin();
  }

  getErrorMessage(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.errorMessage);
  }
}
