// Jira: SCRUM-21 — Assignment 5: Advanced DOM Traversal
// Concepts: parent(), find(), children(), contains()

import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();

describe('SCRUM-21 | Assignment 5: Advanced DOM Traversal', () => {
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');
  });

  it('should add "Sauce Labs Fleece Jacket" to cart via DOM traversal', () => {
    cy.log('STEP: traverse DOM to find Fleece Jacket add-to-cart button');
    // Locate product title → traverse to card container → find its button
    cy.contains('.inventory_item_name', 'Sauce Labs Fleece Jacket')
      .parents('.inventory_item')
      .find('button')
      .click();

    inventoryPage.getCartBadge().should('have.text', '1');
  });
});
