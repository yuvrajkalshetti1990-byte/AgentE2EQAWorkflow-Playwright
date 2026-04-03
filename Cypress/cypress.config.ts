import { defineConfig } from 'cypress';
import * as path from 'path';

export default defineConfig({
  e2e: {
    // Default base URL for the SCRUM-16 Cypress Learning assignments (SauceDemo).
    // Override with --env or cypress.env.json for other apps.
    baseUrl: 'https://www.saucedemo.com',

    // Exclude .notimplemented stubs from CI runs
    specPattern:    path.join(__dirname, 'cypress/e2e/**/*.cy.ts'),
    excludeSpecPattern: '**/*.notimplemented.cy.ts',

    // Use absolute path so supportFile resolves correctly regardless of CWD
    supportFile:       path.join(__dirname, 'cypress/support/e2e.ts'),
    videosFolder:      path.join(__dirname, 'cypress/videos'),
    screenshotsFolder: path.join(__dirname, 'cypress/screenshots'),

    // Mochawesome JSON reporter — consumed by post-results-to-jira.yml
    // Stats are written to Cypress/cypress/reports/mochawesome.json
    reporter: 'cypress-mochawesome-reporter',
    reporterOptions: {
      reportDir:    path.join(__dirname, 'cypress/reports'),
      reportFilename: 'mochawesome',
      overwrite:    true,
      html:         true,
      json:         true,
      embeddedScreenshots: false,
      inlineAssets: false,
    },

    setupNodeEvents(on, config) {
      // Wire up Mochawesome reporter hooks
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('cypress-mochawesome-reporter/plugin')(on);
      return config;
    },
  },
});
