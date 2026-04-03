// SCRUM-17 | Assignment 1: TypeScript Project Initialization
// Concepts: Setup, TS Configuration, cypress.config.ts
//
// This spec is a smoke test verifying the project is correctly initialised.
// All setup is done in the boilerplate itself; this test confirms it works.

describe('SCRUM-17 | Assignment 1: TypeScript Project Initialization', () => {
  it('should visit SauceDemo and confirm the page title loads', () => {
    cy.safeVisit('https://www.saucedemo.com/');
    cy.title().should('eq', 'Swag Labs');
  });

  it('should have the login form visible on the landing page', () => {
    cy.safeVisit('https://www.saucedemo.com/');
    cy.get('[data-test="username"]').should('be.visible');
    cy.get('[data-test="password"]').should('be.visible');
    cy.get('[data-test="login-button"]').should('be.visible');
  });
});
