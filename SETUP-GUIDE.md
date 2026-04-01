# Agentic E2E QA Workflow — Complete Setup Guide

This guide documents how the project was built from scratch so any team member
can replicate the full setup, understand each component, and onboard a new
application into the pipeline.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Repository Structure](#4-repository-structure)
5. [Step 1 — Clone and Install](#5-step-1--clone-and-install)
6. [Step 2 — GitHub Repository Settings](#6-step-2--github-repository-settings)
7. [Step 3 — GitHub Secrets](#7-step-3--github-secrets)
8. [Step 4 — Jira Project Setup](#8-step-4--jira-project-setup)
9. [Step 5 — Jira Automation Rule](#9-step-5--jira-automation-rule)
10. [Step 6 — MCP Servers (VS Code)](#10-step-6--mcp-servers-vs-code)
11. [Running Tests Locally](#11-running-tests-locally)
12. [Adding a New Application](#12-adding-a-new-application)
13. [How the Heal Cycle Works](#13-how-the-heal-cycle-works)
14. [Known Limitations](#14-known-limitations)
15. [Quick Reference — Key Values](#15-quick-reference--key-values)

---

## 1. What This Project Does

This is an AI-driven end-to-end QA automation framework that connects Jira,
GitHub, and VS Code Copilot into a single pipeline:

```
Jira story moves to "Ready for QA"
        |
        v
GitHub Actions workflow fires (repository_dispatch)
        |
        v
Feature branch auto-created  (auto/test-{story-id})
GitHub Issue auto-created    (full test spec in body)
Jira story auto-transitioned (-> "In QA")
        |
        v
QA engineer / Copilot coding agent writes Playwright tests
        |
        v
Tests run in CI on push/PR (Chromium + Firefox + WebKit)
```

**Applications covered:**
| App | URL | Tests |
|-----|-----|-------|
| SauceDemo | https://www.saucedemo.com | 13 tests, checkout flow |
| OrangeHRM | https://opensource-demo.orangehrmlive.com | Auth + more |

---

## 2. Architecture Overview

```
.
├── .github/
│   └── workflows/
│       ├── playwright.yml              # CI: runs tests on push/PR
│       └── jira-ready-for-qa.yml      # Pipeline: Jira -> GitHub -> Jira
├── saucedemo/
│   ├── saucedemo.playwright.config.ts
│   └── tests/
│       └── saucedemo-checkout/        # 13 spec files
├── OrangeHRM/
│   ├── orangehrm.playwright.config.ts
│   └── tests/
│       ├── seed.spec.ts               # Auth setup (saves session)
│       └── orangehrm-e2e/
│           └── auth/                  # SCRUM-8 tests
│               └── tc-scrum-8-authentication.spec.ts
└── package.json
```

**Key design decisions:**
- Each app has its own `playwright.config.ts` — configs are fully independent
- OrangeHRM uses a `setup` project (`seed.spec.ts`) that logs in once and saves
  session state to `OrangeHRM/.auth/admin.json` — all other tests reuse it
- Test files use the naming convention `tc-{story-id}-{description}.spec.ts`

---

## 3. Prerequisites

Install the following before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 LTS or higher | https://nodejs.org |
| Git | any | https://git-scm.com |
| VS Code | latest | https://code.visualstudio.com |
| GitHub Copilot extension | latest | VS Code marketplace |

You also need accounts on:
- **GitHub** — to host the repo
- **Jira (Atlassian Cloud)** — free tier works: https://www.atlassian.com/software/jira
- **Atlassian API token** — https://id.atlassian.com/manage-profile/security/api-tokens
- **GitHub Classic PAT** (Personal Access Token) with `repo` + `workflow` scopes
  — https://github.com/settings/tokens (use Classic, not Fine-grained)

---

## 4. Repository Structure

```
E2E-AgenticWorkflow/
├── .github/
│   └── workflows/
│       ├── playwright.yml             # Runs on push to main
│       └── jira-ready-for-qa.yml     # Runs on Jira webhook
├── .gitignore
├── .vscode/
│   └── mcp.json                      # MCP server config (DO NOT COMMIT)
├── OrangeHRM/
│   ├── .auth/                        # Saved session state (gitignored)
│   ├── orangehrm.playwright.config.ts
│   └── tests/
│       ├── seed.spec.ts
│       └── orangehrm-e2e/
│           └── auth/
│               └── tc-scrum-8-authentication.spec.ts
├── saucedemo/
│   ├── saucedemo.playwright.config.ts
│   ├── specs/                        # Test plan docs
│   ├── user-stories/                 # Jira story markdowns
│   └── tests/
│       └── saucedemo-checkout/
│           ├── cart/
│           ├── happy-path/
│           ├── negative/
│           └── overview/
└── package.json
```

---

## 5. Step 1 — Clone and Install

```bash
git clone https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright.git
cd AgentE2EQAWorkflow-Playwright
npm install
npx playwright install --with-deps
```

---

## 6. Step 2 — GitHub Repository Settings

Before adding secrets, configure the following settings on your GitHub repo.

### 6.1 Enable GitHub Actions

1. Go to your repo → **Settings** → **Actions** → **General**
2. Under **Actions permissions** select **Allow all actions and reusable workflows**
3. Under **Workflow permissions** select **Read and write permissions**
4. Check **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

> Without read/write permissions the `jira-ready-for-qa.yml` workflow cannot
> create branches, issues, or write back to the repo.

### 6.2 Create the `automated-qa` issue label

The pipeline creates GitHub issues tagged with this label.

1. Go to your repo → **Issues** → **Labels** → **New label**
2. Name: `automated-qa`
3. Color: `#0075ca`
4. Description: `Automated QA test generation`
5. Click **Create label**

> The workflow also auto-creates this label via `gh label create ... || true`
> so this step is optional but useful for filtering issues.

### 6.3 Create a Classic Personal Access Token (PAT)

This token is used in TWO places: the Jira automation rule AND `.vscode/mcp.json`.

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Name: `AgentE2EQAWorkflow`
4. Expiration: 90 days (or No expiration for demo use)
5. Select scopes:
   - `repo` (full control of private repositories)
   - `workflow` (update GitHub Actions workflows)
   - `admin:repo_hook` (for webhook creation if needed)
6. Click **Generate token** and **copy it immediately** — you cannot see it again

> **Critical:** Use a **Classic PAT**, not a Fine-grained PAT.
> Fine-grained PATs cannot trigger `repository_dispatch` events.
> This was a real blocker we hit — the Jira webhook would return 204 but
> GitHub Actions would never fire.

---

## 7. Step 3 — GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
→ **New repository secret**.

Add these three secrets:

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `ATLASSIAN_TOKEN` | Your Atlassian API token | `jira-ready-for-qa.yml` |
| `ORANGEHRM_USERNAME` | `Admin` | `playwright.yml` CI |
| `ORANGEHRM_PASSWORD` | `admin123` | `playwright.yml` CI |

> **Note:** The Atlassian token is the raw token from
> https://id.atlassian.com/manage-profile/security/api-tokens
> The workflow computes `base64(email:token)` internally — do NOT pre-encode it.

---

## 8. Step 4 — Jira Project Setup

### 8.1 Create a Jira project

1. Go to https://your-domain.atlassian.net
2. Create a **Scrum** project — key `SCRUM`
3. Add custom statuses: `Ready for QA`, `In QA` (under Project Settings → Statuses)

### 8.2 Add custom workflow statuses

1. Go to **Project Settings** → **Workflows** → click the active workflow → **Edit**
2. Add two new statuses:
   - Status name: `Ready for QA` — Category: **In Progress**
   - Status name: `In QA` — Category: **In Progress**
3. Draw transitions to/from these statuses (e.g. `In Progress` → `Ready for QA` → `In QA` → `Done`)
4. **Publish** the workflow

> The exact transition IDs are needed for the GitHub Actions workflow.
> Get them with this command after creating your statuses:

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'your-email@example.com:YOUR_ATLASSIAN_TOKEN' | base64)" \
  -H "Accept: application/json" \
  "https://api.atlassian.com/ex/jira/YOUR_CLOUD_ID/rest/api/3/issue/SCRUM-1/transitions" \
  | python3 -m json.tool
```

Look for the `id` field next to `"name": "In QA"` — update this value in
`.github/workflows/jira-ready-for-qa.yml` under `"transition": {"id": "41"}`.

### 8.3 Create user stories

Stories should follow this template (this is what powers test generation):

```
Summary: E2E Automation: <Feature> — <Brief description>

Description:
## Description
As a QA Automation Engineer, I need...

## Acceptance Criteria
* [AC-1] GIVEN ... WHEN ... THEN ...
* [AC-2] ...

## Automation Scope
- UI: Assert ...
- Security: ...

## Test Data Strategy
Static/dynamic data approach...
```

### 8.4 Get your Jira Cloud ID

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'your-email@example.com:YOUR_ATLASSIAN_TOKEN' | base64)" \
  "https://api.atlassian.com/oauth/token/accessible-resources" \
  | python3 -m json.tool
```

Copy the `id` field — this is your `ATLASSIAN_CLOUD_ID`.

---

## 9. Step 5 — Jira Automation Rule

This is the bridge that fires GitHub when a story moves to "Ready for QA".

### 9.1 Create the rule

1. Go to your Jira project → **Project Settings** → **Automation**
2. Click **Create rule**
3. Configure as follows:

**Trigger:** Issue transitioned
- From status: (any)
- To status: **Ready for QA**

**Action:** Send web request
- URL: `https://api.github.com/repos/YOUR-GITHUB-USERNAME/YOUR-REPO/dispatches`
- Method: `POST`
- Headers:
  ```
  Authorization: Bearer YOUR_GITHUB_CLASSIC_PAT
  Content-Type: application/json
  Accept: application/vnd.github.v3+json
  ```
- Body (JSON):
  ```json
  {
    "event_type": "jira-ready-for-qa",
    "client_payload": {
      "issue_key": "{{issue.key}}"
    }
  }
  ```

4. Name the rule: **Trigger GitHub Workflow on Ready for QA Transition**
5. Enable the rule

> **Critical:** Use a **Classic** GitHub PAT, not fine-grained.
> Fine-grained PATs cannot trigger `repository_dispatch`.

### 9.2 Verify the rule fired

1. Move any story to **Ready for QA** in Jira
2. Go to **Project Settings** → **Automation** → **Audit log**
3. You should see your rule with status **SUCCESS** and sub-steps:
   - `Work item transitioned` — confirms the trigger fired
   - `Send web request` → **Successfully published web request**
4. On GitHub, go to your repo → **Actions** tab
5. You should see a new run triggered by `repository_dispatch`

> If the audit log shows SUCCESS but GitHub Actions does not fire:
> - The PAT is likely a Fine-grained token — replace with Classic
> - Check the PAT has `repo` + `workflow` scopes (verify at
>   `https://api.github.com/user` with the token)

---

## 10. Step 6 — MCP Servers (VS Code)

MCP (Model Context Protocol) servers extend GitHub Copilot in VS Code with
real tools — letting it browse live web pages, run Playwright tests, query
Jira tickets, and manage GitHub issues directly from the chat window.

### 10.1 What each MCP server does

| Server | Package | What it enables in Copilot |
|--------|---------|---------------------------|
| `github` | GitHub's hosted MCP | Create/read issues, branches, PRs, trigger workflows, search code |
| `playwright` | `@playwright/mcp` | Launch a real browser, click, type, take screenshots, inspect the DOM |
| `playwright-test` | `@playwright/mcp --test` | Run existing `.spec.ts` files, read test results, heal failing tests |
| `atlassian` | Atlassian's hosted MCP | Read/update Jira issues, transition statuses, add comments |

### 10.2 Create `.vscode/mcp.json`

> **IMPORTANT:** This file contains secrets. It is in `.gitignore` — never commit it.
> Create it manually on each machine.

Create the file at `.vscode/mcp.json` in the repo root:

```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_GITHUB_CLASSIC_PAT"
      }
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "playwright-test": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--test"]
    },
    "atlassian": {
      "type": "http",
      "url": "https://mcp.atlassian.com/v1/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ATLASSIAN_TOKEN"
      }
    }
  }
}
```

Replace:
- `YOUR_GITHUB_CLASSIC_PAT` — the Classic PAT created in Step 6.3
- `YOUR_ATLASSIAN_TOKEN` — the raw Atlassian API token (NOT base64 encoded,
  NOT prefixed with email — the MCP server handles auth internally)

### 10.3 Start/reload MCP servers

1. Open VS Code in the repo folder
2. Press `Cmd+Shift+P` → type **MCP: List Servers** — you should see all 4 listed
3. If servers show as stopped: `Cmd+Shift+P` → **MCP: Restart All Servers**
4. A green dot next to each server name means it is running

> On first run, `@playwright/mcp@latest` will be downloaded via `npx` — this
> takes ~30 seconds. Subsequent starts are instant.

### 10.4 Verify each server works

Open Copilot Chat (`Cmd+Shift+I`) and try these:

**GitHub MCP:**
```
List the open issues in my repo yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright
```
Expected: returns a list of GitHub issues including the automated-qa ones.

**Playwright MCP:**
```
Open https://www.saucedemo.com in a browser and tell me what you see
```
Expected: Copilot launches a browser window and describes the login page.

**Playwright Test MCP:**
```
Run the tests in saucedemo/tests/saucedemo-checkout/negative/
```
Expected: Copilot runs the spec files and reports pass/fail counts.

**Atlassian MCP:**
```
Get the details of Jira issue SCRUM-8
```
Expected: returns the full story with acceptance criteria.

### 10.5 How the agents use MCP

These built-in agents use specific MCP servers:

| Agent | How to invoke | Uses |
|-------|--------------|------|
| `playwright-test-generator` | `@playwright-test-generator` in chat | `playwright` MCP to browse live app, then writes spec |
| `playwright-test-healer` | `@playwright-test-healer` in chat | `playwright-test` MCP to run failing test, `playwright` MCP to inspect live page and fix selector |
| `playwright-test-planner` | `@playwright-test-planner` in chat | `playwright` MCP to explore the app and create a test plan |

### 10.6 Add `.vscode/mcp.json` to `.gitignore`

Verify this line exists in your `.gitignore` (it does in this project):
```
.vscode/mcp.json
```
If it is missing, add it before committing anything.

---

## 11. Running Tests Locally

### SauceDemo (all browsers)

```bash
npx playwright test --config=saucedemo/saucedemo.playwright.config.ts
```

### SauceDemo (headed, Chromium only)

```bash
npx playwright test --config=saucedemo/saucedemo.playwright.config.ts \
  --project=chromium --headed
```

### OrangeHRM (all browsers)

```bash
npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts
```

### OrangeHRM (headed, Chromium only — runs seed first)

```bash
npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts \
  --project=setup --project=chromium --headed
```

### OrangeHRM with credentials as env vars

```bash
ORANGEHRM_USERNAME=Admin ORANGEHRM_PASSWORD=admin123 \
  npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts
```

### View HTML report

```bash
npx playwright show-report saucedemo/playwright-report
npx playwright show-report OrangeHRM/playwright-report
```

---

## 12. Adding a New Application

Follow this checklist to onboard a new app (e.g. `MyApp`):

### 11.1 Create folder structure

```bash
mkdir -p MyApp/tests/myapp-e2e
```

### 11.2 Create `MyApp/myapp.playwright.config.ts`

Copy `OrangeHRM/orangehrm.playwright.config.ts` and update:
- `testDir: './tests'`
- `baseURL` to your app's URL
- Keep the `setup` project pointing to `**/seed.spec.ts`

### 11.3 Create `MyApp/tests/seed.spec.ts`

Copy `OrangeHRM/tests/seed.spec.ts` and update the login logic and AUTH_FILE path.

### 11.4 Update `.gitignore`

Add:
```
/MyApp/test-results/
!/MyApp/test-results/*.md
/MyApp/playwright-report/
/MyApp/.auth/
```

### 11.5 Add a CI job in `.github/workflows/playwright.yml`

```yaml
test-myapp:
  name: MyApp E2E Tests
  timeout-minutes: 60
  runs-on: ubuntu-latest
  steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: lts/*
  - run: npm ci
  - run: npx playwright install --with-deps
  - run: npx playwright test --config=MyApp/myapp.playwright.config.ts
  - uses: actions/upload-artifact@v4
    if: ${{ !cancelled() }}
    with:
      name: myapp-playwright-report
      path: MyApp/playwright-report/
      retention-days: 30
```

### 11.6 Add Jira stories

Create stories in Jira using the template from Section 7.2.

### 11.7 Write tests

Move a story to "Ready for QA" — the pipeline fires and creates a branch +
GitHub issue. Then either:
- (Free) Ask Copilot in VS Code: *"generate tests for SCRUM-X"*
- (Copilot Pro) Copilot coding agent picks up the issue automatically

---

## 13. How the Heal Cycle Works

When a test breaks due to a UI selector change:

1. Run the tests — note which test is failing
2. In Copilot Chat, use the `playwright-test-healer` agent:
   ```
   @playwright-test-healer fix the failing test in
   OrangeHRM/tests/orangehrm-e2e/auth/tc-scrum-8-authentication.spec.ts
   ```
3. The healer agent:
   - Launches a browser
   - Inspects the live page
   - Finds the correct selector
   - Updates the spec file
4. Re-run to verify all tests pass

This was demonstrated with SauceDemo TC-NEG-01 — selector was intentionally
broken from `[data-test="error"]` to `[data-test="error-container"]`, the
healer fixed it, and all 39 tests passed again.

---

## 14. Known Limitations

| Limitation | Detail | Workaround |
|------------|--------|------------|
| Copilot coding agent | Requires Copilot Pro/Business license to auto-write code from issues | Write tests manually via Copilot in VS Code |
| OrangeHRM demo rate limits | Demo server returns 429 if too many parallel logins | `workers: 2` set in config; use `test.describe.serial()` for tests that log out |
| Classic PAT required | Fine-grained PATs cannot trigger `repository_dispatch` | Always use a Classic PAT for the Jira automation rule |
| base64 on Linux | `base64` wraps at 76 chars — breaks HTTP auth headers | Use `base64 -w 0` in shell scripts on Linux/GitHub Actions |
| OrangeHRM session shared | One test's logout invalidates the session for subsequent tests | Use `test.describe.serial()` and put logout tests last |
| YAML non-ASCII chars | Unicode characters in YAML comments silently break GitHub Actions parsing | Write workflow files with ASCII-only characters |

---

## 15. Quick Reference — Key Values

> Store sensitive values securely — do not hardcode in source files.

| Item | Value |
|------|-------|
| GitHub repo | `https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright` |
| Jira project | `https://yuvrajkalshetti1990.atlassian.net` — project key `SCRUM` |
| Atlassian Cloud ID | `c2269322-6897-4ede-8e92-04b6edd6edf6` |
| Jira "In QA" transition ID | `41` |
| SauceDemo URL | `https://www.saucedemo.com` — user: `standard_user` / `secret_sauce` |
| OrangeHRM URL | `https://opensource-demo.orangehrmlive.com/web/index.php/auth/login` |
| OrangeHRM credentials | `Admin` / `admin123` (demo site — public) |
| Run SauceDemo tests | `npx playwright test --config=saucedemo/saucedemo.playwright.config.ts` |
| Run OrangeHRM tests | `npx playwright test --config=OrangeHRM/orangehrm.playwright.config.ts` |
| Test branch naming | `auto/test-{lowercase-jira-key}` e.g. `auto/test-scrum-8` |

---

## Troubleshooting

**Jira automation fires but GitHub Actions does not trigger**
- Check that the PAT is a Classic token (not fine-grained)
- Check the PAT has `repo` and `workflow` scopes
- Check the workflow YAML has no non-ASCII characters
- Check GitHub Actions is enabled under repo Settings → Actions

**`workflow_dispatch` returns 422 "Workflow does not have trigger"**
- The YAML is broken — contains Unicode characters GitHub cannot parse
- Fix: rewrite the YAML file using `python3` with `encoding='ascii'`

**OrangeHRM tests redirect to login instead of dashboard**
- The `.auth/admin.json` session has expired (demo server resets periodically)
- Fix: delete `OrangeHRM/.auth/admin.json` and re-run the `setup` project

**`base64` output has line breaks breaking HTTP auth**
- Linux `base64` wraps output by default
- Fix: always use `echo -n "email:token" | base64 -w 0`

**MCP Atlassian tools fail with 401**
- Atlassian Cloud requires `Basic base64(email:token)` auth, not `Bearer token`
- The MCP server handles this automatically — but direct `curl` calls must use Basic
