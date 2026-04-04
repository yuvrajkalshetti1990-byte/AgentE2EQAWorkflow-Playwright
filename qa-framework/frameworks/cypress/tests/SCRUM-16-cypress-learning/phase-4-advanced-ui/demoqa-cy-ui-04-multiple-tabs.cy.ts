// Jira: SCRUM-31 — Assignment 15: The Multiple Tabs Limitation
// Concepts: Architecture limits, cy.stub(), cy.window()

import { BrowserWindowsPage } from '../../../pages/demoqa/BrowserWindowsPage';

const browserWindowsPage = new BrowserWindowsPage();

describe('SCRUM-31 | Assignment 15: The Multiple Tabs Limitation', () => {
  beforeEach(() => {
    browserWindowsPage.visit();
  });

  // AC-1: window.open is called once when clicking New Tab — without opening a real tab
  it('should verify window.open is called once when clicking New Tab — without opening a real tab', () => {
    cy.log('STEP: stub window.open and click New Tab; assert called once');
    // Stub window.open BEFORE the click so Cypress intercepts it
    browserWindowsPage.stubWindowOpen('windowOpen');

    browserWindowsPage.clickNewTab();

    cy.get('@windowOpen').should('have.been.calledOnce');
  });
});
