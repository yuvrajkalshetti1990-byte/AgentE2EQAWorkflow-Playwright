// SCRUM-36 | Assignment 20: CI/CD & HTML Reporting
// Concepts: Headless execution, NPM Scripts, Mochawesome Reporter
//
// This spec is a smoke test confirming the suite runs headlessly.
// The real deliverable is the package.json "test" script and reporter config.
//
// Setup checklist (outside this file):
//   1. In package.json:        "test": "cypress run --config-file Cypress/cypress.config.ts"
//   2. npm install cypress-mochawesome-reporter --save-dev
//   3. In cypress.config.ts:   reporter + reporterOptions for mochawesome
//   4. Run: npm run test  →  open cypress/reports/index.html

describe('SCRUM-36 | Assignment 20: CI/CD & HTML Reporting', () => {
  it('should run headlessly and confirm the SauceDemo login page loads', () => {
    cy.visit('https://www.saucedemo.com/');
    cy.title().should('eq', 'Swag Labs');
    cy.get('[data-test="login-button"]').should('be.visible');
  });

  it('should complete a quick login to confirm the full stack works in CI mode', () => {
    cy.login('standard_user');
    cy.url().should('include', '/inventory.html');
    cy.get('.app_logo').should('have.text', 'Swag Labs');
  });
});
