# E2E Test Execution Report — Master Run

| | |
|---|---|
| **Date** | Sun, 05 Apr 2026 |
| **Branch** | `dev` |
| **Environment** | `https://www.saucedemo.com`, `https://reqres.in` |
| **Playwright version** | 1.x (latest) |
| **Cypress version** | 15.13.0 |
| **Node** | v25.2.1 |
| **Overall Status** | ✅ ALL PASS |

---

## 1. Executive Summary

| Metric | Playwright | Cypress | Combined |
|--------|-----------|---------|---------|
| **Specs run** | 5 | 5 | **10** |
| **Total tests** | 5 | 9 | **14** |
| **Passed** | 5 | 9 | **14** |
| **Failed** | 0 | 0 | **0** |
| **Skipped** | 0 | 0 | **0** |
| **Pass rate** | 100% | 100% | **100%** |
| **Total duration** | 5.5s | 7s | **~12.5s** |
| **Healing needed** | No | No | **No** |

---

## 2. Playwright Test Results (SCRUM-14)

**Config:** `qa-framework/frameworks/playwright/playwright.config.ts`  
**Base URL:** `https://www.saucedemo.com`  
**Browser:** Chromium (headless)  
**Workers:** 2 parallel

| # | Spec File | TC ID | Description | Status | Duration |
|---|-----------|-------|-------------|--------|---------|
| 1 | `cart/saucedemo-tc-cart-01-item-details.spec.ts` | TC-CART-01 | Cart page displays all required item details | ✅ PASS | 980ms |
| 2 | `happy-path/saucedemo-tc-hp-01-single-item-checkout.spec.ts` | TC-HP-01 | Complete single-item checkout from login to order confirmation | ✅ PASS | 1100ms |
| 3 | `happy-path/saucedemo-tc-hp-03-cancel-from-overview.spec.ts` | TC-HP-03 | Checkout cancellation from the Overview page | ✅ PASS | 611ms |
| 4 | `negative/saucedemo-tc-neg-01-all-fields-empty.spec.ts` | TC-NEG-01 | Submit checkout form with all fields empty | ✅ PASS | 542ms |
| 5 | `overview/saucedemo-tc-ovw-01-overview-details.spec.ts` | TC-OVW-01 | Overview page displays payment info, shipping info, and price summary | ✅ PASS | 538ms |

### Playwright AC Coverage

| AC | Description | Covered by | Result |
|----|-------------|-----------|--------|
| AC-1 | Cart page displays all cart item details | TC-CART-01 | ✅ |
| AC-2 | Complete single-item checkout from login through order confirmation | TC-HP-01 | ✅ |
| AC-4 | Cancel from Overview returns user to inventory with cart preserved | TC-HP-03 | ✅ |
| AC-5 | Empty form submission shows validation error | TC-NEG-01 | ✅ |
| AC-10 | Order Overview displays payment, shipping, accurate price summary | TC-OVW-01 | ✅ |

### Playwright Notable Assertions (from live run)

- `TC-HP-01`: Verified item name `Sauce Labs Backpack`, price `$29.99`, payment `SauceCard #31337`, shipping `Free Pony Express Delivery!`, subtotal `$29.99`, tax `$2.40`, total `$32.39`, order confirmation heading `Thank you for your order!`, cart badge absent after order
- `TC-CART-01`: Verified 2-item cart with correct names, prices, descriptions, quantities (`1`), and action buttons
- `TC-HP-03`: Verified cart badge still `1` after cancel and remove button still visible for Onesie
- `TC-NEG-01`: Verified error `Error: First Name is required` on empty submit, URL unchanged at `checkout-step-one.html`
- `TC-OVW-01`: Verified Fleece Jacket `$49.99`, item total `$49.99`, tax `$4.00`, grand total `$53.99`

---

## 3. Cypress Test Results (SCRUM-16, SCRUM-17, SCRUM-18)

**Config:** `qa-framework/frameworks/cypress/cypress.config.ts`  
**Base URL:** `https://www.saucedemo.com`  
**Browser:** Electron 138 (headless)

| # | Spec File | Suite | Tests | Status | Duration |
|---|-----------|-------|-------|--------|---------|
| 1 | `scrum-17/saucedemo-cy-setup-04-saucedemo-login-page-loads.cy.ts` | SCRUM-17 AC3 smoke | 1 | ✅ PASS | 476ms |
| 2 | `SCRUM-18-positive-login/saucedemo-cy-auth-01-positive-login.cy.ts` | SCRUM-18: Positive Login Path | 3 | ✅ PASS | 3s |
| 3 | `SCRUM-16-cypress-learning/phase-1-foundation/saucedemo-cy-auth-02-positive-login.cy.ts` | SCRUM-18 \| Assignment 2: The Positive Login Path | 1 | ✅ PASS | 1s |
| 4 | `SCRUM-16-cypress-learning/phase-1-foundation/saucedemo-cy-auth-03-negative-login.cy.ts` | SCRUM-19 \| Assignment 3: The Negative Login Path | 1 | ✅ PASS | 1s |
| 5 | `SCRUM-16-cypress-learning/phase-5-network/reqres-cy-net-01-api-testing.cy.ts` | SCRUM-32 \| Assignment 16: Direct API Testing | 3 | ✅ PASS | 1s |

### Cypress Individual Test Results

| Spec | Test | Status |
|------|------|--------|
| setup-04 | should load the SauceDemo login page at the root URL | ✅ |
| auth-01 | should redirect to /inventory.html after successful login with standard credentials | ✅ |
| auth-01 | should display the Products page title after login | ✅ |
| auth-01 | should display at least one inventory item on the inventory page | ✅ |
| auth-02 | should login with standard_user and land on the inventory page | ✅ |
| auth-03 | should show an error and stay on login page for locked_out_user | ✅ |
| net-01 | GET /posts should return 200 with a non-empty data array | ✅ |
| net-01 | POST /posts should create a resource and return 201 | ✅ |
| net-01 | GET /posts/9999 should return 404 for a non-existent resource | ✅ |

---

## 4. POM Compliance Status

All specs are now fully POM-compliant. Violations fixed in this run:

| File | Violation | Fix Applied |
|------|-----------|-------------|
| `tc-hp-01` | 10 raw `page.locator()` inline selectors in overview + cart assertions | Replaced with `checkoutPage.assertOverviewItem()`, `assertOverviewPaymentShipping()`, `assertOverviewSummary()`, `assertCancelFinishVisible()` |
| `tc-hp-01` | `page.locator('[data-test="remove-..."]')` inline | Replaced with new `inventoryPage.assertItemAdded('sauce-labs-backpack')` |
| `tc-hp-01` | `page.locator('.shopping_cart_badge')` inline | Replaced with new `inventoryPage.assertCartBadgeAbsent()` |
| `tc-hp-03` | `page.locator('[data-test="remove-sauce-labs-onesie"]')` inline | Replaced with `inventoryPage.assertItemAdded('sauce-labs-onesie')` |

**POM methods added:**
- `InventoryPage.assertItemAdded(itemSlug: string)` — verifies remove button visible after add-to-cart
- `InventoryPage.assertCartBadgeAbsent()` — verifies cart badge not visible

---

## 5. State Management Status

| Story | File | `acVerdict` | `testsPassed` | Tests |
|-------|------|-------------|---------------|-------|
| SCRUM-14 | `scrum-14.state.json` | AUTOMATE (4.6) | ✅ true | 5/5 |
| SCRUM-16 | `scrum-16.state.json` | AUTOMATE (4.2) | ✅ true | 5/5 |
| SCRUM-17 | `scrum-17.state.json` | AUTOMATE (4.4) | ✅ true | 1/1 |
| SCRUM-18 | `scrum-18.state.json` | AUTOMATE (4.5) | ✅ true | 3/3 |

---

## 6. Infrastructure Health

| Check | Status |
|-------|--------|
| TypeScript errors (workspace) | ✅ 0 errors |
| `qa-framework/common/types/index.ts` | ✅ exists |
| `qa-framework/common/utils/logger.ts` | ✅ exists |
| `qa-framework/common/pipeline-state/state-manager.ts` | ✅ exists |
| All 4 state JSON files present | ✅ |
| POM gate violations | ✅ 0 |
| Playwright config resolves | ✅ |
| Cypress config resolves | ✅ |

---

## 7. Conclusion

- **14 / 14 tests pass** across both frameworks, no failures, no skips.
- All raw locator violations resolved — specs are fully POM-compliant.
- State management is active for all 4 Jira stories (SCRUM-14, 16, 17, 18).
- Infrastructure layer (common types, logger, state-manager) is clean with zero TS errors.
- The `reqres.in` network-dependent test (`net-01`) passed — external API was available at time of run.
