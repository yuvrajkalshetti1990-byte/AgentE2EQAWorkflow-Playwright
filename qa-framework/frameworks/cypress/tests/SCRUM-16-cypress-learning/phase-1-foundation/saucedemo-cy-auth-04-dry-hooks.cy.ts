// Jira: SCRUM-20 — Assignment 4: Keeping it DRY with Hooks
// Concepts: Test lifecycle hooks, Asynchronous nature

import { LoginPage } from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();

describe('SCRUM-20 | Assignment 4: Keeping it DRY with Hooks', () => {
  // The login runs automatically before every it block — no duplication
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');
  });

  // AC-1: Inventory page is active after beforeEach login
  it('should start on the inventory page after the beforeEach login', () => {
    cy.log('ASSERT: inventory page is active after beforeEach login');
    inventoryPage.assertOnPage();
  });

  // AC-2: Product list displays at least one inventory item
  it('should display products on the inventory page', () => {
    cy.log('ASSERT: product list has at least one inventory item');
    cy.get('.inventory_item').should('have.length.greaterThan', 0);
  });
});
