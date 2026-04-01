# Folder Structure Guide

This document explains every folder and file in this repository: what decision or command created it, what settings
govern it, and why it is organised the way it is.

---

## Full Directory Tree (main branch)

```
E2E-AgenticWorkflow/
|
|-- .github/
|   |-- agents/
|   |   |-- playwright-test-generator.agent.md   # Custom VS Code agent — generates Playwright tests
|   |   |-- playwright-test-healer.agent.md      # Custom VS Code agent — heals failing tests
|   |   `-- playwright-test-planner.agent.md     # Custom VS Code agent — produces test plans
|   `-- workflows/
|       |-- copilot-setup-steps.yml              # Copilot coding agent pre-install hook
|       |-- jira-ready-for-qa.yml                # Jira -> GitHub Actions pipeline trigger
|       `-- playwright.yml                        # CI: run all Playwright tests on push / PR
|
|-- .vscode/
|   `-- mcp.json                                 # MCP server config (gitignored — contains tokens)
|
|-- OrangeHRM/
|   |-- .auth/
|   |   `-- admin.json                           # Saved browser session (gitignored — runtime only)
|   |-- tests/
|   |   |-- seed.spec.ts                         # Auth setup test — logs in and saves session
|   |   `-- orangehrm-e2e/                       # One subfolder per Jira story
|   |       `-- auth/                            # SCRUM-8 tests (on branch auto/test-scrum-8)
|   |           `-- tc-scrum-8-authentication.spec.ts
|   `-- orangehrm.playwright.config.ts           # Playwright config for the OrangeHRM app
|
|-- saucedemo/
|   |-- specs/
|   |   |-- README.md
|   |   `-- saucedemo-checkout-test-plan.md      # AI-generated test plan
|   |-- tests/
|   |   |-- example.spec.ts                      # Scaffold test (from npx create playwright)
|   |   |-- seed.spec.ts                         # Placeholder (SauceDemo has no auth setup)
|   |   `-- saucedemo-checkout/
|   |       |-- cart/
|   |       |   `-- saucedemo-tc-cart-01-item-details.spec.ts
|   |       |-- happy-path/
|   |       |   |-- saucedemo-tc-hp-01-single-item-checkout.spec.ts
|   |       |   |-- saucedemo-tc-hp-02-multi-item-checkout.spec.ts
|   |       |   `-- saucedemo-tc-hp-03-cancel-from-overview.spec.ts
|   |       |-- negative/
|   |       |   |-- saucedemo-tc-neg-01-all-fields-empty.spec.ts
|   |       |   |-- saucedemo-tc-neg-02-first-name-empty.spec.ts
|   |       |   |-- saucedemo-tc-neg-03-last-name-empty.spec.ts
|   |       |   |-- saucedemo-tc-neg-04-zip-empty.spec.ts
|   |       |   `-- saucedemo-tc-neg-05-dismiss-error.spec.ts
|   |       `-- overview/
|   |           `-- saucedemo-tc-ovw-01-overview-details.spec.ts
|   |-- user-stories/
|   |   `-- SCRUM-101-ecommerce-checkout.md      # Jira story exported for test planning
|   `-- saucedemo.playwright.config.ts           # Playwright config for the SauceDemo app
|
|-- .gitignore                                   # Rule file — keeps secrets and artifacts out of git
|-- package.json                                 # Root npm config — single node_modules for all apps
|-- SETUP-GUIDE.md                               # Full team onboarding guide
`-- FOLDER-STRUCTURE.md                          # This file
```

---

## Root Level

### `package.json` and `package-lock.json`

**Created by:**
```bash
npm init -y
npm install --save-dev @playwright/test @types/node
```

**Why at root:** A single `node_modules/` at the root means both `saucedemo/` and `OrangeHRM/` share
the same Playwright version. Each app has its own `playwright.config.ts` pointing to its own `testDir`,
so running tests is always app-scoped — but the dependency tree is deduplicated and consistent.

**Key entries in `package.json`:**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@types/node": "^22.x"
  }
}
```

---

## `.github/` — Automation and Agents

### `.github/workflows/playwright.yml` — CI Pipeline

**Created by:** VS Code command palette → _"Add CI workflow"_ (GitHub Actions scaffold), then manually
extended to run two parallel jobs.

**What it does:**

| Job | Config file | Trigger |
|-----|-------------|---------|
| `test-saucedemo` | `saucedemo/saucedemo.playwright.config.ts` | push / PR to `main` |
| `test-orangehrm` | `OrangeHRM/orangehrm.playwright.config.ts` | push / PR to `main` |

Both jobs upload their HTML reports as GitHub Actions artifacts (retained 30 days).

**To add a third app:** duplicate one job block, change the `--config` flag, add a matching
`upload-artifact` step.

---

### `.github/workflows/jira-ready-for-qa.yml` — Jira Pipeline

**Created by:** manually authored. Triggered by a Jira Automation rule that fires `repository_dispatch`
whenever a story transitions to _"Ready for QA"_.

**7-step sequence:**

```
1. Checkout code
2. Set up Node.js (lts/*)
3. npm ci + playwright install
4. Fetch Jira story (REST API v3, Basic auth)
5. git checkout -b auto/test-{issue-key}  (create feature branch)
6. Create GitHub Issue with story details  (gh CLI)
7. Assign Copilot to the issue             (gh CLI)
8. Transition Jira story to "In QA"        (REST API — transition ID 41)
9. Post comment on Jira issue              (REST API)
```

**Critical fixes applied during development:**

| # | Problem | Root Cause | Fix Applied |
|---|---------|-----------|-------------|
| 1 | Workflow not triggered | Non-ASCII dashes (`—`) in YAML `on:` block | Rewrote file via `python3` with `encoding='ascii'` |
| 2 | `--body` shell error | Multi-line string broke YAML indentation | `printf '...' > /tmp/body.md` + `--body-file` |
| 3 | 401 from Atlassian | Used `Bearer` token (wrong scheme) | Changed to `Basic base64(email:token)` |
| 4 | Corrupted auth header | Linux `base64` wraps at 76 chars | Added `-w 0` flag to suppress wrapping |
| 5 | `repository_dispatch` 422 | Fine-grained PAT cannot trigger `repository_dispatch` | Replaced with Classic PAT |
| 6 | `gh issue create` fails | Label `automated-qa` did not exist | Added `gh label create "automated-qa" ... || true` |

**Required GitHub Secrets:**

| Secret | Value |
|--------|-------|
| `ATLASSIAN_TOKEN` | Atlassian API token (from id.atlassian.com) |
| `GH_PAT` | Classic Personal Access Token (scopes: `repo`, `workflow`) |

---

### `.github/workflows/copilot-setup-steps.yml` — Copilot Agent Pre-Install

**Created by:** automatically generated by the Copilot coding agent feature when the repo is configured
for agent mode.

**What it does:** installs Node.js dependencies before the coding agent runs so it operates in a fully
prepared environment.

---

### `.github/agents/` — Custom VS Code Agents

**Created by:** manual authoring in VS Code. Files placed in `.github/agents/` are automatically
discovered by VS Code Copilot as custom agents.

Each file uses YAML front matter that declares:

```yaml
---
name: <agent-name>             # @-mention name in Copilot Chat
description: '...'             # Shown in agent picker
tools:                         # Which tools this agent can call
  - search
  - playwright-test/browser_*
model: Claude Sonnet 4.6       # LLM to use
mcp-servers:                   # Inline MCP server config for the agent
  playwright-test:
    type: stdio
    command: npx
    args: [playwright, run-test-mcp-server]
---
System prompt text goes here...
```

| Agent file | @-mention | Purpose |
|-----------|-----------|---------|
| `playwright-test-generator.agent.md` | `@playwright-test-generator` | Navigates the browser live, records steps, calls `generator_write_test` to produce a `.spec.ts` file |
| `playwright-test-healer.agent.md` | `@playwright-test-healer` | Reads failing test output, re-runs tests with live browser, fixes selectors and assertions |
| `playwright-test-planner.agent.md` | `@playwright-test-planner` | Reads a Jira user story, produces a Markdown test plan with AC-numbered scenarios |

**To create a new custom agent:**
1. Create `{name}.agent.md` in `.github/agents/`
2. Add YAML front matter with `name`, `description`, `tools`, `model`, and optionally `mcp-servers`
3. Write the system prompt below the closing `---`
4. Reload VS Code — agent is immediately available via `@{name}` in Copilot Chat

---

## `.vscode/mcp.json` — MCP Server Configuration

**Created by:** VS Code command palette → _"MCP: Add Server"_ (for each server), then manually edited.

**Gitignored** because it contains personal access tokens.

**The 4 MCP servers configured:**

| Server key | Type | Command / URL | Auth | Purpose |
|-----------|------|--------------|------|---------|
| `playwright` | stdio | `npx @playwright/mcp@latest` | none | Live browser control (navigate, click, snapshot, fill) |
| `playwright-test` | stdio | `npx playwright run-test-mcp-server` | none | Test runner control (run tests, read logs, write test code) |
| `github` | http | `https://api.githubcopilot.com/mcp/` | Bearer — Classic PAT | GitHub API (issues, PRs, branches, files) |
| `atlassian` | http | `https://mcp.atlassian.com/v1/mcp` | Bearer — raw Atlassian token | Jira + Confluence (read/write issues, transitions, comments) |

**Auth notes:**
- `github` server requires a **Classic PAT** (not fine-grained) with scopes `repo` and `workflow`.
- `atlassian` server uses the raw Atlassian API token (the value from `id.atlassian.com`) directly as a
  Bearer token — do NOT base64-encode it here (that encoding is only for the REST API direct calls inside
  the GitHub Actions workflow).

**Template (replace tokens):**
```json
{
  "servers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "playwright-test": {
      "type": "stdio",
      "command": "npx",
      "args": ["playwright", "run-test-mcp-server"]
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer <CLASSIC_PAT>" }
    },
    "atlassian": {
      "type": "http",
      "url": "https://mcp.atlassian.com/v1/mcp",
      "headers": { "Authorization": "Bearer <ATLASSIAN_API_TOKEN>" }
    }
  }
}
```

---

## `saucedemo/` — First App Under Test

**Created by:**
```bash
mkdir -p saucedemo
cd saucedemo
npx create playwright@latest .   # scaffolds tests/, example.spec.ts, playwright.config.ts
```

**Why a subdirectory:** each app-under-test lives in its own folder so configs, reports, and auth state
never collide. The root `package.json` still provides shared dependencies.

---

### `saucedemo/saucedemo.playwright.config.ts`

Renamed from the default `playwright.config.ts` so the root CI workflow can reference it unambiguously
with `--config=saucedemo/saucedemo.playwright.config.ts`.

**Key settings:**

| Setting | Value | Why |
|---------|-------|-----|
| `testDir` | `./tests` | Scoped to the `saucedemo/tests/` folder |
| `fullyParallel` | `true` | Tests have no shared state — run as fast as possible |
| `workers` | CI: `1`, local: `undefined` | SauceDemo rate-limits on rapid parallel logins |
| `baseURL` | (commented out) | Tests use the full SauceDemo URL directly |
| `reporter` | `html` | HTML report written to `saucedemo/playwright-report/` |
| `projects` | chromium, firefox, webkit | Cross-browser coverage |
| No `setup` project | — | SauceDemo standard_user credentials don't need session persistence |

---

### `saucedemo/tests/saucedemo-checkout/` — Test File Naming Convention

Files follow the pattern:
```
{app-prefix}-tc-{area}-{seq:02d}-{kebab-description}.spec.ts
```

Examples:
- `saucedemo-tc-hp-01-single-item-checkout.spec.ts` (happy path, test 1)
- `saucedemo-tc-neg-03-last-name-empty.spec.ts` (negative, test 3)
- `saucedemo-tc-cart-01-item-details.spec.ts` (cart, test 1)
- `saucedemo-tc-ovw-01-overview-details.spec.ts` (overview, test 1)

The prefix `saucedemo-` is essential when running all tests from the root (without `--config`)
so reporters can identify which app each test belongs to.

**Subfolders map to test areas from the test plan:**

| Folder | Area |
|--------|------|
| `happy-path/` | Full checkout flows that succeed |
| `negative/` | Validation error scenarios |
| `cart/` | Cart page assertions |
| `overview/` | Order summary page assertions |

---

### `saucedemo/specs/`

**Created by:** manual `mkdir`. Stores two Markdown documents:

| File | Purpose |
|------|---------|
| `README.md` | Quick start for running saucedemo tests |
| `saucedemo-checkout-test-plan.md` | AI-generated test plan (output of `@playwright-test-planner`) |

---

### `saucedemo/user-stories/`

**Created by:** manually populated when copying the Jira story content. Contains
`SCRUM-101-ecommerce-checkout.md` — the raw user story text fed to the planner agent to generate the
test plan.

---

## `OrangeHRM/` — Second App Under Test

**Created by:**
```bash
mkdir -p OrangeHRM/tests
cd OrangeHRM
# Config and seed.spec.ts authored manually (not via create playwright scaffold)
```

OrangeHRM is a real-world HR application behind a login wall — this drives several differences from
the SauceDemo setup.

---

### `OrangeHRM/orangehrm.playwright.config.ts`

**Key differences versus `saucedemo.playwright.config.ts`:**

| Setting | SauceDemo value | OrangeHRM value | Reason for change |
|---------|----------------|----------------|-------------------|
| `baseURL` | commented out | `https://opensource-demo.orangehrmlive.com` | All navigations use `page.goto('/')` relative paths |
| `reporter` | `'html'` (string) | `[['html', {...}], ['list']]` (array) | Needs both HTML report and live console output |
| `screenshot` | not set | `'only-on-failure'` | Capture evidence when tests fail behind auth |
| `workers` | `undefined` locally | `2` locally | OrangeHRM rate-limits > 2 concurrent sessions; `undefined` saturates connections |
| `setup` project | absent | present (`testMatch: '**/seed.spec.ts'`) | Login must complete before any test runs |
| `storageState` on browser projects | absent | `AUTH_FILE` | Reuse saved session — avoid re-logging in for every test |
| `testIgnore` on browser projects | absent | `'**/seed.spec.ts'` | Prevents seed from re-running under each browser project |
| `dependencies` on browser projects | absent | `['setup']` | Enforces: setup runs first, tests run after |

`AUTH_FILE` is resolved at config-load time:
```typescript
const AUTH_FILE = path.resolve(__dirname, '.auth/admin.json');
// -> OrangeHRM/.auth/admin.json
```

---

### `OrangeHRM/tests/seed.spec.ts` — Auth Setup

**Purpose:** logs in as the admin user once, then persists the browser session (cookies + localStorage)
to `OrangeHRM/.auth/admin.json`. All subsequent test files load this state via `storageState` — they
start already authenticated.

**How the config wires it:**

```
playwright.config.ts
  projects[0] = setup          <-- testMatch: '**/seed.spec.ts'  (seed runs here)
  projects[1] = chromium       <-- testIgnore: '**/seed.spec.ts', storageState: AUTH_FILE, dependencies: ['setup']
  projects[2] = firefox        <-- same
  projects[3] = webkit         <-- same
```

**To reset the session** (e.g. after password change):
```bash
rm -rf OrangeHRM/.auth/admin.json
npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts
```
The `setup` project will re-run automatically because `admin.json` no longer exists.

**Env var fallback in seed.spec.ts:**
```typescript
const USERNAME = process.env.ORANGEHRM_USER ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASS ?? 'admin123';
```
On CI the vars are set via GitHub Secrets; locally the hardcoded defaults are used.

---

### `OrangeHRM/tests/orangehrm-e2e/` — Story-Scoped Test Subfolders

One subfolder per Jira story. Created automatically when the `jira-ready-for-qa.yml` pipeline triggers
(the pipeline creates the branch; the test generator agent creates the subfolder and test file).

| Subfolder | Jira Story | Status |
|-----------|-----------|--------|
| `auth/` | SCRUM-8 Authentication | Tests on branch `auto/test-scrum-8` |
| `pim/` (planned) | SCRUM-9 Employee Lifecycle | GitHub Issue #2 created; tests not yet generated |
| `leave/` (planned) | SCRUM-10 Leave Management | Pending |
| `time/` (planned) | SCRUM-11 Time & Attendance | Pending |
| `reports/` (planned) | SCRUM-12 Reports | Pending |

---

### `OrangeHRM/.auth/` — Saved Session Storage

**Created by:** `seed.spec.ts` at runtime via Playwright's `page.context().storageState({ path: AUTH_FILE })`.

**Gitignored** — session tokens are ephemeral secrets; committing them would be a security risk and they
expire anyway.

**Entry in `.gitignore`:**
```
/OrangeHRM/.auth/
```

---

## `.gitignore` — Rule-by-Rule Explanation

```gitignore
# Playwright
node_modules/              <- npm install artifacts; never commit

# SauceDemo artifacts
/test-results/             <- root-level test-results (legacy scaffold location)
!/test-results/*.md        <- EXCEPT markdown reports (hand-written QA reports stay)
/playwright-report/        <- root-level HTML report
/blob-report/
/playwright/.cache/
/playwright/.auth/

# SauceDemo app artifacts
/saucedemo/test-results/   <- test run artifacts for saucedemo
!/saucedemo/test-results/*.md   <- keep markdown QA reports
/saucedemo/playwright-report/
/saucedemo/.auth/

# OrangeHRM artifacts
/OrangeHRM/playwright-report/
/OrangeHRM/test-results/
!/OrangeHRM/test-results/*.md
/OrangeHRM/.auth/          <- session file — never commit tokens

# Secrets
.vscode/mcp.json           <- contains PATs and API tokens for MCP servers
```

The `!` (negation) rules ensure hand-authored Markdown QA reports (like `SCRUM-101-checkout-test-report.md`)
survive even though their containing `test-results/` folders are otherwise ignored.

---

## Decision Summary

| Decision | What was done | Why |
|----------|--------------|-----|
| Single root `package.json` | One `npm install` for all apps | Shared Playwright version; simpler CI |
| Per-app `playwright.config.ts` | Each app has its own config | Independent `testDir`, `baseURL`, `reporter`, and project settings |
| Config files renamed with app prefix | `saucedemo.playwright.config.ts` | `--config` flag in CI can reference each file unambiguously |
| `setup` project only in OrangeHRM | Session persistence not needed for SauceDemo | Standard user creds do not expire; no rate-limit risk |
| `workers: 2` in OrangeHRM locally | Replaced `undefined` (all cores) | OrangeHRM backend 429s when more than 2 parallel sessions hit it |
| `test.describe.serial()` in SCRUM-8 tests | Ordered execution for session-dependent tests | AC-7 (verify session) must run before AC-6 (logout); parallel would poison state |
| Story-scoped subfolders in `orangehrm-e2e/` | One folder per Jira story | Mirrors Jira epic structure; makes it easy to find tests by story key |
| Agents in `.github/agents/` | Three custom VS Code agents | Declarative agent config — no extension needed; committed to repo so all team members get agents |
| Classic PAT for GitHub Actions | Used instead of fine-grained PAT | Fine-grained PATs cannot trigger `repository_dispatch` events |
| `Basic` auth for Atlassian REST API | `base64(email:token)` in Authorization header | Atlassian Cloud REST API v3 requires Basic auth; Bearer is only for the MCP server |
| `.vscode/mcp.json` gitignored | Added to `.gitignore` | File contains live API tokens; team members create their own local copies |
