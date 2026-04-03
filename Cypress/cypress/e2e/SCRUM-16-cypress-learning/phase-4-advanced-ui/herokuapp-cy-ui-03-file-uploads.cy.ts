// SCRUM-30 | Assignment 14: File Uploads (Positive & Negative)
// Concepts: .selectFile()

import { FileUploadPage } from '../../../pages/herokuapp/FileUploadPage';

const fileUploadPage = new FileUploadPage();

describe('SCRUM-30 | Assignment 14: File Uploads (Positive & Negative)', () => {
  beforeEach(() => {
    fileUploadPage.visit();
  });

  it('should successfully upload test.txt and show the filename', () => {
    fileUploadPage.selectFile('cypress/fixtures/test.txt');
    fileUploadPage.submit();

    fileUploadPage.getUploadedFileName().should('have.text', 'test.txt');
  });

  it('should show no uploaded file confirmation when submitting without a file', () => {
    // Submit without selecting a file
    fileUploadPage.submit();

    // The uploaded-files element should be absent or empty on the page
    cy.get('#uploaded-files').should('not.exist');
  });
});
