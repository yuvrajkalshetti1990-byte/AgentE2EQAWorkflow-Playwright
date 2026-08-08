# E2E Agentic QA Pipeline

A **human-supervised agentic** QA automation pipeline: Jira "Ready for QA" → AC review → AC enrichment → generated tests → CI execution → test report → Jira "Done" → PR.

Every step between agents is automated. **Every handoff between agents requires a human approval.**
An agent may propose; only a human may let the pipeline advance to the next agent.

| | |
|---|---|
| **Agents do** | Score ACs, enrich ACs, plan tests, write tests, heal failures |
| **Deterministic scripts do** | Enforce quality — assertions, traceability, POM compliance, data integrity |
| **Humans do** | Approve each agent handoff at three gates |

> **Gates are enforced by GitHub Environment protection rules**, not by application code.
> If the environments are not configured (see [Approval Gates](#human-in-the-loop-approval-gates)),
> every gate passes straight through and the pipeline runs fully automated exactly as it did before.

---

## Pipeline Flow (end-to-end)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Jira story transitions → "Ready for QA"                                 │
│     Jira Automation Rule fires a POST to GitHub repository_dispatch         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  jira-ready-for-qa.yml  ·  job: review_acs        AGENT 1 — AC REVIEWER      │
│                                                                             │
│  Step 1  │ Load pipeline state (idempotency check)                          │
│  Step 2  │ Fetch Jira story (summary, status, labels, description)          │
│  Step 3  │ Detect framework: "cypress" label → Cypress, else → Playwright   │
│  Step 4  │ Review ACs via OpenAI gpt-4o-mini (score 1-5, per-dimension)     │
│  Step 5  │ Post AC review comment to Jira (Activity tab)                    │
│  Step 6  │ REWRITE or IMPROVE → OpenAI generates improved ACs → posted      │
│          │   to Jira comment → story moved back to "In Progress" → STOP     │
│  Step 7  │ Write GATE 1 briefing to the run summary                         │
│                                                                             │
│  Read-only on the repository. No branch, no issue, no commit.               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
        ╔════════════════════════════════════════════════════════════╗
        ║  🚦 GATE 1 — HUMAN APPROVAL   env: ac-approval             ║
        ║                                                            ║
        ║  Reviewer sees: AC score, verdict, issues, suggestions      ║
        ║  Approve → enrich ACs + hand off to Copilot                ║
        ║  Reject  → pipeline stops. No branch, no issue, no tests.  ║
        ╚════════════════════════════════════╤═══════════════════════╝
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  jira-ready-for-qa.yml  ·  job: generate_tests   AGENT 2 — GENERATION HANDOFF│
│                                                                             │
│  Step 8  │ Enrich ACs (Test Intelligence Layer) →                           │
│          │   builds assertionHints, edgeCases, suggestedTitles              │
│          │   writes qa-framework/intelligence/{key}-enhanced-ac.json        │
│  Step 9  │ Create branch auto/test-{issue-key}  (idempotent)                │
│  Step 10 │ Create GitHub Issue with test instructions + Intelligence Note   │
│  Step 11 │ Assign Copilot to that GitHub Issue                              │
│  Step 12 │ Persist pipeline state + intelligence file to feature branch     │
│  Step 13 │ Transition Jira → "In QA"  (resilient: 400/409 = already there)  │
│  Step 14 │ Post Jira comment + dispatch cypress.yml OR playwright.yml       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Copilot Coding Agent (GitHub Issue assigned to Copilot)  AGENT 3 — WRITER   │
│                                                                             │
│  • Reads the GitHub Issue instructions                                      │
│  • Reads qa-framework/intelligence/{key}-enhanced-ac.json (if present)      │
│    → uses suggestedTestTitle, assertionHints, edgeCases per AC              │
│  • Uses @playwright-test-planner or @cypress-test-planner for test plan     │
│  • Generates one test per AC (ACs with verdict=REWRITE → skip)              │
│  • Non-automatable ACs → stubs in qa-framework/notimplemented/              │
│  • Commits + pushes to auto/test-{issue-key}                                │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ push triggers CI workflow automatically
                                ▼
        ╔════════════════════════════════════════════════════════════╗
        ║  🚦 GATE 2 — HUMAN APPROVAL   env: test-approval           ║
        ║                                                            ║
        ║  Reviewer reads the tests Copilot wrote on auto/test-*      ║
        ║  Approve → tests execute in CI                             ║
        ║  Reject  → no browser is ever launched                     ║
        ║                                                            ║
        ║  Scoped to auto/test-* only — dev/main pushes run ungated. ║
        ╚════════════════════════════════════╤═══════════════════════╝
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  playwright.yml  OR  cypress.yml                                            │
│                                                                             │
│  • npm ci + install browsers / Cypress binary                               │
│  • TypeScript compilation check + compliance validation                     │
│  • Count runnable specs (excludes *.notimplemented.* stubs)                 │
│  • Run tests (Playwright: results.json | Cypress: mochawesome.json)         │
│  • Generate test execution report → qa-framework/reports/{key}-report.md    │
│  • Upload: JSON results + HTML/video + report artifacts                     │
│  • Always runs to completion — never exits before uploading artifacts       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ workflow_run: completed
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  post-results-to-jira.yml  ·  job: report_to_jira        (NEVER GATED)      │
│                                                                             │
│  • Download *-test-results-json artifact                                    │
│  • Parse results.json (Playwright) OR mochawesome.json (Cypress)            │
│  • Post result comment to Jira (passed/failed/skipped + report link)        │
│  • Write GATE 3 briefing to the run summary                                 │
│                                                                             │
│  Results reach Jira whether or not anyone approves. Reporting is            │
│  information, not a state change — it is deliberately never gated.          │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ only if: CI success AND failed==0
                                │          AND results artifact present
                                ▼
        ╔════════════════════════════════════════════════════════════╗
        ║  🚦 GATE 3 — HUMAN APPROVAL   env: release-approval        ║
        ║                                                            ║
        ║  Reviewer sees: pass/fail counts, artifact presence         ║
        ║  Approve → Jira "Done" + PR opened into dev                ║
        ║  Reject  → story stays In QA, no PR                        ║
        ║                                                            ║
        ║  A failing run never reaches this gate — nobody is paged.  ║
        ╚════════════════════════════════════╤═══════════════════════╝
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  post-results-to-jira.yml  ·  job: promote                                  │
│                                                                             │
│  • Transition Jira → "Done"                                                 │
│  • Open PR: auto/test-{key} → dev  (idempotent — skip if PR exists)         │
│                                                                             │
│  The only job in the pipeline that changes external state on success.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Human-in-the-Loop Approval Gates

Each agent hands off to the next only after a human approves. The pipeline pauses at
three points, and a reviewer decides whether it advances.

| Gate | Environment | Pauses before | Approving means | Rejecting means |
|------|-------------|---------------|-----------------|-----------------|
| **GATE 1** | `ac-approval` | AC enrichment + Copilot handoff | Branch created, ACs enriched, Copilot assigned | Nothing is created — no branch, no issue, no tests |
| **GATE 2** | `test-approval` | Executing agent-written tests | Tests run in CI | No browser is launched |
| **GATE 3** | `release-approval` | Jira "Done" + PR creation | Story marked Done, PR opened into `dev` | Story stays In QA, no PR |

### How it works

Gates are **GitHub Environment protection rules** — a native platform feature, not
application code. A job that references a protected environment pauses; GitHub notifies
the required reviewers, who click **Approve** or **Reject** in the Actions run UI.

Because the mechanism is the platform's, there is no polling loop, no webhook listener,
and no approval state to persist. There is also nothing to bypass: a job cannot start
until the deployment is approved.

### What the reviewer sees

Each gate is preceded by a **briefing** written to the run summary — approving blind
would make the gate a rubber stamp rather than a decision point.

- **GATE 1 briefing** — AC score, verdict, the issues the reviewer agent raised, and its suggestions
- **GATE 2 briefing** — branch name and a direct link to the generated test files
- **GATE 3 briefing** — pass/fail/total counts and whether the results artifact was actually found

### Setup

For each of `ac-approval`, `test-approval`, `release-approval`:

1. **Settings → Environments → New environment**
2. Name it exactly as above
3. Tick **Required reviewers** → add the QA lead(s) → **Save**

> **Until an environment has a Required reviewers rule, its gate passes straight
> through.** The pipeline then behaves exactly as it did before gates existed —
> fully automated. This is deliberate: the repo stays runnable by anyone who clones
> it, and gates are opt-in per environment.

### Design notes

- **Reporting is never gated.** Test results reach Jira whether or not anyone approves.
  Withholding information from the team helps nobody — only *state changes* are gated.
- **A failing run never reaches GATE 3.** The gate's own `if:` requires CI success,
  zero failures, and a present results artifact. Reviewers are only asked about
  releases that are actually releasable.
- **GATE 2 is scoped to `auto/test-*` branches.** Ordinary pushes to `dev` and `main`
  are human commits and run unguarded, exactly as before.
- **A skipped gate is not a failed gate.** When GATE 2 is out of scope it is *skipped*,
  and the test job uses `!cancelled() && needs.approve_tests.result != 'failure'` so a
  skip passes through while an explicit rejection still blocks.
- **The AC verdict block still applies.** A `REWRITE` / `IMPROVE` verdict fails the AC
  reviewer job outright, so GATE 1 is never reached and no reviewer is paged for a story
  the machine already rejected. If you would rather a human overrule that verdict, remove
  the `Block pipeline...` step and let GATE 1 be the sole decision point.

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

### 5. Approval Gate Environments

Create three environments under **Settings → Environments**, each with **Required reviewers**:

| Environment | Gates |
|-------------|-------|
| `ac-approval` | AC review → test generation |
| `test-approval` | Generated tests → CI execution |
| `release-approval` | CI pass → Jira Done + PR |

Environment protection rules are free on public repositories, and on GitHub Pro / Team /
Enterprise for private ones. See [Approval Gates](#human-in-the-loop-approval-gates) for
what each gate does and what happens if you skip this step.

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

Sections: Executive Summary · Test Execution Results · Acceptance Criteria Coverage · Failure Analysis · Healing Activities · Test Coverage Summary · Gaps & Recommendations

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
| **Quality gate** | `validate-test-quality.js` runs **blocking** (no try/catch) before any test execution AND again post-generation — failure hard-exits the pipeline at either stage |
| **Healer scope** | Healer only patches files explicitly named in the failure output — passing tests are never touched |
| **Healer max retries** | `HEALER_MAX_RETRIES` (default: 2) — after exhausting retries, file is moved to `notimplemented/` |
| **Healer context** | Healer receives real stdout+stderr from the failed test run — not an empty string |
| **PR gate** | PR is created **only** when `testResult.passed === true` AND `failedCount === 0` — never on test failure |
| **Report validation** | Report must exist, be non-empty, and contain all 7 sections: Executive Summary, Test Execution Results, Acceptance Criteria, Failure Analysis, Healing Activities, Coverage Summary, Gaps & Recommendations |
| **Report self-validation** | `generate-report.js` validates its own output before exit — exits 1 if any section is missing |
| **Jira Done gate** | Transition to Done **only** when `passed=true` AND `failedCount === 0` |
| **Jira Done artifact gate** | `post-results-to-jira.yml` additionally requires `has_counts == 'true'` — no Done if test artifact is missing |
| **Branch safety** | Existing branch is reused instead of re-created — verified before committing |
| **Dual pipeline guard** | `qa-automation.yml` orchestrator checks if `auto/test-{key}` branch already exists — if yes, exits 0 (yields to primary Jira pipeline) |
| **Concurrency guard** | `qa-automation.yml` has a `concurrency:` group scoped to issue number — prevents parallel runs for same issue |
| **SCRUM-16 exemption** | Learning/exploration tests under `SCRUM-16-*` are exempt from AC traceability rules |
| **AC_GATE_STRICT** | Set repo variable `AC_GATE_STRICT=true` (Settings → Variables) to promote OpenAI API unavailability to a hard pipeline block — default `false` allows soft-fail with `IMPROVE` verdict |
| **GATE 1 — agent isolation** | The AC reviewer job runs with `contents: read` and creates nothing. Every repository side effect lives in the post-gate `generate_tests` job, so rejecting GATE 1 leaves no residue to clean up |
| **GATE 2 — scope** | Gated only on `auto/test-*`. Human commits to `dev`/`main` are never blocked on an approval |
| **GATE 3 — reachability** | Gate `if:` requires CI success AND `failed == 0` AND `has_counts == true` — a failing run never pages a reviewer |
| **Gate bypass detection** | `pipeline-audit.js` C64–C66 fail if any gate job is removed or is no longer referenced by `needs:` |

### Pipeline audit

Run at any time to verify all components are wired:

```bash
node scripts/pipeline-audit.js
```

Currently checks **66 conditions (C01–C66)**. Exits 1 if any fail.

> C31 verifies `scripts/validate-playwright-data.js` exists and has blocking exit(1).  
> C32 verifies it runs before `npx playwright test` in `playwright.yml`.  
> C33 verifies `jira-ready-for-qa.yml` transitions to In QA (id=41).  
> C34 verifies REWRITE or IMPROVE verdict triggers exit 1 and moves story back to In Progress.  
> C35 verifies `post-results-to-jira.yml` requires `has_counts==true` AND `failed==0` before Done.  
> C36 verifies both the Done transition AND the PR creation step are guarded by those conditions.  
> C37 verifies quality gate runs both pre-flight AND post-generation in the orchestrator.  
> C38 verifies dual-label `FRAMEWORK_AMBIGUOUS` guard in `jira-ready-for-qa.yml` exits 1.  
> C39 verifies `AC_GATE_STRICT` mechanism is wired in `jira-ready-for-qa.yml`.  
> C40 verifies Jira Done transition failure fails loudly (exit 1, not just a warning).  
> C41 verifies `lint-resilience.js` is wired in `cypress.yml` before test execution.  
> C64 verifies GATE 1 (`ac-approval`) sits between the AC reviewer and test generation.  
> C65 verifies GATE 2 (`test-approval`) blocks test execution in both CI workflows, is scoped to `auto/test-*`, and that a skipped gate does not skip the test job.  
> C66 verifies GATE 3 (`release-approval`) guards the Jira Done transition and PR creation.

> **Why gates are audited:** the protection rule itself lives in repo settings, not in git,
> so the audit cannot prove a reviewer is configured. What it *can* prove is that the gate
> job still exists and is still referenced by `needs:` — a gate job left in place but no
> longer depended upon is a silently bypassed gate, which is exactly the regression C64–C66
> are there to catch.

---



State is tracked per branch as `qa-framework/state/{issue-key}.state.json` (committed to the feature branch).

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
│   │   ├── qa-automation.yml                 # Standalone pipeline (GitHub issue trigger)
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
│   ├── pipeline-audit.js                     # CLI: 41-check pipeline integrity audit
│   ├── validate-test-quality.js              # Assertions, AC traceability, observability gate
│   ├── validate-playwright-data.js           # Pre-flight data file existence gate
│   ├── validate-cypress-tests.js             # Cypress compliance assertions
│   ├── validate-playwright-tests.js          # Playwright compliance assertions
│   ├── validate-fixtures.js                  # Fixture reference validation
│   └── lint-resilience.js                    # Raw cy.visit/cy.request lint
│
├── tools/
│   └── orchestrator.js                       # Standalone end-to-end pipeline orchestrator
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
| OpenAI unreachable | Defaults to `IMPROVE` verdict — pipeline **blocked**, Jira moved back to "In Progress" |
| OpenAI returns non-JSON | Defaults to `IMPROVE` verdict — pipeline **blocked**, Jira moved back to "In Progress" |
| AC verdict REWRITE or IMPROVE | Pipeline blocked, improved ACs generated and posted to Jira comment, story moved back to "In Progress" |
| AC enrichment fails | Warning logged, pipeline continues without intelligence file |
| Jira transition fails (already in state) | HTTP 400/409 logged, pipeline continues |
| GitHub issue already exists | Existing issue reused — no duplicate created |
| PR already exists | Existing PR reused — no duplicate created |
| CI tests fail | Jira gets a FAILED comment, NOT transitioned to Done, NO PR opened |
| CI passes but no JSON artifact | Jira gets PASSED comment, Done transition **blocked** (`has_counts==false`) — story stays In QA, no PR created |
| No specs found in Cypress | Warning logged, workflow marked neutral, no Done transition |
| Report generation fails | Warning logged, CI continues — report artifact skipped |
| **GATE 1 rejected** | Pipeline stops before enrichment. No branch, no GitHub Issue, no Copilot assignment. Jira stays in its current status |
| **GATE 2 rejected** | Tests are never executed. No results, so `post-results-to-jira.yml` has nothing to report |
| **GATE 3 rejected** | Jira comment with results is already posted. Story stays In QA, no Done transition, no PR |
| **Gate reviewer never responds** | Run waits until the environment's timer expires (default: no timeout — waits indefinitely), then the run is cancelled |
| **Environment has no reviewers configured** | Gate passes through automatically — pipeline runs fully automated |

---

## Limitations & Next Steps

Every agent handoff is human-approved; the PR into `dev` remains a further human
checkpoint. The following are known gaps, listed so anyone evaluating or extending this
system knows where the edges are.

### Known limitations

| Area | Limitation | Impact |
|------|-----------|--------|
| **AC scoring** | No evaluation set. The rubric runs at `temperature: 0` for reproducibility, but scoring accuracy has never been measured against human-labelled ACs. | A misscored AC either blocks a good story or admits a weak one. The gate is deliberately conservative — below 4.0 blocks — so errors fail toward extra review rather than bad tests. GATE 1 now gives a human the final say. |
| **Jira coupling** | Status transition IDs are hardcoded in the workflows. | The pipeline breaks on any Jira project whose workflow uses different IDs. |
| **Healer context** | The healer receives only the first 3000 characters of failure output. | Failures whose root cause appears late in a long trace may be misdiagnosed, burning both retry attempts before quarantine. |
| **Prompt injection** | Jira summary, description, and AC text flow directly into LLM prompts with no sanitisation. | A crafted ticket could attempt to steer the AC reviewer or test generator. Blast radius is limited by the deterministic validators and now by GATE 1 and GATE 2, but the input path itself is still untrusted. |
| **Duplicated orchestration** | The GitHub Actions path and `tools/orchestrator.js` implement the same pipeline twice. | Guards must be added in two places. `orchestrator.js` has **no approval gates** — it is the local/portable path and runs fully autonomously. |
| **Pinned agent models** | `.github/agents/*.agent.md` pin a fixed model version. | Prompts have not been re-benchmarked against current model generations. |
| **Single-app coverage** | Tests target SauceDemo, DemoQA, and the-internet.herokuapp.com. | Proven against stable public demo sites, not an application with real auth, real data setup, or real flakiness. |
| **No cost controls** | LLM calls have no per-run token budget or spend ceiling. | A story with many ACs, plus healer retries, has unbounded cost. |
| **Gate fatigue** | Three approvals per story. | At volume, reviewers rubber-stamp. The briefings mitigate this but do not solve it — see next steps. |

### Next steps, in priority order

1. **Build an AC evaluation set.** 30–50 hand-labelled acceptance criteria with expected
   verdicts, run as a regression check whenever the rubric, prompt, or model changes.
   Without it, every prompt change is unverified.
2. **Auto-approve low-risk gates.** Let GATE 2 pass automatically when the AC score is
   ≥ 4.5 and every validator passed, reserving human attention for the ambiguous cases.
   Gate fatigue is the main threat to this design's usefulness.
3. **Resolve Jira transition IDs at runtime** via `GET /rest/api/3/issue/{key}/transitions`,
   removing the hardcoded IDs.
4. **Collapse the duplicated orchestration** — have the workflows invoke
   `tools/orchestrator.js` rather than reimplementing each step in YAML.
5. **Sanitise LLM input.** Delimit and escape Jira-sourced text; add an instruction-injection
   check before the AC reviewer call.
6. **Add token budgets and spend telemetry** per run, with a hard ceiling that fails closed.
7. **Widen healer context** — pass structured failure data (error type, failing assertion,
   selector) instead of a truncated string.
8. **Prove it against a real application** with authentication, seeded test data, and
   genuine flakiness.

### Design principles

Stated explicitly so extensions do not violate them:

- **LLM proposes, code disposes, human decides.** Every LLM output crosses a deterministic
  validator, and every agent handoff crosses a human gate.
- **Fail closed.** LLM unreachable, results artifact missing, ambiguous framework label —
  all block. The default is stop, not proceed.
- **Bounded autonomy.** The healer gets a fixed number of attempts and a terminal state
  (`notimplemented/`), and only modifies files named in the failure output.
- **Gate state changes, never information.** Test results reach Jira unconditionally.
  Only actions that change external state require approval.
- **Every side effect is idempotent.** Branches, issues, PRs, and Jira transitions are all
  checked before creation. Re-running for the same story is safe.
- **No silent skips.** Work that cannot be automated becomes a visible artifact with a
  recorded reason, never an omission.

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-only. Clean at all times. |
| `dev` | Active development. All commits go here. |
| `auto/test-{issue-key}` | Auto-created per Jira story by `jira-ready-for-qa.yml` |


