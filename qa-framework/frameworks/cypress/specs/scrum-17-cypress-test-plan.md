# SauceDemo — Cypress Test Plan: SCRUM-17 (TypeScript Project Initialization)

**Application URL:** https://www.saucedemo.com/  
**Jira Story:** SCRUM-17  
**Summary:** Assignment 1: TypeScript Project Initialization  
**Status:** In QA  
**Explored:** 2026-04-04  
**Planner:** @cypress-test-planner  
**Generator:** @cypress-test-generator  
**Branch:** auto/test-scrum-17  
**Seed file:** `qa-framework/frameworks/cypress/specs/scrum-17-cypress-test-plan.md`

---

## Application Overview

SauceDemo (`https://www.saucedemo.com/`) is a Sauce Labs demo e-commerce site used for QA practice.
The root URL (`/`) renders a login page with username and password fields and a submit button.
This story verifies that the Cypress TypeScript project scaffolding is correctly configured so that
the project baseline is valid for all future test authoring.

---

## Selectors Reference

| Element | Selector | Page |
|---|---|---|
| Username field | `[data-test="username"]` | Login |
| Password field | `[data-test="password"]` | Login |
| Login button | `[data-test="login-button"]` | Login |
| Login form container | `#login_button_container` | Login |
| App root wrapper | `.login_wrapper` | Login |
| Page title (logo) | `.login_logo` | Login |
| Error message banner | `[data-test="error"]` | Login |
| Inventory page header | `.inventory_list` | Inventory (post-login) |

---

## Authentication

For smoke tests that require a login step, use the custom command:

```ts
cy.login()                        // logs in as standard_user
cy.login('locked_out_user')       // logs in as a different user type
```

Credentials must never be hard-coded. Always use:
```ts
Cypress.env('username') ?? 'standard_user'
Cypress.env('password') ?? 'secret_sauce'
```

---

## AC Analysis & Automation Feasibility

| AC | Description | Type | Automatable? | Approach |
|---|---|---|---|---|
| AC1 | `package.json` contains `cypress` + `typescript` as devDependencies | File check | ✅ Yes | `cy.readFile()` |
| AC2 | `tsconfig.json` has required `compilerOptions` | File check | ✅ Yes | `cy.readFile()` |
| AC3a | `cypress.config.ts` exists and sets `baseUrl` to SauceDemo | File check | ✅ Yes | `cy.readFile()` |
| AC3b | `https://www.saucedemo.com/` loads the login page correctly | Smoke browser test | ✅ Yes | `cy.safeVisit()` + assertions |
| AC4 | `npx cypress open` launches without compilation errors | CLI / GUI test runner | ❌ Not automatable | NOTIMPLEMENTED |
| AC5 | Default Cypress folder scaffold exists | File check | ✅ Yes | `cy.task('fileExists')` |

---

## Test Scenarios

---

### TC-SETUP-01 — Verify package.json Contains Required devDependencies

**Suggested file:** `saucedemo-cy-setup-01-package-json-dependencies.cy.ts`  
**Target folder:** `qa-framework/frameworks/cypress/tests/scrum-17/`  
**Jira story:** SCRUM-17  
**AC:** AC1  
**Priority:** High

**Preconditions:**
- Fresh Cypress session; no browser state required
- `package.json` exists at project root (`qa-framework/frameworks/cypress/package.json`)

**Steps:**
1. Use `cy.readFile('package.json')` to read the Cypress project's `package.json`
2. Assert that `devDependencies` property exists on the parsed object
3. Assert that `devDependencies` contains a key `cypress`
4. Assert that `devDependencies` contains a key `typescript`
5. Use `cy.log()` to mark assertion checkpoints

**Expected Results:**
- `package.json` is readable and valid JSON
- `response.devDependencies` has property `cypress` (any semver value)
- `response.devDependencies` has property `typescript` (any semver value)

**Cypress Notes:**
- Use `cy.readFile('package.json')` — Cypress resolves paths relative to `projectRoot` (i.e., the folder containing `cypress.config.ts`)
- Chain `.then((pkg) => { expect(pkg.devDependencies).to.have.property('cypress'); ... })`
- Use `cy.log('Checking devDependencies for cypress and typescript')` before assertions
- Do NOT use `cy.safeVisit()` — this is a pure file check; no browser navigation needed

**Example assertion shape:**
```ts
cy.readFile('package.json').then((pkg) => {
  cy.log('Asserting cypress devDependency exists');
  expect(pkg.devDependencies).to.have.property('cypress');
  cy.log('Asserting typescript devDependency exists');
  expect(pkg.devDependencies).to.have.property('typescript');
});
```

---

### TC-SETUP-02 — Verify tsconfig.json Contains Required compilerOptions

**Suggested file:** `saucedemo-cy-setup-02-tsconfig-compiler-options.cy.ts`  
**Target folder:** `qa-framework/frameworks/cypress/tests/scrum-17/`  
**Jira story:** SCRUM-17  
**AC:** AC2  
**Priority:** High

**Preconditions:**
- Fresh Cypress session; no browser state required
- `tsconfig.json` exists at `qa-framework/frameworks/cypress/tsconfig.json`

**Steps:**
1. Use `cy.readFile('tsconfig.json')` to read the TypeScript config
2. Assert that `compilerOptions` property exists
3. Assert that `compilerOptions.target` equals `"es5"` (case-insensitive)
4. Assert that `compilerOptions.lib` is an array that includes `"es5"` and `"dom"`
5. Assert that `compilerOptions.types` is an array that includes `"cypress"` and `"node"`
6. Use `cy.log()` to mark each assertion group

**Expected Results:**
- `tsconfig.json` is readable and valid JSON
- `compilerOptions.target` === `"es5"` (or `"ES5"`)
- `compilerOptions.lib` includes `"es5"` and `"dom"`
- `compilerOptions.types` includes `"cypress"` and `"node"`

**Cypress Notes:**
- Use `cy.readFile('tsconfig.json')` — path resolved from project root
- Chain `.then((tsconfig) => { expect(tsconfig.compilerOptions).to.exist; ... })`
- Use `to.include` for array membership: `expect(tsconfig.compilerOptions.lib).to.include('es5')`
- Use `cy.log()` before each logical group: `cy.log('Checking compilerOptions.target')`

**Example assertion shape:**
```ts
cy.readFile('tsconfig.json').then((tsconfig) => {
  const opts = tsconfig.compilerOptions;
  cy.log('Checking compilerOptions.target');
  expect(opts.target.toLowerCase()).to.equal('es5');
  cy.log('Checking compilerOptions.lib');
  expect(opts.lib.map((v: string) => v.toLowerCase())).to.include.members(['es5', 'dom']);
  cy.log('Checking compilerOptions.types');
  expect(opts.types.map((v: string) => v.toLowerCase())).to.include.members(['cypress', 'node']);
});
```

---

### TC-SETUP-03 — Verify cypress.config.ts Sets baseUrl to SauceDemo

**Suggested file:** `saucedemo-cy-setup-03-cypress-config-baseurl.cy.ts`  
**Target folder:** `qa-framework/frameworks/cypress/tests/scrum-17/`  
**Jira story:** SCRUM-17  
**AC:** AC3 (file-check portion)  
**Priority:** High

**Preconditions:**
- Fresh Cypress session; no browser state required
- `cypress.config.ts` exists at `qa-framework/frameworks/cypress/cypress.config.ts`

**Steps:**
1. Use `cy.readFile('cypress.config.ts', 'utf8')` to read the config file as raw text (TypeScript cannot be JSON-parsed directly)
2. Assert that the file content includes the string `cypress.config.ts` — i.e., the file is a `.ts` file (naming verified by test file path resolution)
3. Assert that the string content includes `baseUrl` as a key
4. Assert that the string content includes `https://www.saucedemo.com` as the `baseUrl` value
5. Use `cy.log()` to mark assertion checkpoints

**Expected Results:**
- `cypress.config.ts` is readable as a text file
- File content contains the substring `baseUrl`
- File content contains the substring `https://www.saucedemo.com`
- File does NOT have a `.js` extension (verified by using the exact filename `cypress.config.ts`)

**Cypress Notes:**
- Use `cy.readFile('cypress.config.ts', 'utf8')` — the second argument forces string output
- Chain `.then((content: string) => { expect(content).to.include('baseUrl'); ... })`
- This test inherently verifies the file is named `.ts` (not `.js`) because `cy.readFile('cypress.config.ts')` would fail if only `.js` existed
- Use `cy.log('Checking baseUrl in cypress.config.ts')` before assertions

**Example assertion shape:**
```ts
cy.readFile('cypress.config.ts', 'utf8').then((content: string) => {
  cy.log('Checking cypress.config.ts contains baseUrl');
  expect(content).to.include('baseUrl');
  cy.log('Checking baseUrl points to saucedemo.com');
  expect(content).to.include('https://www.saucedemo.com');
});
```

---

### TC-SETUP-04 — Smoke Test: SauceDemo Login Page Loads at baseUrl

**Suggested file:** `saucedemo-cy-setup-04-saucedemo-login-page-loads.cy.ts`  
**Target folder:** `qa-framework/frameworks/cypress/tests/scrum-17/`  
**Jira story:** SCRUM-17  
**AC:** AC3 (smoke browser test portion)  
**Priority:** High

**Preconditions:**
- `baseUrl` is set to `https://www.saucedemo.com/` in `cypress.config.ts`
- Fresh Cypress session; no prior auth state

**Steps:**
1. Call `cy.safeVisit('/')` to navigate to the root URL (resolved via `baseUrl`)
2. Assert the page title is `"Swag Labs"`
3. Assert that `[data-test="username"]` is visible
4. Assert that `[data-test="password"]` is visible
5. Assert that `[data-test="login-button"]` is visible and enabled
6. Use `cy.log()` to mark major checkpoints

**Expected Results:**
- URL is `https://www.saucedemo.com/`
- Page `<title>` equals `"Swag Labs"`
- `[data-test="username"]` is visible on the page
- `[data-test="password"]` is visible on the page
- `[data-test="login-button"]` is visible and not disabled

**Cypress Notes:**
- Use `cy.safeVisit('/')` — never `cy.visit('/')` directly
- `cy.title()` assertion: `cy.title().should('eq', 'Swag Labs')`
- All selectors use `data-test` attributes (verified via browser exploration of https://www.saucedemo.com)
- No login required for this test — the login page is the unauthenticated root
- Use `cy.log('Navigating to SauceDemo root')` before `cy.safeVisit`

**Example assertion shape:**
```ts
cy.log('Navigating to SauceDemo root via baseUrl');
cy.safeVisit('/');
cy.log('Asserting page title');
cy.title().should('eq', 'Swag Labs');
cy.log('Asserting login form elements are visible');
cy.get('[data-test="username"]').should('be.visible');
cy.get('[data-test="password"]').should('be.visible');
cy.get('[data-test="login-button"]').should('be.visible').and('not.be.disabled');
```

---

### TC-SETUP-05 — Verify Default Cypress Folder Scaffold Exists

**Suggested file:** `saucedemo-cy-setup-05-cypress-folder-scaffold.cy.ts`  
**Target folder:** `qa-framework/frameworks/cypress/tests/scrum-17/`  
**Jira story:** SCRUM-17  
**AC:** AC5  
**Priority:** Medium

**Preconditions:**
- Fresh Cypress session; no browser state required
- Cypress task `fileExists` (or equivalent) must be registered in `cypress.config.ts` under `setupNodeEvents`
- The expected scaffold folders are: `cypress/e2e`, `cypress/fixtures`, `cypress/support`

**Steps:**
1. Use `cy.task('fileExists', 'cypress/e2e')` to assert the `cypress/e2e` directory exists
2. Use `cy.task('fileExists', 'cypress/fixtures')` to assert the `cypress/fixtures` directory exists
3. Use `cy.task('fileExists', 'cypress/support')` to assert the `cypress/support` directory exists
4. Each `cy.task()` call should yield `true`; assert `.should('eq', true)`
5. Use `cy.log()` before each task call

**Expected Results:**
- `cy.task('fileExists', 'cypress/e2e')` yields `true`
- `cy.task('fileExists', 'cypress/fixtures')` yields `true`
- `cy.task('fileExists', 'cypress/support')` yields `true`

**Cypress Notes:**
- `cy.task()` calls require a matching task registered in `setupNodeEvents` in `cypress.config.ts`. The generator must add the following to the config if not already present:
  ```ts
  on('task', {
    fileExists(filePath: string) {
      const fs = require('fs');
      const path = require('path');
      return fs.existsSync(path.resolve(__dirname, filePath));
    }
  });
  ```
- Paths are resolved relative to `__dirname` of `cypress.config.ts` (i.e., `qa-framework/frameworks/cypress/`)
- Do NOT use `cy.readFile()` for directory existence checks — it only works on files, not directories
- Use `cy.log('Checking cypress/e2e directory exists')` before each task call

**Example assertion shape:**
```ts
cy.log('Checking cypress/e2e folder');
cy.task('fileExists', 'cypress/e2e').should('eq', true);

cy.log('Checking cypress/fixtures folder');
cy.task('fileExists', 'cypress/fixtures').should('eq', true);

cy.log('Checking cypress/support folder');
cy.task('fileExists', 'cypress/support').should('eq', true);
```

---

### TC-SETUP-AC4 — NOTIMPLEMENTED: Verify npx cypress open Launches Without Errors

**Suggested file:** N/A — cannot be automated as a Cypress spec  
**Jira story:** SCRUM-17  
**AC:** AC4  
**Priority:** High (manual verification required)  
**Status:** NOTIMPLEMENTED

**Reason it cannot be automated:**

`npx cypress open` launches the Cypress Electron GUI / Test Runner application. This is a CLI and
desktop GUI process that:

1. Cannot be launched from inside a Cypress spec file (a spec runs *within* the Test Runner, creating a circular dependency)
2. Cannot be reliably tested via `cy.exec()` because `cypress open` starts an interactive GUI process that blocks and never exits on its own
3. TypeScript compilation errors surface in the Cypress UI or terminal output — not in a readable, assertable form from within a test

**Manual Verification Steps (for QA sign-off):**
1. Ensure the project is at `qa-framework/frameworks/cypress/`
2. Run: `cd qa-framework/frameworks/cypress && npx cypress open`
3. Verify that the Cypress Test Runner window opens without any TypeScript compilation errors displayed in the terminal or the runner UI
4. Verify that E2E test files are visible in the runner
5. Mark AC4 as verified in Jira SCRUM-17 after manual inspection

**Alternative semi-automation (out of scope for this story):**
A CI pipeline step can run `npx cypress run --config-file cypress.config.ts` headlessly — if it exits
with code 0, TypeScript compiled correctly. This would be captured in a GitHub Actions workflow rather
than a Cypress spec file. This is recommended for a future CI story.

---

## Summary Table

| Test Case | File | AC | Priority | Automatable |
|---|---|---|---|---|
| TC-SETUP-01 | `saucedemo-cy-setup-01-package-json-dependencies.cy.ts` | AC1 | High | ✅ Yes |
| TC-SETUP-02 | `saucedemo-cy-setup-02-tsconfig-compiler-options.cy.ts` | AC2 | High | ✅ Yes |
| TC-SETUP-03 | `saucedemo-cy-setup-03-cypress-config-baseurl.cy.ts` | AC3 (file) | High | ✅ Yes |
| TC-SETUP-04 | `saucedemo-cy-setup-04-saucedemo-login-page-loads.cy.ts` | AC3 (smoke) | High | ✅ Yes |
| TC-SETUP-05 | `saucedemo-cy-setup-05-cypress-folder-scaffold.cy.ts` | AC5 | Medium | ✅ Yes |
| TC-SETUP-AC4 | N/A | AC4 | High | ❌ NOTIMPLEMENTED |

All automatable test files go in: `qa-framework/frameworks/cypress/tests/scrum-17/`
