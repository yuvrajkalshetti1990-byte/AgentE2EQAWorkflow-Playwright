// SCRUM-33 | Assignment 17: Spying on Network Calls
// Concepts: cy.intercept() as a spy, cy.wait()

describe('SCRUM-33 | Assignment 17: Spying on Network Calls', () => {
  it('should wait for the GET /users?page=2 network call before asserting the response', () => {
    // Set up the spy BEFORE any navigation or click
    cy.intercept('GET', '/api/users?page=2').as('getUsers');

    cy.visit('https://reqres.in/');

    // Trigger the network call (click the button or rely on page-load call)
    // Reqres fires the call automatically on page load; uncomment below if there is a button:
    // cy.contains('button', 'List users').click();

    // Wait on the alias — no arbitrary cy.wait(5000) needed
    cy.wait('@getUsers').its('response.statusCode').should('equal', 200);
  });
});
