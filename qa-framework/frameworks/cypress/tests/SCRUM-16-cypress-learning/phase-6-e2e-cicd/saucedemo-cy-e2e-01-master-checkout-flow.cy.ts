// SCRUM-35 | Assignment 19: The Master E2E Flow
// Concepts: Tying it all together — custom commands, fixtures, full checkout journey
// @requiredFixtures: ["checkout-user.json"]

import { InventoryPage } from '../../../pages/saucedemo/InventoryPage';
import { CartPage }      from '../../../pages/saucedemo/CartPage';
import { CheckoutPage }  from '../../../pages/saucedemo/CheckoutPage';

interface CheckoutUser {
  firstName: string;
  lastName: string;
  postalCode: string;
}

const inventoryPage = new InventoryPage();
const cartPage      = new CartPage();
const checkoutPage  = new CheckoutPage();

describe('SCRUM-35 | Assignment 19: The Master E2E Flow', () => {
  it('should complete a full checkout journey for two items and confirm the order', () => {
    // Step 1 — Login via custom command (password from env)
    cy.login('standard_user');

    // Step 2 — Add exactly two distinct items to the cart
    inventoryPage.addToCartByName('Sauce Labs Backpack');
    inventoryPage.addToCartByName('Sauce Labs Bike Light');
    inventoryPage.getCartBadge().should('have.text', '2');

    // Step 3 — Navigate to cart and proceed to checkout
    inventoryPage.goToCart();
    cartPage.assertOnPage();
    cartPage.getCartItems().should('have.length', 2);
    cartPage.clickCheckout();

    // Step 4 — Fill checkout form from fixture
    cy.fixture<CheckoutUser>('checkout-user.json').then((user) => {
      checkoutPage.fillForm(user.firstName, user.lastName, user.postalCode);
    });
    checkoutPage.clickContinue();

    // Step 5 — Verify overview and finish
    checkoutPage.assertOnStepTwo();
    checkoutPage.clickFinish();

    // Step 6 — Confirm the order success message
    checkoutPage
      .getConfirmationMessage()
      .should('have.text', 'Thank you for your order!');
  });
});
