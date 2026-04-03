// SCRUM-29 | Assignment 13: The iFrame Challenge
// Concepts: Handling iframes, .its(), .wrap()

import { IframePage } from '../../../pages/herokuapp/IframePage';

const iframePage = new IframePage();

describe('SCRUM-29 | Assignment 13: The iFrame Challenge', () => {
  beforeEach(() => {
    iframePage.visit();
  });

  it('should type text inside the TinyMCE iframe rich-text editor', () => {
    const expectedText = 'Hello from Cypress and TypeScript!';

    // cy.clear() fails on iframe contenteditable body — use cy.withinIframe() instead.
    // '{selectall}{del}' clears existing TinyMCE placeholder content before typing.
    cy.withinIframe('#mce_0_ifr', ($body) => {
      cy.wrap($body)
        .focus()
        .type('{selectall}{del}' + expectedText);
    });

    // Verify the text was entered correctly
    cy.withinIframe('#mce_0_ifr', ($body) => {
      cy.wrap($body).should('have.text', expectedText);
    });
  });
});
