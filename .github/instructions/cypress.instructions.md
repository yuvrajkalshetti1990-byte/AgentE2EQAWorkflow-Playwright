---
applyTo: "Cypress/**"
---

# Cypress Folder — Agent and MCP Routing

All work inside this folder uses the Cypress framework. Apply the rules below for every task.

## Mandatory Agent Routing

| Task | Agent | Command |
|------|-------|---------|
| Create a test plan | `@playwright-test-planner` | `@playwright-test-planner <story or URL>` |
| Generate a new `.cy.ts` test file | `@cypress-test-generator` | `@cypress-test-generator <test plan item>` |
| Fix a failing test | Manual — inspect UI with `@cypress-test-generator` | No dedicated healer for Cypress |

Never write or edit `.cy.ts` files directly in default agent mode. Always delegate to `@cypress-test-generator`.

## MCP Servers for This Folder

| Server | Role |
|--------|------|
| `playwright` | Live browser exploration only — used by `@cypress-test-generator` to inspect the UI and identify selectors. Does NOT run Cypress tests. |
| `github` | Branch and issue management |
| `atlassian` | Jira read/write |

There is no MCP-based Cypress test runner. Tests must be run manually via CLI or Cypress Test Runner.

## New Project Setup Inside This Folder

When adding tests for a new app to Cypress:

1. Add a subfolder under `Cypress/cypress/e2e/{story-slug}/`

2. Spec naming convention:
   ```
   {app-prefix}-cy-{area}-{seq:02d}-{kebab-description}.cy.ts
   ```
   Example: `mynewapp-cy-login-01-valid-credentials.cy.ts`

3. If the app requires login, set up session caching in `Cypress/cypress/support/commands.ts`:
   ```typescript
   Cypress.Commands.add('loginAs', (username, password) => {
     cy.session([username, password], () => {
       cy.visit('/login');
       cy.get('[data-cy="username"]').type(username);
       cy.get('[data-cy="password"]').type(password);
       cy.get('[data-cy="submit"]').click();
     });
   });
   ```

4. Add any shared fixtures to `Cypress/cypress/fixtures/`

5. Use `@playwright-test-planner` to generate the test plan, then `@cypress-test-generator` per scenario.

## Run Commands

```bash
# Interactive (Cypress Test Runner)
npx cypress open --config-file Cypress/cypress.config.ts

# Headless CI run
npx cypress run --config-file Cypress/cypress.config.ts

# Single spec
npx cypress run --config-file Cypress/cypress.config.ts --spec "Cypress/cypress/e2e/{folder}/*.cy.ts"
```
