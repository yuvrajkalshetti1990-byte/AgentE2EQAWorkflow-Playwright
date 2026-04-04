// Jira: SCRUM-17 — Assignment 1: TypeScript Project Initialization
// AC-1: Running npm install installs cypress and typescript as devDependencies and both are present in package.json

describe('SCRUM-17 | AC1: package.json devDependencies', () => {
  // AC-1: package.json contains cypress and typescript as devDependencies
  it('should have cypress and typescript listed as devDependencies in package.json', () => {
    cy.log('STEP: Reading package.json from project root');
    cy.readFile('package.json').then((pkg) => {
      cy.log('ASSERT: Checking cypress devDependency exists');
      expect(pkg.devDependencies).to.have.property('cypress');
      cy.log('ASSERT: Checking typescript devDependency exists');
      expect(pkg.devDependencies).to.have.property('typescript');
    });
  });
});
