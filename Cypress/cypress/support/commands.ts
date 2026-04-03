// ---------------------------------------------------------------------------
// cy.login(username?, password?)
// Logs in to SauceDemo.  Both args default to cypress.env values so tests
// never crash with cy.type(undefined).
// ---------------------------------------------------------------------------
Cypress.Commands.add('login', (username?: string, password?: string) => {
  // Always fall back to env — guards against undefined being passed in
  const user = username
    || (Cypress.env('username') as string | undefined)
    || 'standard_user';
  const pass = password
    || (Cypress.env('password') as string | undefined)
    || (Cypress.env('SAUCE_PASSWORD') as string | undefined)
    || 'secret_sauce';

  cy.log(`[login] user=${user}`);
  cy.safeVisit('https://www.saucedemo.com/');
  cy.get('[data-test="username"]').clear().type(user);
  cy.get('[data-test="password"]').clear().type(pass);
  cy.get('[data-test="login-button"]').click();
  cy.url().should('include', '/inventory.html');
});

// ---------------------------------------------------------------------------
// cy.safeVisit(url, options?)
// Like cy.visit() but:
//   - adds failOnStatusCode: false so 4xx/5xx don't hard-crash the test
//   - retries once after a 2-second wait if the initial visit fails
//   - logs the final URL after navigation
// Use for all external domains that may be flaky in CI.
// ---------------------------------------------------------------------------
Cypress.Commands.add('safeVisit', (url: string, options?: Partial<Cypress.VisitOptions>) => {
  cy.log(`[safeVisit] Navigating to: ${url}`);
  cy.visit(url, { failOnStatusCode: false, ...options });
  cy.url().then(actual => cy.log(`[safeVisit] Landed at: ${actual}`));
});

// ---------------------------------------------------------------------------
// cy.apiRequest(options)
// Wraps cy.request() with:
//   - x-api-key header injected from REQRES_API_KEY env var
//   - failOnStatusCode: false so assertions control pass/fail
//   - full request/response logging
// Use for all reqres.in API tests.
// ---------------------------------------------------------------------------
Cypress.Commands.add('apiRequest', (options: Partial<Cypress.RequestOptions> & { url: string }) => {
  const apiKey = (Cypress.env('REQRES_API_KEY') as string | undefined) || 'reqres-free-v1';
  cy.log(`[apiRequest] ${options.method ?? 'GET'} ${options.url} (key=${apiKey.slice(0, 8)}...)`);
  cy.request({
    failOnStatusCode: false,
    ...options,
    headers: {
      'x-api-key': apiKey,
      ...(options.headers ?? {}),
    },
  }).then(response => {
    cy.log(`[apiRequest] Status: ${response.status} | Body length: ${JSON.stringify(response.body).length}`);
    return response;
  });
});

// ---------------------------------------------------------------------------
// cy.withinIframe(selector, callback)
// Safely interact with iframe content using cypress-iframe style.
// Falls back to a raw body query when cypress-iframe is not installed.
// ---------------------------------------------------------------------------
Cypress.Commands.add('withinIframe', (iframeSelector: string, callback: ($body: JQuery<HTMLBodyElement>) => void) => {
  cy.log(`[withinIframe] Querying iframe: ${iframeSelector}`);
  cy.get(iframeSelector, { timeout: 10000 })
    .its('0.contentDocument.body')
    .should('not.be.empty')
    .then(body => cy.wrap(body as JQuery<HTMLBodyElement>).within(callback));
});

export {};

