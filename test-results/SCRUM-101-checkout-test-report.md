# Test Execution Report — SCRUM-101: E-commerce Checkout Process

**Report Date:** 27 March 2026
**Application Under Test:** https://www.saucedemo.com
**Credentials Used:** `standard_user` / `secret_sauce`
**Test Plan:** `specs/saucedemo-checkout-test-plan.md`
**Automated Scripts Location:** `tests/saucedemo-checkout/`

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Total Test Cases Planned | 18 |
| Manual Exploratory Testing | 5 scenarios executed |
| Automated Test Cases | 10 (run across 3 browsers = 30 executions) |
| Overall Status | ✅ **PASSED** |
| Manual Pass | 5 / 5 |
| Automated Pass | 30 / 30 |
| Automated Fail | 0 / 30 |
| Defects Found | 0 |
| Healing Required | None |

---

## 2. Manual Exploratory Testing Results (Step 3)

Exploratory testing was performed using the Playwright MCP browser tools against the live application.

### Scenarios Executed

| # | Scenario | Result | Observations |
|---|---|---|---|
| 1 | Login with valid credentials | ✅ PASS | Redirected to `/inventory.html`; 6 products visible |
| 2 | Add Backpack to cart | ✅ PASS | Cart badge showed `1`; button changed to `Remove` |
| 3 | Cart review (AC1) | ✅ PASS | Item name, description, qty, price displayed; `Continue Shopping` and `Checkout` buttons present |
| 4 | Form validation — all empty fields | ✅ PASS | Error: "Error: First Name is required" displayed; form stayed on step-one |
| 5 | Full happy-path checkout (AC2→AC3→AC4) | ✅ PASS | Info form accepted; Overview showed payment/shipping/totals; Completion showed success message and `Back Home` button |

### Key Selectors Discovered

| Element | Selector |
|---|---|
| Username input | `[data-test="username"]` |
| Password input | `[data-test="password"]` |
| Login button | `[data-test="login-button"]` |
| Add to cart (Backpack) | `[data-test="add-to-cart-sauce-labs-backpack"]` |
| Cart badge | `.shopping_cart_badge` |
| Checkout button | `[data-test="checkout"]` |
| First Name field | `[data-test="firstName"]` |
| Last Name field | `[data-test="lastName"]` |
| Zip/Postal Code field | `[data-test="postalCode"]` |
| Continue button | `[data-test="continue"]` |
| Finish button | `[data-test="finish"]` |
| Back Home button | `[data-test="back-to-products"]` |
| Error message | `[data-test="error"]` |
| Item total (overview) | `.summary_subtotal_label` |
| Tax (overview) | `.summary_tax_label` |
| Total (overview) | `.summary_total_label` |
| Payment/Shipping info | `.summary_info` |

### Issues Found During Manual Testing

None. Application behaved as expected across all explored flows.

---

## 3. Automated Test Results (Steps 4 & 5)

### Test Suite Summary

All automation scripts were generated in TypeScript using Playwright. Tests ran across **3 browsers** (Chromium, Firefox, WebKit) with **5 parallel workers** in **25.8 seconds**.

### Execution Results by Suite

#### Happy Path

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-HP-01 | Complete single-item checkout from login to order confirmation | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-HP-02 | Complete multi-item checkout with correct price calculations | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-HP-03 | Checkout cancellation from the Overview page | ✅ PASS | ✅ PASS | ✅ PASS |

#### Negative / Validation

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-NEG-01 | Submit checkout form with all fields empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-02 | Submit checkout form with First Name empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-03 | Submit checkout form with Last Name empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-04 | Submit checkout form with Zip/Postal Code empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-05 | Error dismissal by clicking the X on the error message | ✅ PASS | ✅ PASS | ✅ PASS |

#### Cart Review (AC1)

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-CART-01 | Cart page displays all required item details | ✅ PASS | ✅ PASS | ✅ PASS |

#### Order Overview (AC3)

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-OVW-01 | Overview page displays payment info, shipping info, and price summary | ✅ PASS | ✅ PASS | ✅ PASS |

**Total: 30 / 30 executions passed. 0 failures.**

### Healing Activities

No healing was required. All tests passed on the first execution run.

---

## 4. Defects Log

No defects found during manual or automated testing.

---

## 5. Test Coverage Analysis

### Acceptance Criteria Coverage

| AC | Criteria | Covered By | Status |
|---|---|---|---|
| AC1 | Cart displays item name, description, price, quantity; Continue Shopping + Checkout buttons | TC-CART-01 + Manual exploration | ✅ Covered |
| AC2 | Checkout form with First Name, Last Name, Zip; all mandatory; error messages on empty submit | TC-NEG-01 through TC-NEG-05 | ✅ Covered |
| AC3 | Order overview: items, payment info, shipping info, subtotal/tax/total, Cancel/Finish | TC-OVW-01 + TC-HP-01 | ✅ Covered |
| AC4 | Order completion: success message, Back Home, cart cleared | TC-HP-01 + TC-HP-02 | ✅ Covered |
| AC5 | Validation errors for invalid/empty data; cannot proceed until valid | TC-NEG-01 through TC-NEG-04 | ✅ Covered |

### Coverage from Manual vs Automated

| Type | Scenarios Covered |
|---|---|
| Manual Exploratory | Login flow, cart review, empty-form validation, full happy-path end-to-end |
| Automated | All 5 AC scenarios across 3 browsers; multi-item cart; cancellation; error dismiss |

### Gaps & Recommendations

| Gap | Recommendation |
|---|---|
| Edge cases (special characters, long input, whitespace) defined in test plan but not in automated suite | Add TC-EDGE-01 through TC-EDGE-04 in a future sprint |
| Navigation breadcrumb tests (TC-NAV-01…04) not automated | Add navigation suite to complete full plan coverage |
| No mobile/responsive testing executed | Run Playwright on mobile viewports (iPhone/Pixel) as defined in Technical Notes |
| Locked-out user and problem user scenarios not tested | Add negative login tests using locked_out_user credentials |

---

## 6. Summary and Recommendations

### Overall Quality Assessment

The SauceDemo checkout application is functionally sound for the `standard_user` role. All 5 acceptance criteria are verified and passing across the full Chromium, Firefox, and WebKit browser matrix. The application provides:
- Clear, consistent validation error messages
- Stable data-test attribute selectors enabling reliable automation
- Correct price calculations (subtotal, tax, total)
- Correct post-order behavior (cart cleared, confirmation page)

### Risk Areas

| Risk | Severity | Notes |
|---|---|---|
| No XSS/special character input sanitization validation | Medium | TC-EDGE-01 should be added to confirm no script injection vulnerability |
| No server-side total verification | Low | Tax rate assumed constant ($2.40 on $29.99); should verify for varied cart values |
| Only standard_user tested | Medium | Other user types (problem_user, visual_user) may expose UI bugs |

### Next Steps

1. Add edge case and navigation test suites (TC-EDGE, TC-NAV)
2. Add negative login tests (locked_out_user)
3. Run tests on mobile viewports
4. Integrate into CI/CD pipeline to run on every pull request
5. Add visual regression testing for checkout UI components
