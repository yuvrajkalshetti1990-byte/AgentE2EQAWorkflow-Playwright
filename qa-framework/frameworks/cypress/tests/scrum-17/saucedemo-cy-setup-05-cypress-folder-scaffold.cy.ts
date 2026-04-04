// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-5: The default Cypress folder scaffold (cypress/e2e, cypress/fixtures, cypress/support) is present

describe('SCRUM-17 | AC5: Default Cypress folder scaffold', () => {
  // AC-5: cypress/e2e directory exists
  it('should have cypress/e2e directory in the scaffold', () => {
    cy.log('STEP: Checking cypress/e2e folder exists');
    cy.task('fileExists', 'cypress/e2e').should('eq', true);
  });

  // AC-5: cypress/fixtures directory exists
  it('should have cypress/fixtures directory in the scaffold', () => {
    cy.log('STEP: Checking cypress/fixtures folder exists');
    cy.task('fileExists', 'cypress/fixtures').should('eq', true);
  });

  // AC-5: cypress/support directory exists
  it('should have cypress/support directory in the scaffold', () => {
    cy.log('STEP: Checking cypress/support folder exists');
    cy.task('fileExists', 'cypress/support').should('eq', true);
  });
});
