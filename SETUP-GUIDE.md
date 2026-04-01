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
6. [Step 2 — GitHub Secrets](#6-step-2--github-secrets)
7. [Step 3 — Jira Setup](#7-step-3--jira-setup)
8. [Step 4 — Jira Automation Rule](#8-step-4--jira-automation-rule)
9. [Step 5 — MCP Tools (VS Code)](#9-step-5--mcp-tools-vs-code)
10. [Running Tests Locally](#10-running-tests-locally)
11. [Adding a New Application](#11-adding-a-new-application)
12. [How the Heal Cycle Works](#12-how-the-heal-cycle-works)
13. [Known Limitations](#13-known-limitations)
14. [Quick Reference — Key Values](#14-quick-reference--key-values)

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

## 6. Step 2 — GitHub Secrets

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

## 7. Step 3 — Jira Setup

### 7.1 Create a Jira project

1. Go to https://your-domain.atlassian.net
2. Create a **Scrum** project — key `SCRUM`
3. Add custom statuses: `Ready for QA`, `In QA` (under Project Settings → Statuses)

### 7.2 Create user stories

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

### 7.3 Get your Jira Cloud ID

```bash
curl -s \
  -u "your-email@example.com:YOUR_ATLASSIAN_TOKEN" \
  "https://api.atlassian.com/oauth/token/accessible-resources" \
  | python3 -m json.tool
```

Copy the `id` field — this is your `ATLASSIAN_CLOUD_ID`.

### 7.4 Get transition IDs

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'email:token' | base64)" \
  "https://api.atlassian.com/ex/jira/YOUR_CLOUD_ID/rest/api/3/issue/SCRUM-1/transitions" \
  | python3 -m json.tool
```

Note the `id` for each status — you need the "In QA" transition ID for the
workflow (currently `41` in this project).

---

## 8. Step 4 — Jira Automation Rule

This is the bridge that fires GitHub when a story moves to "Ready for QA".

### 8.1 Create the rule

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

### 8.2 Test the rule

Move any story to "Ready for QA" and check:
- Jira Automation → **Audit log** — should show SUCCESS
- GitHub repo → **Actions** tab — should show a new `repository_dispatch` run

---

## 9. Step 5 — MCP Tools (VS Code)

MCP (Model Context Protocol) lets GitHub Copilot in VS Code call external APIs
directly — Jira, GitHub, and Playwright tools.

### 9.1 Create `.vscode/mcp.json`

> **IMPORTANT:** This file contains secrets. It is gitignored — never commit it.

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

Replace `YOUR_GITHUB_CLASSIC_PAT` and `YOUR_ATLASSIAN_TOKEN` with your real values.

### 9.2 Reload MCP servers

In VS Code: `Cmd+Shift+P` → **MCP: Restart All Servers**

### 9.3 Verify

Open Copilot Chat (`Cmd+Shift+I`), type:
```
List my Jira projects
```
If it returns your project, MCP is working.

---

## 10. Running Tests Locally

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

## 11. Adding a New Application

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

## 12. How the Heal Cycle Works

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

## 13. Known Limitations

| Limitation | Detail | Workaround |
|------------|--------|------------|
| Copilot coding agent | Requires Copilot Pro/Business license to auto-write code from issues | Write tests manually via Copilot in VS Code |
| OrangeHRM demo rate limits | Demo server returns 429 if too many parallel logins | `workers: 2` set in config; use `test.describe.serial()` for tests that log out |
| Classic PAT required | Fine-grained PATs cannot trigger `repository_dispatch` | Always use a Classic PAT for the Jira automation rule |
| base64 on Linux | `base64` wraps at 76 chars — breaks HTTP auth headers | Use `base64 -w 0` in shell scripts on Linux/GitHub Actions |
| OrangeHRM session shared | One test's logout invalidates the session for subsequent tests | Use `test.describe.serial()` and put logout tests last |
| YAML non-ASCII chars | Unicode characters in YAML comments silently break GitHub Actions parsing | Write workflow files with ASCII-only characters |

---

## 14. Quick Reference — Key Values

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
