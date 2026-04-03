import { defineConfig } from 'cypress';
import * as path from 'path';

export default defineConfig({
  e2e: {
    // Default base URL for the SCRUM-16 Cypress Learning assignments (SauceDemo).
    // Override with --env or cypress.env.json for other apps.
    baseUrl: 'https://www.saucedemo.com',
    specPattern: path.join(__dirname, 'cypress/e2e/**/*.cy.ts'),
    // Use absolute path so supportFile resolves correctly regardless of CWD
    supportFile: path.join(__dirname, 'cypress/support/e2e.ts'),
    videosFolder: path.join(__dirname, 'cypress/videos'),
    screenshotsFolder: path.join(__dirname, 'cypress/screenshots'),

    setupNodeEvents(_on, _config) {
      // Reserved for future plugin setup
    },
  },
});
