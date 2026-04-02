# E2E Agentic Workflow — Copilot Instructions

This project uses a structured agentic QA pipeline. All test-related work MUST go through the
designated agents and MCP servers below. Do NOT generate, edit, or fix test files directly —
always delegate to the correct agent.

---

## Agent Routing — MANDATORY

| Task | Agent to use | How to invoke |
|------|-------------|---------------|
| Create a test plan from a Jira story or URL | `@playwright-test-planner` | `@playwright-test-planner <story details or URL>` |
| Generate a new `.spec.ts` test file | `@playwright-test-generator` | `@playwright-test-generator <test plan item>` |
| Fix a failing or broken test | `@playwright-test-healer` | `@playwright-test-healer <error or test file>` |

If a user asks to "write a test", "create a test", "fix a test", "generate automation", or
"run tests" — respond by telling them which agent to use and how to invoke it. Do not attempt
to do the work yourself in default agent mode.

---

## MCP Servers in Use

| Server | Purpose | Used by |
|--------|---------|---------|
| `playwright-test` | Live browser control + test runner | All 3 agents (wired via agent front matter) |
| `playwright` | Standalone browser sessions | General exploration |
| `github` | Branch creation, issue management, file operations | `jira-ready-for-qa.yml` pipeline + manual tasks |
| `atlassian` | Read/write Jira issues, transitions, comments | `jira-ready-for-qa.yml` pipeline + manual tasks |

The `playwright-test` MCP server is embedded directly in each agent's front matter — it is
available automatically when the agent is active. You do not need to manually invoke MCP tools
for test generation or healing; the agent handles that.

---

## Project Structure

- `saucedemo/` — SauceDemo app tests. Config: `saucedemo/saucedemo.playwright.config.ts`
- `OrangeHRM/` — OrangeHRM app tests. Config: `OrangeHRM/orangehrm.playwright.config.ts`
- `OrangeHRM/tests/seed.spec.ts` — Auth setup (runs first, saves session to `.auth/admin.json`)
- `OrangeHRM/tests/orangehrm-e2e/{story-slug}/` — One folder per Jira story
- `.github/agents/` — Custom agent definitions
- `.vscode/mcp.json` — MCP server config (gitignored)

## Test File Naming Convention

```
{app-prefix}-tc-{area}-{seq:02d}-{kebab-description}.spec.ts
```

Example: `saucedemo-tc-hp-01-single-item-checkout.spec.ts`

## Running Tests

```bash
# SauceDemo only
npx playwright test --config=saucedemo/saucedemo.playwright.config.ts

# OrangeHRM only
npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts

# All apps
npx playwright test --config=saucedemo/saucedemo.playwright.config.ts && \
npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts
```

## Branch Strategy

- `main` — clean, production-only. Never commit docs or test drafts here.
- `dev` — all active development. All commits go here.
- `auto/test-{issue-key}` — auto-created by `jira-ready-for-qa.yml` per Jira story.
