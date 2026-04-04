# E2E Agentic QA Pipeline

A **zero-human-intervention** QA automation pipeline: Jira "Ready for QA" → AC enrichment → generated tests → CI execution → test report → Jira "Done" → PR — fully automated.

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
│  Step 1  │ Load pipeline state (idempotency check)                         │
│  Step 2  │ Fetch Jira story (summary, status, labels, description)         │
│  Step 3  │ Detect framework: "cypress" label → Cypress, else → Playwright  │
│  Step 4  │ Review ACs via OpenAI gpt-4o-mini (score 1-5, per-dimension)    │
│  Step 5  │ Post AC review comment to Jira (Activity tab)                   │
│  Step 6  │ Score < 3.0 → REWRITE → move Jira back to "In Progress" → STOP │
│  Step 7  │ Enrich ACs (Test Intelligence Layer) →                          │
│          │   builds assertionHints, edgeCases, suggestedTitles             │
│          │   writes qa-framework/intelligence/{key}-enhanced-ac.json       │
│  Step 8  │ Create branch auto/test-{issue-key}  (idempotent)               │
│  Step 9  │ Create GitHub Issue with test instructions + Intelligence Note  │
│          │   (idempotent — reuses if already created)                      │
│  Step 10 │ Assign Copilot to that GitHub Issue                             │
│  Step 11 │ Persist pipeline state + intelligence file to feature branch    │
│  Step 12 │ Transition Jira → "In QA"  (resilient: 400/409 = already there)│
│  Step 13 │ Post Jira comment: pipeline triggered + branch + GH issue URL  │
│  Step 14 │ Dispatch cypress.yml OR playwright.yml on the feature branch    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Copilot Coding Agent (GitHub Issue assigned to Copilot)                   │
│                                                                             │
│  • Reads the GitHub Issue instructions                                      │
│  • Reads qa-framework/intelligence/{key}-enhanced-ac.json (if present)    │
│    → uses suggestedTestTitle, assertionHints, edgeCases per AC             │
│  • Uses @playwright-test-planner or @cypress-test-planner for test plan   │
│  • Generates one test per AC (ACs with verdict=REWRITE → skip)            │
│  • Non-automatable ACs → stubs in qa-framework/notimplemented/            │
│  • Commits + pushes to auto/test-{issue-key}                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ push triggers CI workflow automatically
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  playwright.yml  OR  cypress.yml                                           │
│                                                                             │
│  • npm ci + install browsers / Cypress binary                               │
│  • TypeScript compilation check + compliance validation                    │
│  • Count runnable specs (excludes *.notimplemented.* stubs)                │
│  • Run tests (Playwright: results.json | Cypress: mochawesome.json)        │
│  • Generate test execution report → qa-framework/reports/{key}-report.md  │
│  • Upload: JSON results + HTML/video + report artifacts                    │
│  • Always runs to completion — never exits before uploading artifacts       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ workflow_run: completed → post-results-to-jira.yml
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  post-results-to-jira.yml                                                  │
│                                                                             │
│  • Download *-test-results-json artifact                                    │
│  • Parse results.json (Playwright) OR mochawesome.json (Cypress)           │
│  • Post result comment to Jira (passed/failed/skipped + report link)       │
│  • If conclusion == success AND failed == 0 AND results artifact found:    │
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
| Jira issue has **both** `cypress` **and** `playwright` labels | ❌ **Pipeline fails with `FRAMEWORK_AMBIGUOUS`** — remove one label |
| Manual `workflow_dispatch` → `framework: cypress` | Override |
| Manual `workflow_dispatch` → `framework: playwright` | Override |

---

## Test Intelligence Layer

Before creating tests, the pipeline enriches each AC with structured, machine-readable metadata:

```
jira-ready-for-qa.yml (Step 7)
   └── scripts/enrich-ac.js
         └── writes qa-framework/intelligence/{ISSUE-KEY}-enhanced-ac.json
```

Each enriched AC contains:

| Field | Description |
|-------|-------------|
| `verdict` | `AUTOMATE` / `IMPROVE` / `REWRITE` (from AC scorer) |
| `automatable` | `true` / `false` — whether to generate a test |
| `suggestedTestTitle` | Ready-to-use test title derived from the AC |
| `assertionHints[]` | Typed hints: `url-check`, `text-visible`, `element-visible`, etc. |
| `edgeCases[]` | Typed edge cases: `empty-input`, `boundary-value`, `invalid-input`, etc. |
| `expectedOutcomes[]` | Plain-text list of things to verify |
| `enhancedText` | AC rewritten in Given/When/Then format (for IMPROVE/REWRITE) |

**Generator agents read this file automatically** — `@playwright-test-generator` and `@cypress-test-generator` both check for `qa-framework/intelligence/{story-key}-enhanced-ac.json` before writing a test.

To run enrichment locally:

```bash
node scripts/enrich-ac.js \
  --story-key SCRUM-42 \
  --acs "Given a logged-in user, when..." "When invalid email..." \
  --framework playwright
```

---

## Test Execution Reports

After every CI run, a Markdown report is generated and uploaded as a CI artifact:

```
qa-framework/reports/{ISSUE-KEY}-test-report.md
```

Sections: Executive Summary · Test Execution Results · AC Coverage · Failure Analysis · Healing Activities · Coverage Summary · Gaps & Recommendations

The report is linked in the Jira comment posted by `post-results-to-jira.yml`.

To generate locally:

```bash
node scripts/generate-report.js \
  --story-key SCRUM-42 \
  --results-json qa-framework/frameworks/cypress/reports/results.json \
  --framework cypress
```

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
- Are also created automatically by the orchestrator when the LLM healer exhausts all retry attempts

See [qa-framework/notimplemented/README.md](qa-framework/notimplemented/README.md).

---

## Production Readiness & Quality Gates

The pipeline enforces strict quality rules at every stage:

### Pre-flight checks (BEFORE tests run)

| Script | What it enforces | Frameworks |
|--------|-----------------|------------|
| `scripts/validate-test-quality.js` | Assertions present, not navigation-only, no weak-only assertions, AC traceability (`// Jira:`), **per-test `// AC-N:` comment** | Playwright + Cypress |
| `scripts/validate-test-quality.js` | `console.log()` in every Playwright file (observability) | Playwright |
| `scripts/validate-test-quality.js` | `cy.log()` in every Cypress file (observability) | Cypress |
| `scripts/validate-fixtures.js` | Every `cy.fixture()` has `@requiredFixtures` comment | Cypress |
| `scripts/validate-playwright-data.js` | All `fs.readFileSync`, `storageState`, `require(*.json)` references point to files that exist on disk | Playwright |
| `scripts/validate-playwright-tests.js` | No hardcoded credentials, `// Jira:` header, `console.log()` | Playwright |
| `scripts/validate-cypress-tests.js` | No hardcoded credentials, `// Jira:` header, `cy.log()` | Cypress |

All run **before** `npx playwright test` / `npx cypress run` in CI — failure exits before a browser is launched.

### Orchestrator safety rules

| Rule | Behaviour |
|------|-----------|
| **Dual framework labels** | `cypress` + `playwright` both present → immediate `FRAMEWORK_AMBIGUOUS` error |
| **Quality gate** | `validate-test-quality.js` runs **blocking** before any test execution — no `\|\| true` bypass |
| **Healer max retries** | `HEALER_MAX_RETRIES` (default: 2) — after exhausting retries, file is moved to `notimplemented/` |
| **Healer context** | Healer receives real stdout+stderr from the failed test run — not an empty string |
| **Report validation** | Report must exist, be non-empty, and contain `Executive Summary`, `Test Results`, `Coverage` |
| **Jira Done gate** | Transition to Done **only** when `passed=true` AND `failedCount === 0` |
| **Jira Done artifact gate** | `post-results-to-jira.yml` additionally requires `has_counts == 'true'` — no Done if test artifact is missing |
| **Branch safety** | Existing branch is reused instead of re-created — verified before committing |
| **Dual pipeline safety** | `qa-automation.yml` is an independent standalone path — do NOT run alongside the Jira-triggered pipeline for the same story |

### Pipeline audit

Run at any time to verify all components are wired:

```bash
node scripts/pipeline-audit.js
```

Currently checks **32 conditions (C01–C32)**. Exits 1 if any fail.

> C31 verifies `scripts/validate-playwright-data.js` exists and has blocking exit(1).
> C32 verifies it runs before `npx playwright test` in `playwright.yml`.

---



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
npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts

# Playwright — with UI
npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts --ui

# Cypress — interactive Test Runner
npx cypress open --config-file qa-framework/frameworks/cypress/cypress.config.ts

# Cypress — headless CI run
npx cypress run --config-file qa-framework/frameworks/cypress/cypress.config.ts

# Run a single Playwright spec
npx playwright test --config=qa-framework/frameworks/playwright/playwright.config.ts path/to/spec.spec.ts
```

---

## VS Code Agent Reference

| Task | Agent | Command |
|------|-------|---------|
| Review ACs for automation feasibility | `@ac-reviewer` | `@ac-reviewer SCRUM-42` |
| Create a Playwright test plan from a story/URL | `@playwright-test-planner` | `@playwright-test-planner <story or URL>` |
| Create a Cypress test plan from a story/URL | `@cypress-test-planner` | `@cypress-test-planner <story or URL>` |
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
│   │   ├── playwright-test-planner.agent.md  # Playwright test plan creator
│   │   ├── cypress-test-planner.agent.md     # Cypress test plan creator
│   │   ├── playwright-test-generator.agent.md
│   │   ├── playwright-test-healer.agent.md
│   │   ├── cypress-test-generator.agent.md
│   │   └── cypress-test-healer.agent.md
│   ├── instructions/
│   │   ├── playwright.instructions.md        # Auto-applied to playwright/**
│   │   └── cypress.instructions.md           # Auto-applied to cypress/**
│   ├── workflows/
│   │   ├── jira-ready-for-qa.yml             # Entry point (Jira webhook → pipeline)
│   │   ├── playwright.yml                    # CI — Playwright tests + report
│   │   ├── cypress.yml                       # CI — Cypress tests + report
│   │   ├── post-results-to-jira.yml          # CI post-processor (comment + Done + PR)
│   │   └── copilot-setup-steps.yml           # Copilot agent env pre-install
│   └── copilot-instructions.md               # Global agent routing rules
│
├── qa-framework/
│   ├── common/
│   │   ├── types/index.ts                    # All shared TypeScript types
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── test-result-parser.ts         # Playwright + Cypress result parser
│   │   │   └── report-generator.ts           # TypeScript source for report generator
│   │   ├── jira/jira-client.ts               # Jira REST API v3 client
│   │   ├── github/github-client.ts           # GitHub REST API v3 client
│   │   ├── agents-core/
│   │   │   ├── ac-scorer.ts                  # AC quality scoring (5 dimensions)
│   │   │   └── ac-enricher.ts                # Test Intelligence Layer enrichment
│   │   └── pipeline-state/state-manager.ts   # Idempotent state persistence
│   ├── frameworks/
│   │   ├── playwright/                       # SauceDemo Playwright tests
│   │   │   ├── playwright.config.ts
│   │   │   ├── tests/                        # {app}-tc-{area}-{nn}-{desc}.spec.ts
│   │   │   └── specs/                        # Test plans from @playwright-test-planner
│   │   └── cypress/                          # Cypress tests
│   │       ├── cypress.config.ts             # Mochawesome JSON reporter wired in
│   │       ├── tests/                        # {app}-cy-{area}-{nn}-{desc}.cy.ts
│   │       ├── fixtures/
│   │       ├── pages/
│   │       └── support/
│   ├── intelligence/
│   │   └── .gitkeep                          # {ISSUE-KEY}-enhanced-ac.json per branch (CI)
│   ├── notimplemented/
│   │   ├── README.md
│   │   ├── _TEMPLATE.spec.ts
│   │   └── _TEMPLATE.cy.ts
│   ├── reports/
│   │   └── (report .md files — CI artifact, linked in Jira comment)
│   └── state/
│       └── .gitkeep                          # {issue-key}.state.json per branch (CI)
│
├── scripts/
│   ├── enrich-ac.js                          # CLI: AC enrichment (no build needed)
│   ├── generate-report.js                    # CLI: test execution report generator
│   ├── state.js                              # CLI: pipeline state read/write
│   ├── validate-cypress-tests.js             # Cypress compliance assertions
│   ├── validate-playwright-tests.js          # Playwright compliance assertions
│   ├── validate-fixtures.js                  # Fixture reference validation
│   └── lint-resilience.js                    # Raw cy.visit/cy.request lint
│
├── package.json                              # Single node_modules for all frameworks
└── README.md
```

---

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

---

## Failure Handling

| Failure | Behaviour |
|---------|-----------|
| OpenAI unreachable | Defaults to `IMPROVE` verdict — pipeline continues |
| OpenAI returns non-JSON | Defaults to `IMPROVE` verdict — pipeline continues |
| AC score < 3.0 (REWRITE) | Pipeline blocked, Jira moved back to "In Progress" |
| AC enrichment fails | Warning logged, pipeline continues without intelligence file |
| Jira transition fails (already in state) | HTTP 400/409 logged, pipeline continues |
| GitHub issue already exists | Existing issue reused — no duplicate created |
| PR already exists | Existing PR reused — no duplicate created |
| CI tests fail | Jira gets a FAILED comment, NOT transitioned to Done, NO PR opened |
| CI passes but no JSON artifact | Jira gets PASSED comment, Done transition uses workflow conclusion |
| No specs found in Cypress | Warning logged, workflow marked neutral, no Done transition |
| Report generation fails | Warning logged, CI continues — report artifact skipped |

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-only. Clean at all times. |
| `dev` | Active development. All commits go here. |
| `auto/test-{issue-key}` | Auto-created per Jira story by `jira-ready-for-qa.yml` |


