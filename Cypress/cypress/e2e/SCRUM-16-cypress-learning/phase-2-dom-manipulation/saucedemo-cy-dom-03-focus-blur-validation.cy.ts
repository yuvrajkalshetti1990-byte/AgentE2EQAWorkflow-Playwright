// SCRUM-23 | Assignment 7: Triggering Validation via Focus/Blur
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

  it('should trigger error state on First Name input via focus then blur', () => {
    checkoutPage.assertOnStepOne();

    // Click into the field, then click away without typing
    checkoutPage.getFirstNameInput().focus().blur();

    // SauceDemo adds the 'error' class to the container on blur without value
    // TODO: Adjust selector if the exact error class differs in your browser
    checkoutPage.getFirstNameInput().should('have.class', 'error');
  });
});
