// ---------------------------------------------------------------------------
// cy.login(username)
// Logs in to SauceDemo using the supplied username.
// Password is read from cypress.env.json → SAUCE_PASSWORD.
// ---------------------------------------------------------------------------
Cypress.Commands.add('login', (username: string) => {
  const password = Cypress.env('SAUCE_PASSWORD') as string;
  cy.visit('https://www.saucedemo.com/');
  cy.get('[data-test="username"]').clear().type(username);
  cy.get('[data-test="password"]').clear().type(password);
  cy.get('[data-test="login-button"]').click();
  cy.url().should('include', '/inventory.html');
});

export {};

