# E2E Agentic QA Pipeline

A **zero-human-intervention** QA automation pipeline: Jira "Ready for QA" → generated tests → CI execution → Jira "Done" → PR — fully automated.

---

## Pipeline Flow (end-to-end)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Jira story transitions → "Ready for QA"                                │
│     Jira Automation Rule fires a POST to GitHub repository_dispatch        │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  jira-ready-for-qa.yml                                                     │
│                                                                             │
│  Step 1 │ Fetch Jira story (summary, status, labels, description)          │
│  Step 2 │ Detect framework: "cypress" label → Cypress, else → Playwright   │
│  Step 3 │ Review ACs via OpenAI gpt-4o-mini (score 1–5)                   │
│  Step 4 │ Post AC review comment to Jira (Activity tab)                    │
│  Step 5 │ Score < 3.0 → REWRITE → move Jira back to "In Progress" → STOP  │
│  Step 6 │ Create branch auto/test-{issue-key}  (idempotent — reuses if     │
│          │ branch already exists)                                           │
│  Step 7 │ Create GitHub Issue with test instructions  (idempotent — reuses │
│          │ existing issue if already created for this key)                  │
│  Step 8 │ Assign Copilot to that GitHub Issue                              │
│  Step 9 │ Transition Jira → "In QA"  (resilient — 400/409 = already there)│
│  Step 10│ Post Jira comment: pipeline triggered + branch + GH issue URL    │
│  Step 11│ Dispatch cypress.yml OR playwright.yml on the feature branch     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Copilot Coding Agent (GitHub Issue assigned to Copilot)                   │
│                                                                             │
│  • Reads the GitHub Issue instructions                                      │
│  • Fetches the Jira story ACs                                               │
│  • Uses @playwright-test-planner (or explores via @cypress-test-generator) │
│  • Generates one test per AC with AC reference comments                     │
│  • Unimplementable ACs → stubs in qa-framework/notimplemented/             │
│  • Commits + pushes to auto/test-{issue-key}                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ push triggers CI workflow automatically
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  playwright.yml  OR  cypress.yml                                           │
│                                                                             │
│  • npm ci + install browsers / Cypress binary                               │
│  • Count runnable specs (excludes *.notimplemented.* stubs)                │
│  • Run tests (Playwright: results.json │ Cypress: mochawesome.json)        │
│  • Upload JSON results artifact + HTML/video artifact                       │
│  • Always runs to completion — never exits before uploading artifacts       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ workflow_run: completed → post-results-to-jira.yml
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  post-results-to-jira.yml                                                  │
│                                                                             │
│  • Download *-test-results-json artifact                                    │
│  • Parse results.json (Playwright) OR mochawesome.json (Cypress)           │
│  • Post result comment to Jira (passed/failed/skipped counts)              │
│  • If conclusion == success AND failed == 0:                               │
│      → Transition Jira → "Done"                                            │
│      → Open PR: auto/test-{key} → dev  (idempotent — skip if PR exists)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## One-time Setup

### 1. GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value | Where to get it |
|--------|-------|----------------|
| `ATLASSIAN_TOKEN` | Atlassian API token | https://id.atlassian.com → Security → API tokens |
| `OPENAI_API_KEY` | OpenAI API key | https://platform.openai.com/api-keys |
| `GH_PAT` | GitHub Classic PAT, scopes: `repo` + `workflow` | GitHub → Settings → Developer settings → PATs |

> `GITHUB_TOKEN` is auto-provisioned — no action needed.
> `ATLASSIAN_EMAIL` and `ATLASSIAN_CLOUD_ID` are hardcoded in `jira-ready-for-qa.yml` env block.

### 2. Jira Automation Rule

Create a rule in your Jira project → **Automation → Create rule**:

- **Trigger:** Issue transitioned → Status changed to = `Ready for QA`
- **Action:** Send web request
  - Method: `POST`
  - URL: `https://api.github.com/repos/{owner}/{repo}/dispatches`
  - Headers:
    - `Authorization: Bearer YOUR_GH_PAT`
    - `Content-Type: application/json`
  - Body:
    ```json
    {
      "event_type": "jira-ready-for-qa",
      "client_payload": { "issue_key": "{{issue.key}}" }
    }
    ```

> Use a Classic PAT for the Jira rule (Fine-grained PATs don't support `repository_dispatch`).

### 3. Jira Status Transition IDs

These are hardcoded in the workflows — verify they match your board:

| Status | Transition ID |
|--------|--------------|
| To Do | `11` |
| In Progress | `21` |
| In QA | `41` |
| Done | `52` |

To verify: `GET /rest/api/3/issue/{key}/transitions` → look for `id` in the response.

### 4. Copilot Coding Agent (GitHub)

Ensure the repository has **GitHub Copilot Enterprise** enabled so the Copilot coding agent can accept issue assignments. The pipeline assigns Copilot to the generated GitHub Issue, which triggers it to generate tests.

---

## Framework Selection

| How | Result |
|-----|--------|
| Jira issue has label `cypress` | Cypress tests generated |
| No `cypress` label | Playwright tests generated (default) |
| Manual `workflow_dispatch` → `framework: cypress` | Override |
| Manual `workflow_dispatch` → `framework: playwright` | Override |

---

## AC → Test Traceability

Every generated test file must follow this pattern:

```typescript
/**
 * Jira: SCRUM-42 — User Login
 *
 * Acceptance Criteria covered:
 *  AC-1: Given valid credentials, when submitted, user is redirected to /inventory
 *  AC-2: Given invalid credentials, an error message "Epic sadface..." is displayed
 *
 * Generated by: playwright-test-generator agent
 */

// AC-1: Given valid credentials, when submitted, user is redirected to /inventory
test('should redirect to inventory on valid login', async ({ page }) => { ... });

// AC-2: Given invalid credentials, an error message "Epic sadface..." is displayed
test('should show error on invalid login', async ({ page }) => { ... });
```

This is enforced by the agent prompts in `.github/agents/playwright-test-generator.agent.md` and `cypress-test-generator.agent.md`.

---

## Unimplemented ACs

When an AC cannot be automated, a stub is created instead of silently skipping:

```
qa-framework/notimplemented/{issue-key-lower}-ac-{n}.notimplemented.spec.ts
```

Example stub:
```typescript
/**
 * NOT IMPLEMENTED — SCRUM-42 AC-3
 * AC Text: "A confirmation email should be sent after registration"
 * Reason: Non-UI verification — cannot check email inbox from browser
 * Missing: Email testing integration (Mailhog/Mailtrap/Mailosaur)
 */
test.skip('SCRUM-42 — A confirmation email should be sent', async ({ page }) => {
  // TODO: implement once email testing is integrated
});
```

These stubs:
- Are **excluded from CI** via `testIgnore` / `excludeSpecPattern`
- Track what's not automated and why
- Serve as work items to resolve

See [qa-framework/notimplemented/README.md](qa-framework/notimplemented/README.md).

---

## Pipeline State Management

State is tracked per branch as `qa-framework/pipeline-state/{issue-key}.state.json` (committed to the feature branch).

Key idempotency guarantees:
- **Branch re-creation**: detected by `git ls-remote --exit-code` — reuses existing branch
- **GitHub Issue duplication**: checked by searching existing issues labelled `automated-qa` with the issue key before creating
- **PR duplication**: checked by `gh pr list --head ... --base dev` before creating
- **Jira transitions**: HTTP 400/409 = already in target state — logged + continues

Re-running `jira-ready-for-qa.yml` for the same issue is safe — no duplicate branches, issues, comments, or PRs.

---

## Switching Frameworks Per Story

Add a label to your Jira issue:
- `cypress` → Cypress tests
- (no label) → Playwright tests (default)

To switch an existing story: remove/add the label, move back to "Ready for QA", and the pipeline re-runs.

---

## Running Tests Locally

```bash
# Install dependencies
npm ci

# Playwright — SauceDemo
npx playwright test --config=Playwright/saucedemo/saucedemo.playwright.config.ts

# Playwright — with UI
npx playwright test --config=Playwright/saucedemo/saucedemo.playwright.config.ts --ui

# Cypress — interactive Test Runner
npx cypress open --config-file Cypress/cypress.config.ts

# Cypress — headless CI run
npx cypress run --config-file Cypress/cypress.config.ts

# Run a single Playwright spec
npx playwright test --config=Playwright/saucedemo/saucedemo.playwright.config.ts path/to/spec.spec.ts
```

---

## VS Code Agent Reference

| Task | Agent | Command |
|------|-------|---------|
| Review ACs for automation feasibility | `@ac-reviewer` | `@ac-reviewer SCRUM-42` |
| Create a test plan from a story/URL | `@playwright-test-planner` | `@playwright-test-planner <story or URL>` |
| Generate a Playwright test | `@playwright-test-generator` | `@playwright-test-generator <plan item>` |
| Fix a failing Playwright test | `@playwright-test-healer` | `@playwright-test-healer <file or error>` |
| Generate a Cypress test | `@cypress-test-generator` | `@cypress-test-generator <plan item>` |
| Fix a failing Cypress test | `@cypress-test-healer` | `@cypress-test-healer <file or error>` |

**Do NOT** generate or fix test files in default Copilot mode — always delegate to the agent above.

---

## Repository Structure

```
E2E-AgenticWorkflow/
│
├── .github/
│   ├── agents/
│   │   ├── ac-reviewer.agent.md              # AC feasibility reviewer
│   │   ├── playwright-test-planner.agent.md  # Test plan creator
│   │   ├── playwright-test-generator.agent.md
│   │   ├── playwright-test-healer.agent.md
│   │   ├── cypress-test-generator.agent.md
│   │   └── cypress-test-healer.agent.md
│   ├── instructions/
│   │   ├── playwright.instructions.md        # Auto-applied to Playwright/**
│   │   └── cypress.instructions.md           # Auto-applied to Cypress/**
│   ├── workflows/
│   │   ├── jira-ready-for-qa.yml             # Entry point (Jira webhook)
│   │   ├── playwright.yml                    # CI — Playwright tests
│   │   ├── cypress.yml                       # CI — Cypress tests
│   │   ├── post-results-to-jira.yml          # CI post-processor
│   │   └── copilot-setup-steps.yml           # Copilot agent env setup
│   ├── copilot-instructions.md               # Global agent routing rules
│   └── WORKFLOW-GUIDE.md                     # Detailed walkthrough
│
├── qa-framework/                             # Framework-agnostic shared code
│   ├── common/
│   │   ├── types/index.ts                    # All shared TypeScript types
│   │   ├── utils/
│   │   │   ├── logger.ts                     # Structured JSON logger
│   │   │   └── test-result-parser.ts         # Playwright + Cypress result parser
│   │   ├── jira/jira-client.ts               # Jira REST API v3 client
│   │   ├── github/github-client.ts           # GitHub REST API v3 client
│   │   ├── agents-core/ac-scorer.ts          # AC scoring + stub generator
│   │   └── pipeline-state/state-manager.ts   # Idempotent state persistence
│   ├── frameworks/
│   │   ├── playwright/spec-builder.ts        # Playwright-specific spec builder
│   │   └── cypress/spec-builder.ts           # Cypress-specific spec builder
│   ├── notimplemented/
│   │   ├── README.md
│   │   ├── _TEMPLATE.spec.ts                 # Playwright stub template
│   │   └── _TEMPLATE.cy.ts                   # Cypress stub template
│   └── pipeline-state/                       # *.state.json files (per branch)
│
├── Playwright/
│   └── saucedemo/
│       ├── saucedemo.playwright.config.ts
│       ├── tests/                            # {app}-tc-{area}-{nn}-{desc}.spec.ts
│       └── specs/                            # Test plans from @playwright-test-planner
│
├── Cypress/
│   ├── cypress.config.ts                     # Mochawesome + excludeSpecPattern
│   └── cypress/
│       ├── e2e/                              # {app}-cy-{area}-{nn}-{desc}.cy.ts
│       ├── fixtures/
│       ├── pages/
│       └── support/
│
├── package.json                              # Single node_modules for all frameworks
└── README.md                                 # This file
```

---

## Failure Handling

| Failure | Behaviour |
|---------|-----------|
| OpenAI unreachable | Defaults to `IMPROVE` verdict — pipeline continues |
| OpenAI returns non-JSON | Defaults to `IMPROVE` verdict — pipeline continues |
| AC score < 3.0 (REWRITE) | Pipeline blocked, Jira moved back to "In Progress" |
| Jira transition fails (already in state) | HTTP 400/409 logged, pipeline continues |
| GitHub issue already exists | Existing issue reused — no duplicate created |
| PR already exists | Existing PR reused — no duplicate created |
| CI tests fail | Jira gets a FAILED comment, NOT transitioned to Done, NO PR opened |
| CI passes but no JSON artifact | Jira gets PASSED comment, Done transition uses workflow conclusion |
| No specs found in Cypress | Warning logged, workflow marked neutral, no Done transition |


```
Jira: Move story → "Ready for QA"
        │
        │  Jira Automation fires webhook → repository_dispatch
        ▼
[jira-ready-for-qa.yml]
  1. Fetch Jira story (summary, labels, description, ACs)
  2. Detect framework: cypress label → Cypress, else → Playwright
  3. Review ACs with OpenAI gpt-4o-mini (score 1–5)
  4. Post AC review comment to Jira
  5. If score < 3.0 → REWRITE → transition back to "In Progress" → STOP
  6. Create feature branch: auto/test-{issue-key}
  7. Create GitHub Issue with automation instructions
  8. Assign Copilot to the GitHub Issue
  9. Transition Jira → "In QA"
 10. Dispatch cypress.yml OR playwright.yml on the feature branch
        │
        ▼
Copilot generates tests & commits to auto/test-{issue-key}
        │
        │  push to auto/** triggers CI workflow automatically
        ▼
[playwright.yml] OR [cypress.yml]
  1. npm ci + install browsers/Cypress binary
  2. Run all tests (excluding seed, example, .notimplemented stubs)
  3. Upload JSON results artifact + HTML report artifact
        │
        ▼
[post-results-to-jira.yml]  (triggers on workflow completion on auto/test-* branches)
  1. Download JSON results artifact
  2. Parse pass/fail/skip counts
  3. Post test result comment to Jira
  4. If all tests pass → transition Jira → "Done"
  5. If all tests pass → open PR: auto/test-{issue-key} → dev
```

---

## Repository structure

```
E2E-AgenticWorkflow/
├── .github/
│   ├── agents/                          # VS Code custom agent definitions
│   │   ├── ac-reviewer.agent.md         # Review ACs for automation feasibility
│   │   ├── playwright-test-planner.agent.md
│   │   ├── playwright-test-generator.agent.md
│   │   ├── playwright-test-healer.agent.md
│   │   ├── cypress-test-generator.agent.md
│   │   └── cypress-test-healer.agent.md  # NEW — healing for Cypress failures
│   ├── instructions/
│   │   ├── playwright.instructions.md   # Applied to Playwright/** automatically
│   │   └── cypress.instructions.md      # Applied to Cypress/** automatically
│   ├── workflows/
│   │   ├── jira-ready-for-qa.yml        # Entry point — Jira webhook trigger
│   │   ├── playwright.yml               # CI — runs Playwright tests
│   │   ├── cypress.yml                  # CI — runs Cypress tests
│   │   ├── post-results-to-jira.yml     # CI post-processor — Jira comments + Done + PR
│   │   └── copilot-setup-steps.yml      # Copilot agent environment pre-install
│   ├── copilot-instructions.md          # Agent routing rules (enforced globally)
│   └── WORKFLOW-GUIDE.md               # Detailed pipeline walkthrough
│
├── qa-framework/                        # Framework-agnostic shared code
│   ├── common/
│   │   ├── types/index.ts               # Shared TypeScript types (all frameworks)
│   │   ├── utils/
│   │   │   ├── logger.ts                # Structured JSON logger
│   │   │   └── test-result-parser.ts    # Playwright & Cypress JSON result parser
│   │   ├── jira/
│   │   │   └── jira-client.ts           # Jira REST API v3 client (no SDK dependency)
│   │   ├── github/
│   │   │   └── github-client.ts         # GitHub REST API v3 client (no SDK dependency)
│   │   ├── agents-core/
│   │   │   └── ac-scorer.ts             # AC scoring logic + notimplemented stub generator
│   │   └── pipeline-state/
│   │       └── state-manager.ts         # Pipeline state persistence (idempotent re-runs)
│   ├── notimplemented/
│   │   ├── README.md                    # How to handle unautomatable ACs
│   │   ├── _TEMPLATE.spec.ts            # Playwright stub template
│   │   └── _TEMPLATE.cy.ts              # Cypress stub template
│   └── pipeline-state/
│       └── .gitkeep                     # Directory for *.state.json files (committed per branch)
│
├── Playwright/
│   └── saucedemo/
│       ├── saucedemo.playwright.config.ts
│       ├── tests/                       # Test files: {app}-tc-{area}-{nn}-{desc}.spec.ts
│       └── specs/                       # Test plans from @playwright-test-planner
│
├── Cypress/
│   ├── cypress.config.ts               # Mochawesome JSON reporter wired in
│   └── cypress/
│       ├── e2e/                        # Test files: {app}-cy-{area}-{nn}-{desc}.cy.ts
│       ├── fixtures/
│       ├── pages/
│       └── support/
│
└── package.json                        # Single node_modules for all frameworks
```

---

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `ATLASSIAN_TOKEN` | Atlassian API token (from id.atlassian.com → API tokens) |
| `OPENAI_API_KEY` | OpenAI key for AC quality review (model: gpt-4o-mini) |
| `GH_PAT` | GitHub Classic PAT with `repo` + `workflow` scopes (for cross-workflow dispatch) |

> `GITHUB_TOKEN` is auto-provisioned by Actions — no secret needed.
> `ATLASSIAN_EMAIL` and `ATLASSIAN_CLOUD_ID` are hardcoded in `jira-ready-for-qa.yml` env block.

---

## Jira Automation Rule Setup

Create a Jira Automation Rule with:

- **Trigger:** Issue transitioned → status = "Ready for QA"
- **Action:** Send web request
  - Method: `POST`
  - URL: `https://api.github.com/repos/{owner}/{repo}/dispatches`
  - Headers:
    - `Authorization: Bearer YOUR_GH_PAT`
    - `Content-Type: application/json`
  - Body:
    ```json
    {
      "event_type": "jira-ready-for-qa",
      "client_payload": { "issue_key": "{{issue.key}}" }
    }
    ```

---

## Framework Selection

The pipeline auto-detects the framework from the Jira issue:

| Jira label on issue | Framework used |
|--------------------|---------------|
| `cypress`          | Cypress        |
| anything else      | Playwright (default) |

Override manually via `workflow_dispatch → framework` input.

---

## Agent Routing (VS Code)

| Task | Agent | Command |
|------|-------|---------|
| Review ACs | `@ac-reviewer` | `@ac-reviewer SCRUM-42` |
| Plan tests | `@playwright-test-planner` | `@playwright-test-planner <story or URL>` |
| Generate Playwright test | `@playwright-test-generator` | `@playwright-test-generator <test plan item>` |
| Fix failing Playwright test | `@playwright-test-healer` | `@playwright-test-healer <file or error>` |
| Generate Cypress test | `@cypress-test-generator` | `@cypress-test-generator <test plan item>` |
| Fix failing Cypress test | `@cypress-test-healer` | `@cypress-test-healer <file or error>` |

> In default Copilot mode, do NOT generate or fix test files directly.
> Always delegate to the agent listed above.

---

## Unimplemented ACs

When an AC cannot be automated, a stub file is created at:

```
qa-framework/notimplemented/{issue-key-lower}-ac-{n}.notimplemented.spec.ts
qa-framework/notimplemented/{issue-key-lower}-ac-{n}.notimplemented.cy.ts
```

These files:
- Contain the AC text and reason it could not be implemented
- List exactly what is missing (selectors, data, non-UI scope)
- Use `test.skip()` / `it.skip()` so they never block CI
- Are excluded from test runs by `testIgnore` / `excludeSpecPattern`

See [qa-framework/notimplemented/README.md](qa-framework/notimplemented/README.md) for instructions.

---

## Running tests locally

```bash
# Playwright — SauceDemo
npx playwright test --config=Playwright/saucedemo/saucedemo.playwright.config.ts

# Cypress — interactive
npx cypress open --config-file Cypress/cypress.config.ts

# Cypress — headless
npx cypress run --config-file Cypress/cypress.config.ts
```

---

## Adding a new app

### Playwright

1. Create `Playwright/{appname}/{appname}.playwright.config.ts`
2. Add a job to `.github/workflows/playwright.yml` following the existing `test-saucedemo` pattern
3. Use `@playwright-test-planner` to create a test plan, then `@playwright-test-generator` per scenario

### Cypress

1. Add a new `specPattern` subfolder under `Cypress/cypress/e2e/{story-slug}/`
2. Cypress config already picks up all `*.cy.ts` files recursively — no config change needed
3. Use `@cypress-test-generator` to create spec files

---

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-only. Clean at all times. |
| `dev` | Active development. All work goes here. |
| `auto/test-{issue-key}` | Auto-created per Jira story by `jira-ready-for-qa.yml` |
