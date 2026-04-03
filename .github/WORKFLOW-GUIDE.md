# E2E Agentic QA Workflow — End-to-End Guide

This document describes the full pipeline from a product story in Jira to passing automated tests — including the failure (AC Rewrite) path.

---

## Key Links

| Resource | URL |
|----------|-----|
| Jira Project Board | https://yuvrajkalshetti1990.atlassian.net/jira/software/projects/SCRUM/boards |
| GitHub Repository | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright |
| GitHub Actions (all) | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/actions |
| `jira-ready-for-qa` workflow | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/actions/workflows/jira-ready-for-qa.yml |
| `playwright` CI workflow | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/actions/workflows/playwright.yml |
| `post-results-to-jira` workflow | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/actions/workflows/post-results-to-jira.yml |
| GitHub Secrets | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/settings/secrets/actions |
| Branches | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/branches |
| Pull Requests | https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/pulls |

---

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `ATLASSIAN_TOKEN` | Jira API access (Atlassian API token) |
| `GH_PAT` | GitHub Personal Access Token (Classic, `repo` scope) |
| `OPENAI_API_KEY` | OpenAI key for AC quality review — model: `gpt-4o-mini` |
| `ORANGEHRM_USERNAME` | OrangeHRM login username |
| `ORANGEHRM_PASSWORD` | OrangeHRM login password |

---

## Jira Status Transitions (confirmed IDs)

| Status | Transition ID |
|--------|--------------|
| To Do | `11` |
| In Progress | `21` |
| In Review | `31` |
| In QA | `41` |
| Ready for QA | `51` |
| **Done** | **`52`** |

---

## Path A — AC Rewrite (Pipeline Blocked)

> Triggered when OpenAI scores ACs below 3.0 / 5.0

```
Product / BA
    │
    ▼
Jira: Move story to "Ready for QA"
    │  (Jira Automation Rule fires a webhook to GitHub)
    │
    ▼
[jira-ready-for-qa.yml] — Step 1: Fetch story details (summary, labels, framework)
    │
    ▼
[jira-ready-for-qa.yml] — Step 2: Fetch full description → POST to OpenAI gpt-4o-mini
    │  Score < 3.0 → VERDICT = REWRITE
    │
    ▼
[jira-ready-for-qa.yml] — Step 3: POST comment to Jira (Activity tab)
    │  "AC Automation Feasibility Review"
    │  Score: X / 5.0 | Verdict: REWRITE
    │  Issues Found: [bullet list]
    │  Suggestions: [bullet list]
    │
    ▼
[jira-ready-for-qa.yml] — Step 4: Transition Jira → "In Progress" (ID 21)
    │
    ▼
Pipeline exits (exit 1) — GitHub Actions job = RED ✗
    │
    ▼
Product / BA reviews the Jira comment, improves ACs, re-moves to "Ready for QA"
```

**Where to find the AC comment in Jira:**
Open the story → scroll to the bottom → **Activity** section → **Comments** tab.
Direct example: https://yuvrajkalshetti1990.atlassian.net/browse/SCRUM-9

---

## Path B — AC Passes — Full Green Pipeline

> Triggered when OpenAI scores ACs ≥ 3.0 / 5.0 (IMPROVE or AUTOMATE)

```
Product / BA
    │
    ▼
Jira: Move story to "Ready for QA"
    │  (OR: manual trigger via workflow_dispatch on GitHub Actions)
    │
    ▼
── WORKFLOW 1 ─────────────────────────────────────────────────────────────────
[jira-ready-for-qa.yml]

  Step 1: Fetch story details
          • Reads: summary, status, labels from Jira REST API
          • Detects framework: label "cypress" → Cypress, else → Playwright

  Step 2: AC quality review via OpenAI
          • Sends full Jira description to gpt-4o-mini
          • Score ≥ 3.0 → VERDICT = IMPROVE or AUTOMATE
          • Outputs: SCORE, VERDICT, SUMMARY, ISSUES, SUGGESTIONS

  Step 3: Post AC review comment to Jira (Activity tab)
          • Comment always posted regardless of verdict

  Step 4: "Block pipeline" step — SKIPPED (condition: VERDICT == REWRITE → false)

  Step 5: Create branch  auto/test-scrum-{N}  from dev
          • Skips creation if branch already exists

  Step 6: Create GitHub Issue
          • Title:  [SCRUM-N] Automate: <story summary>
          • Body:   framework-specific agent instructions (Playwright or Cypress)
          • Labels: automated-qa + framework:playwright / framework:cypress
          • Branch reference included in body

  Step 7: Assign GitHub Copilot to the issue
          (Copilot reads the issue and generates test files)

  Step 8: Transition Jira → "In QA"  (ID 41)

  Step 9: Post Jira comment
          "Automation pipeline triggered. Branch: auto/test-scrum-N | Issue: <url>"
─────────────────────────────────────────────────────────────────────────────

    │
    │  Copilot generates test files and commits to  auto/test-scrum-{N}
    ▼

── WORKFLOW 2 ─────────────────────────────────────────────────────────────────
[playwright.yml]  — triggered on push to  auto/test-*  branches

  Job: test-saucedemo
          • npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts
          • Uploads: saucedemo-results.json artifact

  [cypress.yml]  — triggered separately for Cypress stories

  Job: test-cypress
          • npx cypress run --config-file qa-framework/frameworks/cypress/cypress.config.ts
          • Uploads: cypress-results.json artifact
─────────────────────────────────────────────────────────────────────────────

    │
    │  All CI jobs complete (pass or fail)
    ▼

── WORKFLOW 3 ─────────────────────────────────────────────────────────────────
[post-results-to-jira.yml]  — triggered when playwright.yml or cypress CI finishes

  Step 1: Extract issue key from branch name  (auto/test-scrum-9 → SCRUM-9)

  Step 2: Download JSON result artifacts

  Step 3: Parse counts  — passed / failed / skipped per suite

  Step 4: Post test results comment to Jira (Activity tab)
          ✅ SauceDemo: X passed, Y failed
          ✅ OrangeHRM: X passed, Y failed
          ✅ Cypress:   X passed, Y failed

  Step 5 (if ALL passed): Transition Jira → "Done"  (ID 52)

  Step 6 (if ALL passed): Open Pull Request
          • From:  auto/test-scrum-{N}
          • Into:  dev
          • Title: [SCRUM-N] Automated tests — <story summary>
─────────────────────────────────────────────────────────────────────────────

    │
    ▼
Jira story status = Done ✓
GitHub PR created for review
```

---

## Manual Trigger (No Jira Webhook Needed)

1. Go to: https://github.com/yuvrajkalshetti1990-byte/AgentE2EQAWorkflow-Playwright/actions/workflows/jira-ready-for-qa.yml
2. Click **Run workflow**
3. Enter:
   - `issue_key` — e.g. `SCRUM-9`
   - `framework` — `auto` (reads Jira labels) | `playwright` | `cypress`
4. Click **Run workflow**

---

## Framework Detection Logic

```
Manual override "playwright" → Playwright
Manual override "cypress"    → Cypress
Jira label "cypress" present → Cypress
(default)                    → Playwright
```

---

## Agent Routing (VS Code)

| Task | Agent |
|------|-------|
| Review ACs before automation | `@ac-reviewer SCRUM-9` |
| Create a test plan | `@playwright-test-planner <story URL>` |
| Generate Playwright spec | `@playwright-test-generator <test plan item>` |
| Fix a failing Playwright test | `@playwright-test-healer <error or file>` |
| Generate Cypress spec | `@cypress-test-generator <test plan item>` |

---

## Local Test Runs

```bash
# SauceDemo (Playwright)
npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts

# Cypress (headless)
npx cypress run --config-file qa-framework/frameworks/cypress/cypress.config.ts

# Cypress (interactive)
npx cypress open --config-file qa-framework/frameworks/cypress/cypress.config.ts
```

---

## Project Structure

```
.github/
  workflows/
    jira-ready-for-qa.yml     ← Jira → branch + GitHub Issue + AC review
    playwright.yml            ← CI: runs all test suites + uploads JSON artifacts
    post-results-to-jira.yml  ← Posts results, transitions Done, opens PR
  agents/
    playwright-test-generator.agent.md
    playwright-test-healer.agent.md
    playwright-test-planner.agent.md
    cypress-test-generator.agent.md
    ac-reviewer.agent.md
  instructions/
    playwright.instructions.md    (applyTo: qa-framework/frameworks/playwright/**)
    cypress.instructions.md       (applyTo: qa-framework/frameworks/cypress/**)
  copilot-instructions.md         ← Global agent routing table
  WORKFLOW-GUIDE.md               ← This file

Playwright/
  saucedemo/                      ← SauceDemo tests + config
  OrangeHRM/                      ← OrangeHRM tests + config + seed

Cypress/
  cypress.config.ts
  cypress/
    e2e/                          ← One subfolder per Jira story
    support/
```
