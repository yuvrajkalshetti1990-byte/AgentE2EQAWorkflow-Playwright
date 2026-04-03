# `notimplemented/` — Unautomatable Test Stubs

This folder holds stub test files for acceptance criteria that **cannot be automated** yet.

No AC is silently skipped. Every AC that cannot be implemented gets a file here with a clear
explanation of what is missing and what is needed to resolve it.

---

## Why this folder exists

When the AC reviewer or test generator encounters an AC that is:

- **Not UI-reachable** — e.g. requires verifying an email inbox, database state, or third-party webhook
- **Missing selectors** — the target element has no stable `data-testid`, ARIA role, or text content
- **Missing test data** — the test requires specific user accounts, product IDs, or external API state
- **Ambiguous** — the AC is too vague to produce a deterministic pass/fail assertion

…instead of silently skipping it, it creates a `.notimplemented.spec.ts` or `.notimplemented.cy.ts`
file here and marks it `test.skip()` / `it.skip()`.

---

## File naming

```
{issue-key-lowercase}-ac-{n}.notimplemented.spec.ts   ← Playwright
{issue-key-lowercase}-ac-{n}.notimplemented.cy.ts      ← Cypress
```

Example: `scrum-18-ac-3.notimplemented.spec.ts`

---

## How to resolve a stub

1. Open the stub file — the header comment explains exactly what is missing.
2. Resolve the missing pieces (add selector, create test data, clarify AC).
3. Move the file to the appropriate test folder:
   - Playwright: `Playwright/saucedemo/tests/{story-slug}/`
   - Cypress:    `Cypress/cypress/e2e/{story-slug}/`
4. Remove the `.notimplemented` segment from the filename.
5. Replace `test.skip()` / `it.skip()` with a real implementation.

---

## CI Behaviour

`.notimplemented.*` files are **excluded from CI test runs** by the framework configs:
- `saucedemo.playwright.config.ts` ignores `*.notimplemented.spec.ts`
- `cypress.config.ts` specPattern excludes `*.notimplemented.cy.ts`

This ensures they never block CI while remaining visible in the repository as tracked work items.

---

## Templates

- `_TEMPLATE.spec.ts` — Playwright stub template
- `_TEMPLATE.cy.ts`   — Cypress stub template

Copy and rename the appropriate template when manually creating a stub.
