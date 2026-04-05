// Jira: SCRUM-18 — Assignment 2: The Positive Login Path
// AC-1: A test file login.cy.ts exists with a describe and at least one it block.
// AC-2: The test navigates to the SauceDemo login page (handled via cy.login()).
// AC-3: cy.get('[data-test="username"]') and cy.get('[data-test="password"]') with .type() enter credentials (handled by cy.login()).
// AC-4: .click() is called on the login button (handled by cy.login()).
// AC-5: cy.url().should('include', 'inventory') assertion passes (handled by cy.login()).
// AC-6: Test passes in the Cypress Test Runner.

describe('SCRUM-18: Positive Login Path — SauceDemo', () => {
  beforeEach(() => {
    cy.log('STEP: Logging in as standard_user via cy.login()');
    cy.login();
    cy.url().then(url => cy.log('NAV: Landed at ' + url));
  });

  // AC-1: describe and it block exist — this file itself satisfies AC-1
  // AC-2 + AC-3 + AC-4 + AC-5: Covered by cy.login() in beforeEach
  it('should redirect to /inventory.html after successful login with standard credentials', () => {
    cy.log('STEP: Asserting URL contains /inventory.html');
    cy.url().then(url => cy.log('ASSERT: Expected /inventory.html in: ' + url));
    cy.url().should('include', '/inventory.html');
  });

  // AC-6: Test passes — verified by the following additional inventory page assertions
  it('should display the Products page title after login', () => {
    cy.log('STEP: Asserting page title "Products" is visible');
    cy.get('.title').then($el => cy.log('ASSERT: Page title text = ' + $el.text()));
    cy.get('.title').should('be.visible').and('have.text', 'Products');
  });

  // AC-3: At least one inventory item is displayed on the inventory page
  it('should display at least one inventory item on the inventory page', () => {
    cy.log('STEP: Asserting at least one inventory item is present');
    cy.get('.inventory_item').then($items => cy.log('ASSERT: Inventory item count = ' + $items.length));
    cy.get('.inventory_item').should('have.length.greaterThan', 0);
  });
});
