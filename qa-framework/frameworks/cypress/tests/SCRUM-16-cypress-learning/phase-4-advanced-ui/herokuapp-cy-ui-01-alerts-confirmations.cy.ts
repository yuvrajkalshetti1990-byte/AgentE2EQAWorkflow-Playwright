// Jira: SCRUM-28 — Assignment 12: Handling Alerts & Confirmations
// Concepts: Window events, Negative Assertions

import { AlertsPage } from '../../../pages/herokuapp/AlertsPage';

const alertsPage = new AlertsPage();

describe('SCRUM-28 | Assignment 12: Handling Alerts & Confirmations', () => {
  beforeEach(() => {
    alertsPage.visit();
  });

  it('should auto-accept the JS confirm dialog and show "You clicked: Ok"', () => {
    cy.log('STEP: click JS confirm with default accept behaviour, assert result');
    // Cypress auto-accepts confirms by default
    alertsPage.clickJsConfirm();

    alertsPage.getResultText().should('have.text', 'You clicked: Ok');
  });

  it('should cancel the JS confirm dialog and show "You clicked: Cancel"', () => {
    cy.log('STEP: override confirm to return false (cancel), assert result');
    // Return false to simulate clicking Cancel
    cy.on('window:confirm', () => false);

    alertsPage.clickJsConfirm();

    alertsPage.getResultText().should('have.text', 'You clicked: Cancel');
  });
});
