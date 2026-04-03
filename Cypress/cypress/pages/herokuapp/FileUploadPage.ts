export class FileUploadPage {
  private readonly fileInput    = '#file-upload';
  private readonly submitButton = '#file-submit';
  private readonly uploadedFile = '#uploaded-files';

  visit(): void {
    cy.visit('https://the-internet.herokuapp.com/upload');
  }

  selectFile(fixturePath: string): void {
    cy.get(this.fileInput).selectFile(fixturePath);
  }

  submit(): void {
    cy.get(this.submitButton).click();
  }

  getUploadedFileName(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.uploadedFile);
  }
}
