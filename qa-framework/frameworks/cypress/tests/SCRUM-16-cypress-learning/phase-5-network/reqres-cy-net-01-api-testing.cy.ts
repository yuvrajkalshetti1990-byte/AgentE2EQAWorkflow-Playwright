// Jira: SCRUM-32 — Assignment 16: Direct API Testing (Positive & Negative)
// Concepts: cy.apiRequest() wrapping cy.request(), HTTP status assertions
// Note: Uses jsonplaceholder.typicode.com — free, no API key required
// @requiredFixtures: []

describe('SCRUM-32 | Assignment 16: Direct API Testing (Positive & Negative)', () => {
  const baseUrl = 'https://jsonplaceholder.typicode.com';

  // AC-1: GET /posts returns 200 with a non-empty data array
  it('GET /posts should return 200 with a non-empty data array', () => {
    cy.apiRequest({ method: 'GET', url: `${baseUrl}/posts` }).then((response) => {
      cy.log('ASSERT: GET /posts status=' + response.status);
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array').and.have.length.greaterThan(0);
    });
  });

  // AC-2: POST /posts creates a resource and returns 201
  it('POST /posts should create a resource and return 201', () => {
    cy.apiRequest({
      method: 'POST',
      url: `${baseUrl}/posts`,
      body: { title: 'Test Post', body: 'QA', userId: 1 },
    }).then((response) => {
      cy.log('ASSERT: POST /posts status=' + response.status);
      expect(response.status).to.equal(201);
      expect(response.body.title).to.equal('Test Post');
    });
  });

  // AC-3: GET /posts/9999 returns 404 for a non-existent resource
  it('GET /posts/9999 should return 404 for a non-existent resource', () => {
    cy.apiRequest({
      url: `${baseUrl}/posts/9999`,
      failOnStatusCode: false,
    }).then((response) => {
      cy.log('ASSERT: GET /posts/9999 status=' + response.status);
      expect(response.status).to.equal(404);
    });
  });
});
