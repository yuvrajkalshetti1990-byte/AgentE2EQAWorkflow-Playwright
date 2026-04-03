import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Default base URL for the SCRUM-16 Cypress Learning assignments (SauceDemo).
    // Override with --env or cypress.env.json for other apps.
    baseUrl: 'https://www.saucedemo.com',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',

    // HTML reporter (Assignment 20).
    // Install: npm install cypress-mochawesome-reporter --save-dev
    reporter: 'cypress-mochawesome-reporter',
    reporterOptions: {
      charts: true,
      reportPageTitle: 'Cypress Learning — SCRUM-16 Test Report',
      embeddedScreenshots: true,
      inlineAssets: true,
      saveAllAttempts: false,
      reportDir: 'cypress/reports',
    },

    setupNodeEvents(on) {
      // Required by cypress-mochawesome-reporter
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('cypress-mochawesome-reporter/plugin')(on);
    },
  },
});
