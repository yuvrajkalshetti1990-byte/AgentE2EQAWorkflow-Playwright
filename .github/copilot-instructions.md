# E2E Agentic Workflow — Copilot Instructions

This project uses a structured agentic QA pipeline. All test-related work MUST go through the
designated agents and MCP servers below. Do NOT generate, edit, or fix test files directly —
always delegate to the correct agent.

---

## Agent Routing — MANDATORY

| Task | Framework | Agent to use | How to invoke |
|------|-----------|-------------|---------------|
| Review ACs for automation feasibility | Any | `@ac-reviewer` | `@ac-reviewer <Jira issue key or paste ACs>` |
| Create a test plan from a Jira story or URL | Playwright | `@playwright-test-planner` | `@playwright-test-planner <story details or URL>` |
| Create a test plan from a Jira story or URL | Cypress | `@cypress-test-planner` | `@cypress-test-planner <story details or URL>` |
| Generate a new Playwright `.spec.ts` test file | Playwright | `@playwright-test-generator` | `@playwright-test-generator <test plan item>` |
| Fix a failing or broken Playwright test | Playwright | `@playwright-test-healer` | `@playwright-test-healer <error or test file>` |
| Generate a new Cypress `.cy.ts` test file | Cypress | `@cypress-test-generator` | `@cypress-test-generator <test plan item>` |
| Fix a failing or broken Cypress test | Cypress | `@cypress-test-healer` | `@cypress-test-healer <error or test file>` |

If a user asks to "write a test", "create a test", "fix a test", "generate automation", or
"run tests" — respond by telling them which agent to use and how to invoke it. Do not attempt
to do the work yourself in default agent mode.

---

## MCP Servers in Use

| Server | Purpose | Used by |
|--------|---------|---------|
| `playwright-test` | Live browser control + test runner | Playwright agents (wired via agent front matter) |
| `playwright` | Standalone browser sessions | `@cypress-test-planner` + `@cypress-test-generator` (exploration only) + general use |
| `github` | Branch creation, issue management, file operations | `jira-ready-for-qa.yml` pipeline + manual tasks |
| `atlassian` | Read/write Jira issues, transitions, comments | `jira-ready-for-qa.yml` pipeline + `@ac-reviewer` |

The `playwright-test` MCP server is embedded directly in each agent's front matter — it is
available automatically when the agent is active. You do not need to manually invoke MCP tools
for test generation or healing; the agent handles that.

---

## Project Structure

- `qa-framework/frameworks/playwright/` — SauceDemo Playwright tests. Config: `qa-framework/frameworks/playwright/playwright.config.ts`
- `qa-framework/frameworks/playwright/tests/` — One subfolder per Jira story
- `qa-framework/frameworks/cypress/` — Cypress tests. Config: `qa-framework/frameworks/cypress/cypress.config.ts`
- `qa-framework/frameworks/cypress/tests/{story-slug}/` — One folder per Jira story
- `.github/agents/` — Custom agent definitions
- `.vscode/mcp.json` — MCP server config (gitignored)

## Test File Naming Convention

**Playwright:**
```
{app-prefix}-tc-{area}-{seq:02d}-{kebab-description}.spec.ts
```
Example: `saucedemo-tc-hp-01-single-item-checkout.spec.ts`

**Cypress:**
```
{app-prefix}-cy-{area}-{seq:02d}-{kebab-description}.cy.ts
```
Example: `saucedemo-cy-hp-01-single-item-checkout.cy.ts`

## Running Tests

```bash
# SauceDemo Playwright
npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts

# Cypress (interactive)
npx cypress open --config-file qa-framework/frameworks/cypress/cypress.config.ts

# Cypress (headless)
npx cypress run --config-file qa-framework/frameworks/cypress/cypress.config.ts
```

## Branch Strategy

- `main` — clean, production-only. Never commit docs or test drafts here.
- `dev` — all active development. All commits go here.
- `auto/test-{issue-key}` — auto-created by `jira-ready-for-qa.yml` per Jira story.
