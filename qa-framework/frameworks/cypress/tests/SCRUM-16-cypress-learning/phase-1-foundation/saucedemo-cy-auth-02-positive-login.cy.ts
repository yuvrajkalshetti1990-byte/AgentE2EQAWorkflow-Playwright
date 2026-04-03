// Jira: SCRUM-18 — Assignment 2: The Positive Login Path
// Concepts: Basic .cy.ts structure, DOM Querying, Interactions

import { LoginPage } from '../../../pages/saucedemo/LoginPage';

const loginPage = new LoginPage();

describe('SCRUM-18 | Assignment 2: The Positive Login Path', () => {
  beforeEach(() => {
    loginPage.visit();
  });

  it('should login with standard_user and land on the inventory page', () => {
    cy.log('STEP: login with standard_user and assert redirect to inventory');
    loginPage.login('standard_user', 'secret_sauce');

    cy.url().should('include', 'inventory');
  });
});
