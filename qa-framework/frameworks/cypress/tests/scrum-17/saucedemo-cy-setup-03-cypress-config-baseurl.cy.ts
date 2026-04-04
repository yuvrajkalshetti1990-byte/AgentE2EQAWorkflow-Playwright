// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-3: A cypress.config.ts file exists (not .js) and sets baseUrl to https://www.saucedemo.com/

describe('SCRUM-17 | AC3 (file): cypress.config.ts baseUrl', () => {
  // AC-3: cypress.config.ts exists as .ts (not .js) and contains baseUrl pointing to saucedemo
  it('should have cypress.config.ts with baseUrl set to saucedemo.com', () => {
    cy.log('STEP: Reading cypress.config.ts as raw text');
    cy.readFile('qa-framework/frameworks/cypress/cypress.config.ts', 'utf8').then((content: string) => {
      cy.log('ASSERT: Checking baseUrl key is present in config');
      expect(content).to.include('baseUrl');
      cy.log('ASSERT: Checking baseUrl value points to saucedemo.com');
      expect(content).to.include('https://www.saucedemo.com');
    });
  });
});
