# SauceDemo Checkout End-to-End Test Plan

## Application Overview

End-to-end test plan for the SauceDemo (https://www.saucedemo.com) e-commerce checkout flow. This plan covers the complete purchase journey for a logged-in standard user: browsing products, adding items to the cart, reviewing the cart, entering checkout information, reviewing the order summary, and completing the order. Tests also cover validation error handling, navigation (back/cancel), edge cases with special characters and long inputs, and post-order state (cart cleared). Credentials used: username `standard_user`, password `secret_sauce`.

## Test Scenarios

### 1. Happy Path – Full Checkout Flow

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-HP-01: Complete single-item checkout from login to order confirmation

**File:** `tests/happy-path/tc-hp-01-single-item-checkout.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com
    - expect: Login page is displayed with Username and Password fields and a Login button
  2. Enter 'standard_user' in the Username field and 'secret_sauce' in the Password field, then click Login
    - expect: User is redirected to the Products inventory page (URL: /inventory.html)
    - expect: Page title shows 'Products'
    - expect: Six product items are visible
  3. Click the 'Add to cart' button next to 'Sauce Labs Backpack' ($29.99)
    - expect: The button label changes to 'Remove'
    - expect: The cart icon badge in the header shows '1'
  4. Click the cart icon in the top-right header
    - expect: Cart page is displayed (URL: /cart.html)
    - expect: Page heading shows 'Your Cart'
    - expect: Sauce Labs Backpack appears with its name, description, quantity '1', and price '$29.99'
    - expect: 'Continue Shopping' and 'Checkout' buttons are visible
  5. Click the 'Checkout' button
    - expect: Checkout: Your Information page is displayed (URL: /checkout-step-one.html)
    - expect: Form has 'First Name', 'Last Name', and 'Zip/Postal Code' fields
    - expect: 'Cancel' and 'Continue' buttons are present
  6. Enter 'John' in First Name, 'Doe' in Last Name, '12345' in Zip/Postal Code
    - expect: All three fields are filled with the entered values
  7. Click the 'Continue' button
    - expect: Checkout: Overview page is displayed (URL: /checkout-step-two.html)
    - expect: Sauce Labs Backpack is listed with qty '1' and price '$29.99'
    - expect: Payment Information shows 'SauceCard #31337'
    - expect: Shipping Information shows 'Free Pony Express Delivery!'
    - expect: Item total, Tax, and Total price summary is shown
    - expect: 'Cancel' and 'Finish' buttons are visible
  8. Click the 'Finish' button
    - expect: Order completion page is displayed (URL: /checkout-complete.html)
    - expect: Heading reads 'Thank you for your order!'
    - expect: Confirmation text reads 'Your order has been dispatched, and will arrive just as fast as the pony can get there!'
    - expect: A 'Back Home' button is visible
  9. Click the 'Back Home' button
    - expect: User is redirected to the Products inventory page (URL: /inventory.html)
    - expect: Cart icon badge is absent or shows no items (cart is cleared)

#### 1.2. TC-HP-02: Complete multi-item checkout with correct price calculations

**File:** `tests/happy-path/tc-hp-02-multi-item-checkout.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com and log in with 'standard_user' / 'secret_sauce'
    - expect: Inventory page is displayed
  2. Click 'Add to cart' for 'Sauce Labs Backpack' ($29.99) and 'Sauce Labs Bike Light' ($9.99)
    - expect: Cart badge shows '2'
  3. Navigate to the cart by clicking the cart icon
    - expect: Both items appear in the cart: 'Sauce Labs Backpack' at $29.99 and 'Sauce Labs Bike Light' at $9.99
    - expect: Quantities are '1' each
    - expect: Item names and descriptions are displayed
    - expect: 'Continue Shopping' and 'Checkout' buttons are visible
  4. Click 'Checkout', then fill in First Name: 'Jane', Last Name: 'Smith', Zip: '90210', and click 'Continue'
    - expect: Checkout: Overview page shows both items
    - expect: Item total is $39.98 ($29.99 + $9.99)
    - expect: Tax is calculated and shown
    - expect: Total equals Item total plus Tax (e.g., $43.18)
  5. Click 'Finish'
    - expect: Order completion page is shown with 'Thank you for your order!' heading
    - expect: Cart is cleared

#### 1.3. TC-HP-03: Checkout cancellation from the Overview page

**File:** `tests/happy-path/tc-hp-03-cancel-from-overview.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Onesie' ($7.99) to the cart, go to cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Fill in First Name: 'Alice', Last Name: 'Walker', Zip: '10001', then click 'Continue'
    - expect: Checkout: Overview page is displayed with the item and price summary
  3. Click the 'Cancel' button on the Overview page
    - expect: User is returned to the Products inventory page (URL: /inventory.html)
    - expect: Cart still shows '1' item in the badge (order was not placed)
    - expect: The item remains in the cart

### 2. Negative / Validation Scenarios

**Seed:** `tests/seed.spec.ts`

#### 2.1. TC-NEG-01: Submit checkout form with all fields empty

**File:** `tests/negative/tc-neg-01-all-fields-empty.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to the cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
    - expect: All form fields are empty
  2. Leave all fields (First Name, Last Name, Zip/Postal Code) empty and click 'Continue'
    - expect: An error message 'Error: First Name is required' is displayed
    - expect: The form remains on the same page
    - expect: User cannot proceed to the Overview page

#### 2.2. TC-NEG-02: Submit checkout form with First Name empty

**File:** `tests/negative/tc-neg-02-first-name-empty.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to the cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Leave First Name empty, enter 'Doe' in Last Name, '12345' in Zip/Postal Code, and click 'Continue'
    - expect: An error message 'Error: First Name is required' is displayed
    - expect: The user stays on the Checkout: Your Information page and cannot proceed

#### 2.3. TC-NEG-03: Submit checkout form with Last Name empty

**File:** `tests/negative/tc-neg-03-last-name-empty.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to the cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter 'John' in First Name, leave Last Name empty, enter '12345' in Zip/Postal Code, and click 'Continue'
    - expect: An error message 'Error: Last Name is required' is displayed
    - expect: The user stays on the Checkout: Your Information page and cannot proceed

#### 2.4. TC-NEG-04: Submit checkout form with Zip/Postal Code empty

**File:** `tests/negative/tc-neg-04-zip-empty.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to the cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter 'John' in First Name, 'Doe' in Last Name, leave Zip/Postal Code empty, and click 'Continue'
    - expect: An error message 'Error: Postal Code is required' is displayed
    - expect: The user stays on the Checkout: Your Information page and cannot proceed

#### 2.5. TC-NEG-05: Error dismissal by clicking the X on the error message

**File:** `tests/negative/tc-neg-05-dismiss-error.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to cart, click 'Checkout', leave all fields empty, and click 'Continue'
    - expect: Error message 'Error: First Name is required' appears with a close (X) button
  2. Click the X icon on the error message banner
    - expect: The error message is dismissed and no longer visible
    - expect: The form fields remain editable so the user can correct the data

### 3. Edge Case Scenarios

**Seed:** `tests/seed.spec.ts`

#### 3.1. TC-EDGE-01: Special characters in checkout form fields

**File:** `tests/edge-cases/tc-edge-01-special-characters.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Bolt T-Shirt' to the cart, go to cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter '<script>alert(1)</script>' in First Name, 'O'Brien-Smith' in Last Name, '!@#$%' in Zip/Postal Code, and click 'Continue'
    - expect: The application either accepts the input and proceeds to Overview (treating it as a string), OR displays a meaningful validation error
    - expect: No JavaScript execution or unhandled exceptions occur (XSS attempt is safely handled)
    - expect: The app does not crash

#### 3.2. TC-EDGE-02: Very long input in checkout form fields

**File:** `tests/edge-cases/tc-edge-02-long-input.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter a 200-character string (e.g., 'A' repeated 200 times) in First Name, 200 characters in Last Name, 200 characters in Zip/Postal Code, and click 'Continue'
    - expect: The application either accepts or rejects the long input gracefully
    - expect: No page crash, layout break, or JavaScript error occurs
    - expect: If accepted, the Overview page displays the truncated or full values without breaking the UI

#### 3.3. TC-EDGE-03: Whitespace-only input in mandatory fields

**File:** `tests/edge-cases/tc-edge-03-whitespace-input.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add any item to the cart, go to cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter '   ' (spaces only) in First Name, '   ' in Last Name, '   ' in Zip/Postal Code, and click 'Continue'
    - expect: The application treats whitespace-only input as invalid and shows appropriate validation error messages
    - expect: OR the app accepts and proceeds — behavior is documented

#### 3.4. TC-EDGE-04: Single item removed from cart before checkout

**File:** `tests/edge-cases/tc-edge-04-remove-item-in-cart.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Backpack' and 'Sauce Labs Bike Light' to the cart, then navigate to the cart page
    - expect: Cart shows 2 items and the badge shows '2'
  2. Click the 'Remove' button next to 'Sauce Labs Bike Light'
    - expect: 'Sauce Labs Bike Light' is removed from the cart
    - expect: Cart badge updates to '1'
    - expect: Only 'Sauce Labs Backpack' remains in the cart
  3. Click 'Checkout', complete the information form (First Name: 'Tom', Last Name: 'Jones', Zip: '33101'), and click 'Continue'
    - expect: Overview page shows only 'Sauce Labs Backpack'
    - expect: Item total is $29.99
    - expect: The removed item does not appear in the order

### 4. Navigation Flow Tests

**Seed:** `tests/seed.spec.ts`

#### 4.1. TC-NAV-01: Continue Shopping from cart returns to inventory without losing cart contents

**File:** `tests/navigation/tc-nav-01-continue-shopping.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Fleece Jacket' to the cart, then click the cart icon
    - expect: Cart page shows 'Sauce Labs Fleece Jacket' and the 'Continue Shopping' button
  2. Click the 'Continue Shopping' button
    - expect: User is returned to the Products inventory page (URL: /inventory.html)
    - expect: Cart badge still shows '1'
    - expect: The item is still in the cart

#### 4.2. TC-NAV-02: Cancel from Checkout Information returns to cart page

**File:** `tests/navigation/tc-nav-02-cancel-from-info.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Onesie' to the cart, navigate to cart, and click 'Checkout'
    - expect: Checkout: Your Information page is displayed
  2. Enter some data in the form fields (First Name: 'Test', Last Name: 'User', Zip: '99999'), then click the 'Cancel' button
    - expect: User is returned to the Products inventory page (URL: /inventory.html)
    - expect: Cart badge still shows '1' (item is retained)
    - expect: Entered form data is discarded

#### 4.3. TC-NAV-03: Cancel from Overview page preserves cart contents

**File:** `tests/navigation/tc-nav-03-cancel-from-overview.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Test.allTheThings() T-Shirt (Red)' to the cart, go to cart, click 'Checkout', fill in valid information (First Name: 'Bob', Last Name: 'Brown', Zip: '77001'), and click 'Continue'
    - expect: Checkout: Overview page is displayed with the item listed
  2. Click the 'Cancel' button on the Checkout: Overview page
    - expect: User is returned to the Products inventory page (URL: /inventory.html)
    - expect: Cart badge still shows '1'
    - expect: The item is still in the cart and the order was not placed

#### 4.4. TC-NAV-04: Cart icon in header is accessible from all checkout steps

**File:** `tests/navigation/tc-nav-04-cart-icon-accessibility.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add one item to the cart, and navigate to the cart page
    - expect: Cart icon with badge '1' is visible in the header
  2. Click 'Checkout' to reach the Checkout: Your Information page and verify the cart icon in the header
    - expect: Cart icon is visible with badge '1' on the Your Information page
  3. Fill in valid information and click 'Continue' to reach the Checkout: Overview page, then verify the cart icon in the header
    - expect: Cart icon is visible with badge '1' on the Overview page

### 5. Cart Review (AC1)

**Seed:** `tests/seed.spec.ts`

#### 5.1. TC-CART-01: Cart page displays all required item details

**File:** `tests/cart/tc-cart-01-item-details.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Backpack' and 'Sauce Labs Bolt T-Shirt' to the cart, then click the cart icon
    - expect: Cart page heading shows 'Your Cart'
  2. Inspect each item row in the cart
    - expect: Each item displays: product name (linked), product description, quantity (QTY column), and unit price
    - expect: 'Sauce Labs Backpack' shows name, description, qty '1', price '$29.99'
    - expect: 'Sauce Labs Bolt T-Shirt' shows name, description, qty '1', price '$15.99'
  3. Verify the action buttons at the bottom of the cart
    - expect: A 'Continue Shopping' button is visible
    - expect: A 'Checkout' button is visible
    - expect: Both buttons are clickable

### 6. Order Overview (AC3)

**Seed:** `tests/seed.spec.ts`

#### 6.1. TC-OVW-01: Overview page displays payment info, shipping info, and price summary

**File:** `tests/overview/tc-ovw-01-overview-details.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Fleece Jacket' ($49.99) to the cart, proceed through checkout with valid info (First Name: 'Chris', Last Name: 'Evans', Zip: '02101')
    - expect: Checkout: Overview page is displayed
  2. Inspect the Payment Information section
    - expect: Payment Information label is present
    - expect: 'SauceCard #31337' is displayed as the payment method
  3. Inspect the Shipping Information section
    - expect: Shipping Information label is present
    - expect: 'Free Pony Express Delivery!' is displayed as the shipping method
  4. Inspect the Price Total section
    - expect: 'Item total: $49.99' is displayed
    - expect: A Tax line is displayed (e.g., 'Tax: $4.00')
    - expect: A Total line is displayed showing the sum of item total and tax (e.g., 'Total: $53.99')
  5. Verify the action buttons
    - expect: A 'Cancel' button is visible
    - expect: A 'Finish' button is visible

### 7. Order Completion (AC4)

**Seed:** `tests/seed.spec.ts`

#### 7.1. TC-COMP-01: Order completion confirms success and clears the cart

**File:** `tests/completion/tc-comp-01-order-success.spec.ts`

**Steps:**
  1. Navigate to https://www.saucedemo.com, log in, add 'Sauce Labs Onesie' to the cart, go to cart, click 'Checkout', enter valid information (First Name: 'Dana', Last Name: 'Scully', Zip: '22101'), click 'Continue', and then click 'Finish'
    - expect: Order completion page is displayed (URL: /checkout-complete.html)
  2. Inspect the order completion page content
    - expect: Page heading reads 'Checkout: Complete!'
    - expect: Success heading reads 'Thank you for your order!'
    - expect: Description text reads 'Your order has been dispatched, and will arrive just as fast as the pony can get there!'
    - expect: A Pony Express image (checkmark/delivery icon) is visible
    - expect: A 'Back Home' button is present
  3. Click the 'Back Home' button
    - expect: User is redirected to the Products inventory page (URL: /inventory.html)
    - expect: Cart icon badge is absent (no number displayed), confirming the cart has been cleared
    - expect: All 'Add to cart' buttons are in their default state (not 'Remove')
