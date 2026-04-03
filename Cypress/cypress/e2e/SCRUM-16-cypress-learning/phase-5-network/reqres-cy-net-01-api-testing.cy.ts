// SCRUM-32 | Assignment 16: Direct API Testing (Positive & Negative)
// Concepts: cy.request(), API validation

describe('SCRUM-32 | Assignment 16: Direct API Testing (Positive & Negative)', () => {
  const baseUrl = 'https://reqres.in/api';

  it('GET /users?page=2 should return 200 with a non-empty data array', () => {
    // cy.apiRequest() auto-injects x-api-key from Cypress.env('REQRES_API_KEY')
    cy.apiRequest({ method: 'GET', url: `${baseUrl}/users?page=2` }).then((response) => {
      cy.log('ASSERT: GET /users?page=2 status=' + response.status);
      expect(response.status).to.equal(200);
      expect(response.body.data).to.be.an('array').and.have.length.greaterThan(0);
    });
  });

  it('POST /users should create a user and return 201 with the new user data', () => {
    cy.apiRequest({
      method: 'POST',
      url: `${baseUrl}/users`,
      body: { name: 'Test User', job: 'QA' },
    }).then((response) => {
      cy.log('ASSERT: POST /users status=' + response.status);
      expect(response.status).to.equal(201);
      expect(response.body.name).to.equal('Test User');
      expect(response.body.job).to.equal('QA');
    });
  });

  it('GET /users/23 should return 404 for a non-existent user', () => {
    cy.apiRequest({
      url: `${baseUrl}/users/23`,
      failOnStatusCode: false,
    }).then((response) => {
      cy.log('ASSERT: GET /users/23 status=' + response.status);
      expect(response.status).to.equal(404);
    });
  });
});
