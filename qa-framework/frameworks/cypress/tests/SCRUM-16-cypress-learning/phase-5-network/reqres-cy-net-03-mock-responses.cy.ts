// SCRUM-34 | Assignment 18: Mocking Network Responses (Negative UI Testing)
// Concepts: cy.intercept() as a stub

describe('SCRUM-34 | Assignment 18: Mocking Network Responses (Negative UI Testing)', () => {
  it('should stub the users API with a 500 and verify the UI indicates a failure', () => {
    // Intercept and stub BEFORE the page loads
    cy.intercept('GET', '/api/users?page=2', {
      statusCode: 500,
      body: { error: 'Server Down' },
    }).as('serverError');

    cy.safeVisit('https://reqres.in/');

    // Confirm the stub was used
    cy.wait('@serverError');

    // Verify the page does not successfully render the user list
    // (adjust the selector to match actual Reqres UI behaviour)
    cy.get('#output').should('not.contain', 'George');
  });
});
