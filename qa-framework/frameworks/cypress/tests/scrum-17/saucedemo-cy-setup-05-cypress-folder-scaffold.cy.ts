// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-5: The default Cypress folder scaffold (cypress/e2e, cypress/fixtures, cypress/support) is present

describe('SCRUM-17 | AC5: Default Cypress folder scaffold', () => {
  // AC-5: cypress/e2e directory exists
  it('should have tests directory in the scaffold', () => {
    cy.log('STEP: Checking tests folder exists (e2e specs)');
    cy.task('fileExists', 'tests').should('eq', true);
  });

  // AC-5: fixtures directory exists
  it('should have fixtures directory in the scaffold', () => {
    cy.log('STEP: Checking fixtures folder exists');
    cy.task('fileExists', 'fixtures').should('eq', true);
  });

  // AC-5: support directory exists
  it('should have support directory in the scaffold', () => {
    cy.log('STEP: Checking support folder exists');
    cy.task('fileExists', 'support').should('eq', true);
  });
});
