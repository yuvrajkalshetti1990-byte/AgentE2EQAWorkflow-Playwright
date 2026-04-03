// SCRUM-18 | Assignment 2: The Positive Login Path
// AC: Login state is preserved and reused via cy.session()

import { InventoryPage } from '../../pages/saucedemo/InventoryPage';

const inventoryPage = new InventoryPage();

const SESSION_USER = 'standard_user';
const SESSION_PASS = 'secret_sauce';

/**
 * Establishes (or restores) a cached SauceDemo login session.
 * cy.session() replays the login block only if the session cache is stale or absent.
 */
function setupLoginSession(username: string, password: string): void {
  cy.session(
    [username, password],
    () => {
      cy.visit('/');
      cy.get('[data-test="username"]').type(username);
      cy.get('[data-test="password"]').type(password);
      cy.get('[data-test="login-button"]').click();
      cy.url().should('include', '/inventory.html');
    },
    {
      validate() {
        // Confirm the session is still valid on restore — localStorage key set by SauceDemo
        cy.window().its('localStorage').invoke('getItem', 'session-username').should('not.be.null');
      },
    }
  );
}

describe('SCRUM-18 | Positive Login Path – Session Caching', () => {
  beforeEach(() => {
    setupLoginSession(SESSION_USER, SESSION_PASS);
    cy.visit('/inventory.html');
  });

  it('AC14: a cached session lands directly on the inventory page without re-entering credentials', () => {
    inventoryPage.assertOnPage();
  });

  it('AC15: the "Products" title is present when the session is restored from cache', () => {
    cy.get('[data-test="title"]').should('be.visible').and('contain.text', 'Products');
  });

  it('AC16: the session remains valid after navigating away and returning to inventory', () => {
    cy.visit('/cart.html');
    cy.url().should('include', '/cart.html');

    cy.visit('/inventory.html');
    inventoryPage.assertOnPage();
  });

  it('AC17: session-authenticated user can add an item to the cart and cart badge updates', () => {
    inventoryPage.getAddToCartButtons().first().click();
    inventoryPage.getCartBadge().should('be.visible').and('contain.text', '1');
  });

  it('AC18: problem_user session is also cached and resolves to /inventory.html', () => {
    setupLoginSession('problem_user', SESSION_PASS);
    cy.visit('/inventory.html');
    inventoryPage.assertOnPage();
  });
});
