// Global TypeScript namespace augmentation for custom Cypress commands.
// Add declarations here whenever a new command is added to commands.ts.

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Logs in to SauceDemo.
       * Falls back to env.username / env.password / env.SAUCE_PASSWORD so
       * cy.type(undefined) never crashes.
       * @param username - Optional username override (defaults to env.username)
       * @param password - Optional password override (defaults to env.password)
       */
      login(username?: string, password?: string): Chainable<void>;

      /**
       * Visit a URL with failOnStatusCode:false and automatic URL logging.
       * Use for all external domains that may be flaky in CI.
       */
      safeVisit(url: string, options?: Partial<VisitOptions>): Chainable<void>;

      /**
       * Make a cy.request() with x-api-key injected from env.REQRES_API_KEY.
       * failOnStatusCode is false so assertions control pass/fail.
       */
      apiRequest(options: Partial<RequestOptions> & { url: string }): Chainable<Response>;

      /**
       * Interact with content inside an iframe.
       * @param iframeSelector - CSS selector for the iframe element
       * @param callback       - Function receiving the iframe body jQuery element
       */
      withinIframe(
        iframeSelector: string,
        callback: ($body: JQuery<HTMLBodyElement>) => void
      ): Chainable<void>;

      /**
       * Alias for cy.task('ensureFixtures', ...).
       * Reads @requiredFixtures metadata from the running spec and creates
       * any missing fixture files via the Node-side task in cypress.config.ts.
       */
      task(
        event: 'ensureFixtures',
        arg: { specFile: string },
        options?: Partial<Loggable & Timeoutable>
      ): Chainable<null>;
    }
  }
}

export {};
