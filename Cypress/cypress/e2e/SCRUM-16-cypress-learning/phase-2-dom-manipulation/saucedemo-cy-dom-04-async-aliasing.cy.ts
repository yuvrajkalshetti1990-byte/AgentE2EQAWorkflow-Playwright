// SCRUM-24 | Assignment 8: Asynchronous Aliasing
// Concepts: Variables & Aliasing (cy.as), Yielding

import { LoginPage }     from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();

describe('SCRUM-24 | Assignment 8: Asynchronous Aliasing', () => {
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');
  });

  it('should use an alias to verify button text changes to "Remove" after adding', () => {
    // Store add-to-cart buttons as an alias for later reuse
    inventoryPage.getAddToCartButtons().as('cartButtons');

    // Add the first item
    cy.get('@cartButtons').first().click();

    // Re-access via alias — verify the button now reads "Remove"
    cy.get('@cartButtons').first().should('contain.text', 'Remove');
  });
});
