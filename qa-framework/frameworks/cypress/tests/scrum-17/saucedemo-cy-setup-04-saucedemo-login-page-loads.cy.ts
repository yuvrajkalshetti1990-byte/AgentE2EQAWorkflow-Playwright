// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-3: A cypress.config.ts file exists (not .js) and sets baseUrl to https://www.saucedemo.com/ (smoke browser test)

describe('SCRUM-17 | AC3 (smoke): SauceDemo login page loads via baseUrl', () => {
  // AC-3: https://www.saucedemo.com/ loads the login page correctly when baseUrl is correctly configured
  it('should load the SauceDemo login page at the root URL', () => {
    cy.log('NAV: Navigating to SauceDemo root via baseUrl');
    cy.safeVisit('/');
    cy.log('ASSERT: Checking page title is Swag Labs');
    cy.title().should('eq', 'Swag Labs');
    cy.log('ASSERT: Checking login form elements are visible');
    cy.get('[data-test="username"]').should('be.visible');
    cy.get('[data-test="password"]').should('be.visible');
    cy.get('[data-test="login-button"]').should('be.visible').and('not.be.disabled');
  });
});
