# Test Execution Report — SCRUM-101: E-commerce Checkout Process

**Report Date:** 1 April 2026
**Application Under Test:** https://www.saucedemo.com
**Credentials Used:** `standard_user` / `secret_sauce`
**Test Plan:** `specs/saucedemo-checkout-test-plan.md`
**Automated Scripts Location:** `tests/saucedemo-checkout/`

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Total Test Cases | 13 |
| Browsers | Chromium, Firefox, WebKit (3 browsers) |
| Total Executions | 39 (13 TCs × 3 browsers) |
| Overall Status | ✅ **PASSED** |
| Initial Run — Pass | 38 / 39 |
| Initial Run — Fail | 1 / 39 (TC-NEG-01 — intentionally broken locator) |
| Healed | 1 (TC-NEG-01 — locator corrected by AI healer) |
| Final Pass after Healing | 39 / 39 |
| Defects Found | 0 |
| Total Execution Time (post-heal run) | 17.6s |

---

## 2. Heal Cycle Details

### What Was Broken
TC-NEG-01 was intentionally broken by changing the error message locator from `[data-test="error"]` to `[data-test="error-container"]` — a non-existent selector — to simulate a real-world locator drift scenario (e.g., when a developer renames a `data-test` attribute).

### Failure Output (Initial Run — Chromium)

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-test="error-container"]')
Expected substring: "Error: First Name is required"
Timeout: 5000ms
Error: element(s) not found

File: tests/saucedemo-checkout/negative/tc-neg-01-all-fields-empty.spec.ts:27
```

### Heal Applied

| Item | Detail |
|---|---|
| File | `tests/saucedemo-checkout/negative/tc-neg-01-all-fields-empty.spec.ts` |
| Line | 27 |
| Before | `page.locator('[data-test="error-container"]')` |
| After | `page.locator('[data-test="error"]')` |
| Healed By | AI playwright-test-healer agent |
| Root Cause | Selector `data-test="error-container"` does not exist; correct attribute is `data-test="error"` |

---

## 3. Automated Test Results (Post-Heal — All Browsers)

### Happy Path

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-HP-01 | Complete single-item checkout from login to order confirmation | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-HP-02 | Complete multi-item checkout with correct price calculations | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-HP-03 | Checkout cancellation from the Overview page | ✅ PASS | ✅ PASS | ✅ PASS |

### Negative / Validation

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-NEG-01 | Submit checkout form with all fields empty *(healed)* | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-02 | Submit checkout form with First Name empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-03 | Submit checkout form with Last Name empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-04 | Submit checkout form with Zip/Postal Code empty | ✅ PASS | ✅ PASS | ✅ PASS |
| TC-NEG-05 | Error dismissal by clicking the X on the error message | ✅ PASS | ✅ PASS | ✅ PASS |

### Cart Review (AC1)

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-CART-01 | Cart page displays all required item details | ✅ PASS | ✅ PASS | ✅ PASS |

### Order Overview (AC3)

| Test ID | Test Name | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| TC-OVW-01 | Overview page displays payment, shipping, and price breakdown | ✅ PASS | ✅ PASS | ✅ PASS |

---

## 4. Test Execution Timeline

| Phase | Action | Result |
|---|---|---|
| Phase 1 — Break | TC-NEG-01 locator changed to `[data-test="error-container"]` | 1 test failing |
| Phase 2 — Initial Run | `npx playwright test --project=chromium` | 12 passed, 1 failed |
| Phase 3 — Heal | AI healer identified and fixed wrong locator | Selector restored to `[data-test="error"]` |
| Phase 4 — Final Run | `npx playwright test` (all 3 browsers) | 39 / 39 passed in 17.6s |

---

## 5. Defects Log

No defects found. The only failure was an intentionally introduced locator break, which was successfully healed by the AI agent.

---

## 6. Key Selectors Reference

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
| **Error message** | **`[data-test="error"]`** *(healed from `error-container`)* |
| Item total (overview) | `.summary_subtotal_label` |
| Tax (overview) | `.summary_tax_label` |
| Total (overview) | `.summary_total_label` |
| Payment/Shipping info | `.summary_info` |
