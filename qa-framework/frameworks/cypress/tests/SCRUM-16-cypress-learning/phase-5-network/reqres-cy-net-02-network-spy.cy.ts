// Jira: SCRUM-33 — Assignment 17: Spying on Network Calls
// Concepts: cy.intercept() as a spy, cy.wait() on an alias
// Note: Uses jsonplaceholder.typicode.com via window.fetch() — no page auto-fire dependency
// @requiredFixtures: []

describe('SCRUM-33 | Assignment 17: Spying on Network Calls', () => {
  it('should intercept and spy on a fetch call before it completes', () => {
    // Set up the spy BEFORE any request fires
    cy.intercept('GET', 'https://jsonplaceholder.typicode.com/posts/1').as('getPost');

    // Navigate to any page so window is available
    cy.safeVisit('https://www.saucedemo.com/');

    // Trigger the fetch from the browser context — cy.intercept() will catch it
    cy.window().then((win) => {
      win.fetch('https://jsonplaceholder.typicode.com/posts/1');
    });

    // Wait on the alias — no arbitrary cy.wait(n) needed
    cy.wait('@getPost').then((interception) => {
      cy.log('ASSERT: spy saw status=' + interception.response?.statusCode);
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body).to.have.property('id', 1);
    });
  });
});
