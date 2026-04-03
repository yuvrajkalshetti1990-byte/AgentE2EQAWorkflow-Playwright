// SCRUM-25 | Assignment 9: Strongly Typed Fixtures
// Concepts: Test Data Management, TypeScript Interfaces

import { LoginPage } from '../../../pages/saucedemo/LoginPage';

interface UserData {
  username: string;
  password: string;
  expectedStatus: 'success' | 'failure';
}

const loginPage = new LoginPage();

describe('SCRUM-25 | Assignment 9: Strongly Typed Fixtures', () => {
  beforeEach(() => {
    loginPage.visit();
  });

  it('should run login tests for every user in users.json fixture', () => {
    cy.fixture<UserData[]>('users.json').then((users) => {
      users.forEach((user) => {
        loginPage.visit();
        loginPage.login(user.username, user.password);

        if (user.expectedStatus === 'success') {
          cy.url().should('include', 'inventory');
          // Return to login page for next iteration
          cy.visit('https://www.saucedemo.com/');
        } else {
          cy.url().should('not.include', 'inventory');
          cy.get('[data-test="error"]').should('be.visible');
        }
      });
    });
  });
});
