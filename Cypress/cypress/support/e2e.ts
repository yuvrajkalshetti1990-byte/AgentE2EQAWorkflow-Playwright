// Cypress support file — loaded before every spec.
// Add global hooks, custom commands imports, and third-party plugin setup here.

import './commands';

// ---------------------------------------------------------------------------
// Global before() — pre-flight guard run once per spec file
// Logs resolved env vars and warns (not fails) for critical missing values.
// ---------------------------------------------------------------------------
before(() => {
  const REQUIRED_ENV: Array<{ key: string; category: string; fallback?: string }> = [
    { key: 'username',       category: 'AUTH',    fallback: 'standard_user' },
    { key: 'password',       category: 'AUTH',    fallback: 'secret_sauce'  },
    { key: 'SAUCE_PASSWORD', category: 'AUTH',    fallback: 'secret_sauce'  },
    { key: 'REQRES_API_KEY', category: 'API_KEY', fallback: 'reqres-free-v1' },
  ];

  const missing: string[] = [];

  for (const entry of REQUIRED_ENV) {
    const val = Cypress.env(entry.key);
    if (!val) {
      if (entry.fallback) {
        // Inject default — avoids cy.type(undefined) crashes
        Cypress.env(entry.key, entry.fallback);
        cy.log(`[preflight] WARN: env.${entry.key} missing — using default (${entry.fallback})`);
      } else {
        missing.push(`${entry.key} [${entry.category}]`);
        cy.log(`[preflight] ERROR: env.${entry.key} is required but not set`);
      }
    } else {
      cy.log(`[preflight] env.${entry.key} OK (${entry.category})`);
    }
  }

  if (missing.length > 0) {
    // Log clearly but don't throw — individual tests will fail naturally with
    // the missing value and the healer can then classify as ENV_MISSING.
    cy.log(`[preflight] Missing required env vars: ${missing.join(', ')}`);
  }
});

// ---------------------------------------------------------------------------
// Global beforeEach() — screenshot + log on test start
// ---------------------------------------------------------------------------
beforeEach(function () {
  cy.log(`[test-start] ${this.currentTest?.fullTitle()}`);
});

// ---------------------------------------------------------------------------
// Global afterEach() — capture page state on failure for debugging
// ---------------------------------------------------------------------------
afterEach(function () {
  if (this.currentTest?.state === 'failed') {
    // Take a screenshot with a title that matches the test name
    const title = (this.currentTest?.title ?? 'unknown')
      .replace(/[^a-z0-9]/gi, '-')
      .slice(0, 80);
    cy.screenshot(`FAILURE--${title}`, { capture: 'fullPage' });
    cy.log(`[failure] Test failed — screenshot captured`);

    // Log current URL for debugging
    cy.url().then(url => cy.log(`[failure] URL at failure: ${url}`));
  }
});
