---
applyTo: "Playwright/**"
---

# Playwright Folder — Agent and MCP Routing

All work inside this folder uses the Playwright framework. Apply the rules below for every task.

## Mandatory Agent Routing

| Task | Agent | Command |
|------|-------|---------|
| Create a test plan | `@playwright-test-planner` | `@playwright-test-planner <story or URL>` |
| Generate a new test file | `@playwright-test-generator` | `@playwright-test-generator <test plan item>` |
| Fix a failing test | `@playwright-test-healer` | `@playwright-test-healer <error or file>` |

Never write, edit, or fix `.spec.ts` files directly in default agent mode. Always delegate.

## MCP Servers for This Folder

| Server | Role |
|--------|------|
| `playwright-test` | Live browser control, test runner, code writer — wired into each agent automatically |
| `github` | Branch and issue management |
| `atlassian` | Jira read/write |

The `playwright-test` MCP server is embedded in each agent's front matter — it activates automatically when the agent is invoked. No manual MCP setup needed per test run.

## New Project Setup Inside This Folder

When adding a third app (e.g. `Playwright/mynewapp/`):

1. Create `Playwright/mynewapp/mynewapp.playwright.config.ts` with:
   - `testDir: './tests'`
   - `baseURL` if the app requires one
   - A `setup` project + `storageState` if the app has a login wall
   - Browser projects with `dependencies: ['setup']` and `testIgnore: '**/seed.spec.ts'`

2. Add a job to `.github/workflows/playwright.yml` following the existing pattern:
   ```yaml
   test-mynewapp:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with: { node-version: lts/* }
       - run: npm ci
       - run: npx playwright install --with-deps
       - run: npx playwright test --config=Playwright/mynewapp/mynewapp.playwright.config.ts
       - uses: actions/upload-artifact@v4
         if: ${{ !cancelled() }}
         with:
           name: mynewapp-playwright-report
           path: Playwright/mynewapp/playwright-report/
           retention-days: 30
   ```

3. Add gitignore rules in `.gitignore`:
   ```
   /Playwright/mynewapp/playwright-report/
   /Playwright/mynewapp/test-results/
   /Playwright/mynewapp/.auth/
   ```

4. Use `@playwright-test-planner` to generate the test plan, then `@playwright-test-generator` per scenario.

## File Naming Convention

```
{app-prefix}-tc-{area}-{seq:02d}-{kebab-description}.spec.ts
```

Example: `mynewapp-tc-login-01-valid-credentials.spec.ts`

## Run Commands

```bash
npx playwright test --config=Playwright/{appname}/{appname}.playwright.config.ts
```
