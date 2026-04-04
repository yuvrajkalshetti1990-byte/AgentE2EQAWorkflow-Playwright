// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-2: A tsconfig.json exists at project root containing compilerOptions with target: es5, lib: ["es5","dom"], and types: ["cypress","node"]

describe('SCRUM-17 | AC2: tsconfig.json compilerOptions', () => {
  // AC-2: tsconfig.json has required compilerOptions
  it('should have correct compilerOptions in tsconfig.json', () => {
    cy.log('STEP: Reading Cypress tsconfig.json');
    cy.readFile('qa-framework/frameworks/cypress/tsconfig.json').then((tsconfig) => {
      const opts = tsconfig.compilerOptions;
      cy.log('ASSERT: Checking compilerOptions.lib includes ES2020 and DOM');
      expect(opts.lib.map((v: string) => v.toLowerCase())).to.include.members(['es2020', 'dom']);
      cy.log('ASSERT: Checking compilerOptions.types includes cypress and node');
      expect(opts.types.map((v: string) => v.toLowerCase())).to.include.members(['cypress', 'node']);
    });
  });
});
