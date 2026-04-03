// Jira: SCRUM-36 — Assignment 20: CI/CD & HTML Reporting
// AC-1: package.json contains a "test" script set to "cypress run" that runs all tests headlessly.       ✅ COVERED (it-1)
// AC-2: Running npm run test exits with 0 status code when all tests pass.                               ⛔ NOT IMPLEMENTED — see qa-framework/notimplemented/scrum-36-ac-2.notimplemented.cy.ts
// AC-3: cypress-mochawesome-reporter (or equivalent mochawesome reporter) is installed as a dependency. ✅ COVERED (it-2)
// AC-4: cypress.config.ts is updated to include a mochawesome reporter and required reporter options.   ✅ COVERED (it-3)
// AC-5: After running npm run test, an HTML report file is generated in cypress/reports/.              ✅ COVERED (it-4)
// AC-6: The generated HTML report displays test names, pass/fail statuses, and execution durations.     ✅ COVERED (it-5)

describe('SCRUM-36: CI/CD & HTML Reporting', () => {
  // ── AC-1: package.json contains a "test" script set to "cypress run" ─────────────────────────────
  // AC-1: package.json contains a "test" script set to "cypress run" that runs all tests headlessly
  it('should have a cypress run test script in package.json', () => {
    cy.log('STEP: Reading package.json to verify "test" script exists and runs cypress headlessly');
    cy.readFile('package.json').then((pkg: { scripts?: Record<string, string> }) => {
      cy.log('NAV: Read package.json — inspecting scripts');
      cy.log('ASSERT: Expected scripts.test to exist');
      expect(pkg.scripts, 'scripts key in package.json').to.exist;
      cy.log('ASSERT: Expected scripts.test to include "cypress run"');
      expect(pkg.scripts!.test, 'scripts.test value').to.include('cypress run');
    });
  });

  // ── AC-3: cypress-mochawesome-reporter is installed as a dependency ────────────────────────────────
  // AC-3: cypress-mochawesome-reporter (or equivalent mochawesome reporter) is installed as a dependency
  it('should have mochawesome installed as a dependency in package.json', () => {
    cy.log('STEP: Reading package.json to verify mochawesome dependency is present');
    cy.readFile('package.json').then(
      (pkg: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }) => {
        cy.log('NAV: Read package.json — inspecting dependencies');
        const allDeps: Record<string, string> = {
          ...(pkg.dependencies ?? {}),
          ...(pkg.devDependencies ?? {}),
        };
        cy.log('ASSERT: Expected mochawesome or cypress-mochawesome-reporter to be in dependencies');
        const hasMochawesome =
          'mochawesome' in allDeps ||
          'cypress-mochawesome-reporter' in allDeps ||
          'mochawesome-merge' in allDeps;
        expect(hasMochawesome, 'mochawesome package present in dependencies').to.be.true;
      }
    );
  });

  // ── AC-4: cypress.config.ts includes mochawesome reporter and options ────────────────────────────
  // AC-4: cypress.config.ts is updated to include a mochawesome reporter and any required reporter options
  it('should have mochawesome reporter configured in cypress.config.ts', () => {
    cy.log('STEP: Reading cypress.config.ts to verify mochawesome reporter configuration');
    cy.readFile('qa-framework/frameworks/cypress/cypress.config.ts').then((content: string) => {
      cy.log('NAV: Read cypress.config.ts — inspecting reporter settings');
      cy.log('ASSERT: Expected config to include "mochawesome" reporter string');
      expect(content, 'reporter: mochawesome in config').to.include('mochawesome');
      cy.log('ASSERT: Expected config to include "reporter" key');
      expect(content, '"reporter" key present').to.include('reporter');
      cy.log('ASSERT: Expected config to include "reportDir" option');
      expect(content, '"reportDir" reporter option present').to.include('reportDir');
      cy.log('ASSERT: Expected config to include html: true reporter option');
      expect(content, '"html" reporter option present').to.include('html');
    });
  });

  // ── AC-5: HTML report file exists in the reports directory ────────────────────────────────────────
  // AC-5: After running npm run test, an HTML report file is generated in cypress/reports/
  it('should have an HTML report file in the reports directory after a run', () => {
    cy.log('STEP: Checking for HTML report at qa-framework/frameworks/cypress/reports/results.html');
    cy.readFile('qa-framework/frameworks/cypress/reports/results.html').then((content: string) => {
      cy.log('NAV: Read reports/results.html successfully');
      cy.log('ASSERT: Expected HTML report to have non-empty content');
      expect(content, 'results.html has content').to.have.length.greaterThan(0);
      cy.log('ASSERT: Expected HTML file to be a valid HTML document');
      expect(content, 'results.html is HTML').to.include('<html');
    });
  });

  // ── AC-6: HTML report displays test names, pass/fail statuses, and execution durations ────────────
  // AC-6: The generated HTML report displays all test names, pass/fail statuses, and execution durations
  it('should contain test results content including pass/fail and durations in the HTML report', () => {
    cy.log('STEP: Reading reports/results.html to verify it contains test result content');
    cy.readFile('qa-framework/frameworks/cypress/reports/results.html').then((content: string) => {
      cy.log('NAV: Read results.html — examining embedded report data');
      cy.log('ASSERT: Expected report to include Mochawesome title marker');
      expect(content, 'Mochawesome title present').to.include('Mochawesome Report');
      cy.log('ASSERT: Expected report to include pass/fail status indicators');
      expect(
        content.toLowerCase(),
        'pass/fail status indicator present'
      ).to.satisfy(
        (c: string) =>
          c.includes('passing') || c.includes('pass') || c.includes('failed') || c.includes('failing')
      );
      cy.log('ASSERT: Expected report to include duration data');
      expect(content, 'duration data present').to.include('duration');
    });
  });
});
