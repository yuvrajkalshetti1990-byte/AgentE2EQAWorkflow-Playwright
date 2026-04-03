// SCRUM-19 | Assignment 3: The Negative Login Path
// Concepts: Negative Testing, Explicit Assertions

import { LoginPage } from '../../../pages/saucedemo/LoginPage';

const loginPage = new LoginPage();

describe('SCRUM-19 | Assignment 3: The Negative Login Path', () => {
  beforeEach(() => {
    loginPage.visit();
  });

  it('should show an error and stay on login page for locked_out_user', () => {
    loginPage.login('locked_out_user', 'secret_sauce');

    // URL must NOT change to inventory
    cy.url().should('not.include', 'inventory');

    // Explicit BDD assertion inside .then()
    loginPage.getErrorMessage().then(($el) => {
      expect($el.text()).to.equal(
        'Epic sadface: Sorry, this user has been locked out.'
      );
    });
  });
});
