// Jira: SCRUM-27 — Assignment 11: Environment Variables Security
// Concepts: cypress.env.json, Cypress.env()
//
// Setup:
//   1. Create cypress.env.json at project root:  { "SAUCE_PASSWORD": "secret_sauce" }
//   2. Add cypress.env.json to .gitignore
//   3. cy.login() already reads SAUCE_PASSWORD internally via Cypress.env()

import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const inventoryPage = new InventoryPage();

describe('SCRUM-27 | Assignment 11: Environment Variables Security', () => {
  // AC-1: Password is not hardcoded in test code — cy.login() reads it from Cypress.env()
  it('should NOT expose the password in test code — cy.login() reads it from env', () => {
    cy.log('STEP: login via cy.login() which reads password from Cypress.env()');
    // The password is NOT hardcoded here; it is sourced from cypress.env.json
    cy.login('standard_user');
    inventoryPage.assertOnPage();
  });

  // AC-2: SAUCE_PASSWORD env var is available and non-empty via Cypress.env()
  it('should have SAUCE_PASSWORD available via Cypress.env()', () => {
    cy.log('ASSERT: SAUCE_PASSWORD env var is loaded and non-empty');
    // Verify the env var is loaded (useful as a sanity check in CI)
    expect(Cypress.env('SAUCE_PASSWORD')).to.be.a('string').and.not.be.empty;
  });
});
