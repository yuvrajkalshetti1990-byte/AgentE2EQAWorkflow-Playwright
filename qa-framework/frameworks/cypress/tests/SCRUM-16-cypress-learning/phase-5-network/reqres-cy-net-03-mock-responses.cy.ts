// SCRUM-34 | Assignment 18: Mocking Network Responses (Negative UI Testing)
// Concepts: cy.intercept() as a stub — short-circuits the real network call
// Note: Uses jsonplaceholder.typicode.com via window.fetch() — self-contained, no UI dependency
// @requiredFixtures: []

describe('SCRUM-34 | Assignment 18: Mocking Network Responses (Negative UI Testing)', () => {
  it('should stub a GET endpoint with 500 and verify the stubbed response body', () => {
    // Intercept and stub BEFORE the fetch fires
    cy.intercept('GET', 'https://jsonplaceholder.typicode.com/posts/1', {
      statusCode: 500,
      body: { error: 'Server Down' },
    }).as('serverError');

    cy.safeVisit('https://www.saucedemo.com/');

    // Trigger the stubbed fetch from browser context
    cy.window().then((win) => {
      win.fetch('https://jsonplaceholder.typicode.com/posts/1');
    });

    // Confirm the stub was used and the response reflects the mocked data
    cy.wait('@serverError').then((interception) => {
      cy.log('ASSERT: stub saw status=' + interception.response?.statusCode);
      expect(interception.response?.statusCode).to.equal(500);
      expect(interception.response?.body.error).to.equal('Server Down');
    });
  });
});
