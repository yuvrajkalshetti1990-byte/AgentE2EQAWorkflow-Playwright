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

    iframePage
      .getIframeBody()
      .clear()
      .type(expectedText);

    iframePage
      .getIframeBody()
      .should('have.text', expectedText);
  });
});
