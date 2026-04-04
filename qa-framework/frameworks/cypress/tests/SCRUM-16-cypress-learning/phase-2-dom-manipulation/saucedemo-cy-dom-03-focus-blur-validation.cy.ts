// Jira: SCRUM-23 — Assignment 7: Triggering Validation via Focus/Blur
// Concepts: .focus(), .blur(), Negative Form Validation

import { LoginPage }    from '../../../pages/saucedemo/LoginPage';
import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

const loginPage     = new LoginPage();
const inventoryPage = new InventoryPage();
const cartPage      = new CartPage();
const checkoutPage  = new CheckoutPage();

describe('SCRUM-23 | Assignment 7: Triggering Validation via Focus/Blur', () => {
  beforeEach(() => {
    loginPage.visit();
    loginPage.login('standard_user', 'secret_sauce');

    // Navigate to checkout step one as a prerequisite
    inventoryPage.addToCartByName('Sauce Labs Backpack');
    inventoryPage.goToCart();
    cartPage.clickCheckout();
  });

  // AC-1: First Name input shows error state on focus then blur without entering a value
  it('should trigger error state on First Name input via focus then blur', () => {
    checkoutPage.assertOnStepOne();

    // Click into the field, then click away without typing
    checkoutPage.getFirstNameInput().focus().blur();

    // SauceDemo uses 'input_error' (not 'error') as the CSS class on blur without value.
    // Log actual classes first for observability, then assert with extra timeout for animation.
    checkoutPage.getFirstNameInput().then(($el) => {
      cy.log('ASSERT: Classes on firstName field: ' + $el.attr('class'));
    });
    checkoutPage.getFirstNameInput().should('have.class', 'input_error', { timeout: 8000 });
  });
});
