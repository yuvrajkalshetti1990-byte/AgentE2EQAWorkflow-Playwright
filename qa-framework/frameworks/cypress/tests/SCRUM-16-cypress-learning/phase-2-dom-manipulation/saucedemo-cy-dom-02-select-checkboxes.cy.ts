// SCRUM-22 | Assignment 6: UI Interactions (Select & Checkboxes)
// Concepts: .select(), .check(), .uncheck()

import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();

describe('SCRUM-22 | Assignment 6: UI Interactions (Select & Checkboxes)', () => {
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');
  });

  it('should sort products Z to A and verify the first item', () => {
    inventoryPage.sortBy('Name (Z to A)');

    inventoryPage
      .getFirstProductName()
      .should('have.text', 'Test.allTheThings() T-Shirt (Red)');
  });

  it('should sort products A to Z and verify the first item', () => {
    inventoryPage.sortBy('Name (A to Z)');

    inventoryPage
      .getFirstProductName()
      .should('have.text', 'Sauce Labs Backpack');
  });
});
