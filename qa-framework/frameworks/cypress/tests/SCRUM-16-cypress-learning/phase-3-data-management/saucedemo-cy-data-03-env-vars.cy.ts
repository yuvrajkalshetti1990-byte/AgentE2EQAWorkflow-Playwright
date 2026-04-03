// SCRUM-27 | Assignment 11: Environment Variables Security
// Concepts: cypress.env.json, Cypress.env()
//
// Setup:
//   1. Create cypress.env.json at project root:  { "SAUCE_PASSWORD": "secret_sauce" }
//   2. Add cypress.env.json to .gitignore
//   3. cy.login() already reads SAUCE_PASSWORD internally via Cypress.env()

import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const inventoryPage = new InventoryPage();

describe('SCRUM-27 | Assignment 11: Environment Variables Security', () => {
  it('should NOT expose the password in test code — cy.login() reads it from env', () => {
    // The password is NOT hardcoded here; it is sourced from cypress.env.json
    cy.login('standard_user');
    inventoryPage.assertOnPage();
  });

  it('should have SAUCE_PASSWORD available via Cypress.env()', () => {
    // Verify the env var is loaded (useful as a sanity check in CI)
    expect(Cypress.env('SAUCE_PASSWORD')).to.be.a('string').and.not.be.empty;
  });
});
