// SCRUM-31 | Assignment 15: The Multiple Tabs Limitation
// Concepts: Architecture limits, cy.stub(), cy.window()

import { BrowserWindowsPage } from '../../../pages/demoqa/BrowserWindowsPage';

const browserWindowsPage = new BrowserWindowsPage();

describe('SCRUM-31 | Assignment 15: The Multiple Tabs Limitation', () => {
  beforeEach(() => {
    browserWindowsPage.visit();
  });

  it('should verify window.open is called once when clicking New Tab — without opening a real tab', () => {
    // Stub window.open BEFORE the click so Cypress intercepts it
    browserWindowsPage.stubWindowOpen('windowOpen');

    browserWindowsPage.clickNewTab();

    cy.get('@windowOpen').should('have.been.calledOnce');
  });
});
