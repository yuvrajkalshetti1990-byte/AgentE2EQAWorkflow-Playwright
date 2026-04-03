// SCRUM-18 | Assignment 2: The Positive Login Path
// AC: Inventory page elements are visible and accessible after successful login

import { LoginPage } from '../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../pages/saucedemo/InventoryPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();

describe('SCRUM-18 | Positive Login Path – Inventory Page Elements', () => {
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');
  });

  it('AC6: the "Products" page title is visible after a successful login', () => {
    cy.get('[data-test="title"]').should('be.visible').and('contain.text', 'Products');
  });

  it('AC7: the Swag Labs app logo is rendered in the header', () => {
    cy.get('.app_logo').should('be.visible').and('contain.text', 'Swag Labs');
  });

  it('AC8: the inventory page contains at least one product item', () => {
    cy.get('.inventory_item').should('have.length.greaterThan', 0);
  });

  it('AC9: all six SauceDemo products are displayed on the inventory page', () => {
    cy.get('.inventory_item').should('have.length', 6);
  });

  it('AC10: the shopping cart link is accessible on the inventory page', () => {
    cy.get('.shopping_cart_link').should('be.visible').and('be.enabled');
  });

  it('AC11: the shopping cart badge is absent on a fresh login (empty cart)', () => {
    inventoryPage.getCartBadge().should('not.exist');
  });

  it('AC12: the product sort dropdown is visible and defaults to "Name (A to Z)"', () => {
    cy.get('[data-test="product_sort_container"]')
      .should('be.visible')
      .and('have.value', 'az');
  });

  it('AC13: the hamburger menu button is visible and interactive', () => {
    cy.get('#react-burger-menu-btn').should('be.visible').click();
    cy.get('.bm-menu').should('be.visible');
    // Close the menu
    cy.get('#react-burger-cross-btn').click();
  });
});
