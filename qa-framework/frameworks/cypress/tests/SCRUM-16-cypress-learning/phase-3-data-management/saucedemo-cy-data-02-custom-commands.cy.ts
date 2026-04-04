// Jira: SCRUM-26 — Assignment 10: Custom Commands with TS Declarations
// Concepts: Cypress.Commands.add, Global Types
//
// Prerequisites:
//   - cy.login() is defined in cypress/support/commands.ts
//   - TypeScript declaration is in cypress/support/index.d.ts
//   - SAUCE_PASSWORD env var set in cypress.env.json

import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const inventoryPage = new InventoryPage();

describe('SCRUM-26 | Assignment 10: Custom Commands with TS Declarations', () => {
  beforeEach(() => {
    // Using the custom cy.login() command instead of manual steps
    cy.login('standard_user');
  });

  // AC-1: Inventory page is active after cy.login() custom command
  it('should be on the inventory page after cy.login()', () => {
    cy.log('ASSERT: inventory page active after cy.login() custom command');
    inventoryPage.assertOnPage();
  });

  // AC-2: App logo header shows "Swag Labs" after cy.login()
  it('should display the page header after cy.login()', () => {
    cy.log('ASSERT: app logo text reads Swag Labs');
    cy.get('.app_logo').should('have.text', 'Swag Labs');
  });
});
