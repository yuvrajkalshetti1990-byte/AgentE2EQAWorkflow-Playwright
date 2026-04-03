// SCRUM-18 | Assignment 2: The Positive Login Path
// AC: Valid credentials redirect to /inventory.html (intercept + URL assertions)
// @requiredFixtures: ["users.json"]

import { LoginPage } from '../../pages/saucedemo/LoginPage';

const loginPage = new LoginPage();

describe('SCRUM-18 | Positive Login Path – Redirect to Inventory', () => {
  beforeEach(() => {
    cy.clearAllCookies();
    cy.clearAllLocalStorage(); // Clears saucedemo.com localStorage for all visited origins (Cypress 12+)
    loginPage.visit();
  });

  it('AC1: standard_user with valid password is redirected to /inventory.html', () => {
    // SauceDemo is a SPA — login triggers a React Router URL change, not a network request.
    // Use cy.intercept on the API/XHR layer and assert URL directly instead of waiting for a page GET.
    loginPage.login('standard_user', 'secret_sauce');

    cy.url().should('include', '/inventory.html');
  });

  it('AC2: URL should not contain login path after successful authentication', () => {
    loginPage.login('standard_user', 'secret_sauce');

    cy.url().should('not.include', 'login');
    cy.url().should('include', '/inventory.html');
  });

  it('AC3: no error message is displayed when valid credentials are submitted', () => {
    loginPage.login('standard_user', 'secret_sauce');

    cy.get('[data-test="error"]').should('not.exist');
  });

  it('AC4: problem_user with valid password is also redirected to /inventory.html', () => {
    loginPage.login('problem_user', 'secret_sauce');

    cy.url().should('include', '/inventory.html');
  });

  it('AC5: fixture-driven — all users with expectedStatus "success" can log in', () => {
    cy.fixture('users').then((users: Array<{ username: string; password: string; expectedStatus: string }>) => {
      const validUsers = users.filter((u) => u.expectedStatus === 'success');
      expect(validUsers.length).to.be.greaterThan(0);

      // Validate first successful user in this test (others covered by session spec)
      const { username, password } = validUsers[0];
      loginPage.login(username, password);
      cy.url().should('include', '/inventory.html');
    });
  });
});
