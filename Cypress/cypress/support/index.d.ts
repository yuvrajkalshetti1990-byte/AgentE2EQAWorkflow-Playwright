// Global TypeScript namespace augmentation for custom Cypress commands.
// Add declarations here whenever a new command is added to commands.ts.

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Logs in to SauceDemo.
       * Password is sourced from `cypress.env.json` → `SAUCE_PASSWORD`.
       * @param username - The SauceDemo username to authenticate with.
       */
      login(username: string): Chainable<void>;
    }
  }
}

export {};
