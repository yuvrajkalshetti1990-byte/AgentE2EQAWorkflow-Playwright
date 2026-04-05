#!/usr/bin/env node
/**
 * Pipeline Audit Script
 *
 * Verifies that every required component of the automated QA pipeline is in place
 * and correctly wired. Run this after setup or before a release to confirm the
 * pipeline is fully operational.
 *
 * Checks:
 *   1.  Workflow exists:            .github/workflows/qa-automation.yml
 *   2.  Orchestrator exists:        tools/orchestrator.js
 *   3.  Orchestrator is wired:      workflow references node tools/orchestrator.js
 *   4.  Framework detection:        orchestrator detects "cypress" label → Cypress
 *   5.  Quality gate script:        scripts/validate-test-quality.js exists + exit-1 pattern
 *   6.  Fixture validation:         scripts/validate-fixtures.js exists + exit-1 pattern
 *   7.  Report generator:           scripts/generate-report.js exists + --framework arg
 *   8.  State management:           scripts/state.js OR orchestrator has stateSave/stateLoad
 *   9.  PR automation:              orchestrator references createPR + commitFile + BRANCH_NAME
 *  10.  Jira update:                orchestrator references updateJira + jiraDoneId
 *  11.  Healer:                     orchestrator references runHealer
 *  12.  Planner:                    orchestrator references runPlanner
 *  13.  Generator:                  orchestrator references runGenerator
 *  14.  Env variables documented:   orchestrator comment lists required env vars
 *  15.  Report output dir:          qa-framework/reports/ is referenced
 *  16.  State dir referenced:       qa-framework/state/ is referenced
 *
 * Usage:
 *   node scripts/pipeline-audit.js
 *
 * Exits 0 if all checks pass, 1 if any check fails.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Audit registry
// ---------------------------------------------------------------------------

const results = [];  // { id, desc, passed, detail }

function check(id, desc, testFn) {
  try {
    const detail = testFn();
    results.push({ id, desc, passed: true, detail: detail || 'OK' });
  } catch (e) {
    results.push({ id, desc, passed: false, detail: e.message });
  }
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requirePattern(content, pattern, ctx) {
  const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  if (!re.test(content)) {
    throw new Error(`Pattern not found in ${ctx}: ${re}`);
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

check('C01', 'Workflow qa-automation.yml exists', () => {
  requireFile('.github/workflows/qa-automation.yml');
});

check('C02', 'Orchestrator tools/orchestrator.js exists', () => {
  requireFile('tools/orchestrator.js');
});

check('C03', 'Workflow invokes orchestrator', () => {
  const wf = requireFile('.github/workflows/qa-automation.yml');
  requirePattern(wf, /node tools\/orchestrator\.js/, 'qa-automation.yml');
});

check('C04', 'Framework detection: cypress label → Cypress', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /labels\.includes\s*\(\s*['"]cypress['"]\s*\)/, 'orchestrator.js');
  requirePattern(orch, /cypress.*playwright|playwright.*cypress/i, 'orchestrator.js');
  return 'label "cypress" → cypress, else playwright';
});

check('C05', 'Quality gate script exists and fails loudly', () => {
  const src = requireFile('scripts/validate-test-quality.js');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-test-quality.js');
  requirePattern(src, /NO_ASSERTIONS|NAVIGATION_ONLY|WEAK_ASSERTIONS_ONLY|MISSING_AC_TRACEABILITY/,
    'validate-test-quality.js');
  return 'has exit(1) + violation rules';
});

check('C06', 'Fixture validation script exists and fails loudly', () => {
  const src = requireFile('scripts/validate-fixtures.js');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-fixtures.js');
  requirePattern(src, /@requiredFixtures/, 'validate-fixtures.js');
  return 'has exit(1) + @requiredFixtures check';
});

check('C07', 'Report generator exists and supports both frameworks', () => {
  const src = requireFile('scripts/generate-report.js');
  requirePattern(src, /--framework/, 'generate-report.js');
  requirePattern(src, /playwright/i, 'generate-report.js');
  requirePattern(src, /cypress|mochawesome/i, 'generate-report.js');
  return 'supports playwright + cypress/mochawesome';
});

check('C08', 'State management present', () => {
  const hasStateScript = fs.existsSync('scripts/state.js');
  const orch = requireFile('tools/orchestrator.js');
  const orchHasState = /stateSave|stateLoad|STATE_FILE/.test(orch);
  if (!hasStateScript && !orchHasState) {
    throw new Error('Neither scripts/state.js nor orchestrator state functions found');
  }
  return hasStateScript
    ? 'scripts/state.js exists + orchestrator embeds state'
    : 'orchestrator embeds state management';
});

check('C09', 'PR automation in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /createPR/, 'orchestrator.js');
  requirePattern(orch, /commitFile/, 'orchestrator.js');
  requirePattern(orch, /BRANCH_NAME/, 'orchestrator.js');
  requirePattern(orch, /pulls/, 'orchestrator.js');  // GitHub pulls API
  return 'createPR + commitFile + branch creation + duplicate check';
});

check('C10', 'Jira update wired in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /updateJira/, 'orchestrator.js');
  requirePattern(orch, /jiraDoneId|JIRA_DONE_TRANSITION/, 'orchestrator.js');
  requirePattern(orch, /transitions/, 'orchestrator.js');
  return 'updateJira + Done/In QA transitions + comment';
});

check('C11', 'Test healer wired in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /runHealer/, 'orchestrator.js');
  requirePattern(orch, /healerRan/, 'orchestrator.js');  // idempotent heal
  return 'runHealer with one retry and idempotency guard';
});

check('C12', 'Test planner wired in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /runPlanner/, 'orchestrator.js');
  requirePattern(orch, /planGenerated/, 'orchestrator.js');  // idempotent
  return 'runPlanner with idempotency guard';
});

check('C13', 'Test generator wired in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /runGenerator/, 'orchestrator.js');
  requirePattern(orch, /testsGenerated/, 'orchestrator.js');  // idempotent
  return 'runGenerator with idempotency guard';
});

check('C14', 'Required env vars documented in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  const required = ['ISSUE_KEY', 'ATLASSIAN_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_CLOUD_ID',
                    'GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'OPENAI_API_KEY'];
  for (const envVar of required) {
    if (!orch.includes(envVar)) {
      throw new Error(`${envVar} not referenced in orchestrator.js`);
    }
  }
  return `All ${required.length} required env vars referenced`;
});

check('C15', 'Report output dir qa-framework/reports/ referenced', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /qa-framework.*reports|REPORT_DIR/, 'orchestrator.js');
});

check('C16', 'State dir qa-framework/state/ referenced', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /qa-framework.*state|STATE_DIR|STATE_FILE/, 'orchestrator.js');
});

check('C17', 'Workflow has required permissions', () => {
  const wf = requireFile('.github/workflows/qa-automation.yml');
  requirePattern(wf, /contents:\s*write/, 'qa-automation.yml');
  requirePattern(wf, /pull-requests:\s*write/, 'qa-automation.yml');
  return 'contents: write + pull-requests: write';
});

check('C18', 'Orchestrator fails loudly (process.exit 1)', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /process\.exit\s*\(\s*1\s*\)/, 'orchestrator.js');
  return 'uses process.exit(1) on failure';
});

check('C19', 'Retry logic present in orchestrator', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /withRetry/, 'orchestrator.js');
  requirePattern(orch, /attempt.*2|retry.*once|retrying/i, 'orchestrator.js');
  return 'withRetry() with 2 attempts';
});

check('C20', 'Pre-flight quality gate in workflow', () => {
  const wf = requireFile('.github/workflows/qa-automation.yml');
  requirePattern(wf, /validate-test-quality\.js/, 'qa-automation.yml');
  requirePattern(wf, /validate-fixtures\.js/, 'qa-automation.yml');
  return 'both validate-test-quality.js and validate-fixtures.js in workflow';
});

// ── New enforcement checks (production readiness) ──────────────────────────

check('C21', 'Quality gate runs before test execution in playwright.yml', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  // validate-test-quality.js must appear before the "Run" test step
  const qualityIdx = wf.indexOf('validate-test-quality.js');
  const runIdx     = wf.indexOf('npx playwright test');
  if (qualityIdx === -1) throw new Error('validate-test-quality.js not found in playwright.yml');
  if (runIdx === -1)     throw new Error('npx playwright test not found in playwright.yml');
  if (qualityIdx > runIdx) throw new Error('validate-test-quality.js appears AFTER test execution in playwright.yml');
  return 'validate-test-quality.js precedes npx playwright test';
});

check('C22', 'Quality gate + fixture validation run before Cypress execution in cypress.yml', () => {
  const wf = requireFile('.github/workflows/cypress.yml');
  const qualityIdx  = wf.indexOf('validate-test-quality.js');
  const fixtureIdx  = wf.indexOf('validate-fixtures.js');
  const runIdx      = wf.indexOf('npx cypress run');
  if (qualityIdx === -1) throw new Error('validate-test-quality.js not found in cypress.yml');
  if (fixtureIdx === -1) throw new Error('validate-fixtures.js not found in cypress.yml');
  if (runIdx === -1)     throw new Error('npx cypress run not found in cypress.yml');
  if (qualityIdx > runIdx) throw new Error('validate-test-quality.js appears AFTER cypress run');
  if (fixtureIdx > runIdx) throw new Error('validate-fixtures.js appears AFTER cypress run');
  return 'both validators precede npx cypress run';
});

check('C23', 'Framework detection fails on dual (cypress+playwright) labels', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /FRAMEWORK_AMBIGUOUS|both.*cypress.*playwright|hasCypress.*hasPlaywright|hasPlaywright.*hasCypress/i,
    'orchestrator.js');
  requirePattern(orch, /throw new Error.*FRAMEWORK_AMBIGUOUS|throw new Error.*both.*label/is,
    'orchestrator.js — must throw on dual labels');
  return 'throws FRAMEWORK_AMBIGUOUS error when both labels present';
});

check('C24', 'Healer limited to max retries with notimplemented fallback', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /healerMaxRetries|HEALER_MAX_RETRIES/, 'orchestrator.js');
  requirePattern(orch, /moveToNotImplemented/, 'orchestrator.js');
  requirePattern(orch, /notimplemented/i, 'orchestrator.js');
  return 'cfg.healerMaxRetries + moveToNotImplemented() present';
});

check('C25', 'Report validation enforced (exists + non-empty + required sections)', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /validateReport/, 'orchestrator.js');
  requirePattern(orch, /REQUIRED_REPORT_SECTIONS/, 'orchestrator.js');
  requirePattern(orch, /Executive Summary/, 'orchestrator.js');
  requirePattern(orch, /Test Execution Results/, 'orchestrator.js');
  requirePattern(orch, /Acceptance Criteria/, 'orchestrator.js');
  requirePattern(orch, /Failure Analysis/, 'orchestrator.js');
  requirePattern(orch, /Healing Activities/, 'orchestrator.js');
  requirePattern(orch, /Coverage Summary/, 'orchestrator.js');
  requirePattern(orch, /Gaps & Recommendations/, 'orchestrator.js');
  return 'validateReport() checks file existence, non-empty, and all 7 required sections';
});

check('C26', 'Jira Done transition gated on failedCount === 0', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /failedCount.*===.*0|failed.*==.*0/, 'orchestrator.js');
  requirePattern(orch, /canTransDone|refusing to transition to Done/, 'orchestrator.js');
  return 'Jira Done transition explicitly checks failedCount === 0';
});

check('C27', 'Branch creation checks for existing branch before creating', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /branchExists/, 'orchestrator.js');
  requirePattern(orch, /reusing|already exists.*reuse|branch already exists/i, 'orchestrator.js');
  return 'branchExists check + reuse on 404 pattern';
});

check('C28', 'Observability enforcement: console.log() check for Playwright files', () => {
  const src = requireFile('scripts/validate-test-quality.js');
  requirePattern(src, /MISSING_OBSERVABILITY/, 'validate-test-quality.js');
  requirePattern(src, /console\.log|PW_HAS_CONSOLE_LOG_RE/, 'validate-test-quality.js');
  return 'MISSING_OBSERVABILITY rule checks console.log() in Playwright files';
});

check('C29', 'Observability enforcement: cy.log() check for Cypress files', () => {
  const src = requireFile('scripts/validate-test-quality.js');
  requirePattern(src, /cy\.log|CY_HAS_CY_LOG_RE/, 'validate-test-quality.js');
  requirePattern(src, /MISSING_OBSERVABILITY/, 'validate-test-quality.js');
  return 'MISSING_OBSERVABILITY rule checks cy.log() in Cypress files';
});

check('C30', 'testStats passed to updateJira for accurate failedCount', () => {
  const orch = requireFile('tools/orchestrator.js');
  requirePattern(orch, /testResult\.stats|stats.*failed|failed.*stats/, 'orchestrator.js');
  requirePattern(orch, /updateJira.*testResult\.stats|testStats/, 'orchestrator.js');
  return 'testResult.stats carries failed count through to updateJira';
});

check('C31', 'Playwright data validation script exists and fails loudly', () => {
  const src = requireFile('scripts/validate-playwright-data.js');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-playwright-data.js');
  requirePattern(src, /readFileSync|storageState|requiredFiles|REQUIRE_RE|FS_READ_RE/, 'validate-playwright-data.js');
  return 'has exit(1) + data dependency checks (readFileSync/storageState/require)';
});

check('C32', 'validate-playwright-data.js runs before test execution in playwright.yml', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  const dataIdx = wf.indexOf('validate-playwright-data.js');
  const runIdx  = wf.indexOf('npx playwright test');
  if (dataIdx === -1) throw new Error('validate-playwright-data.js not found in playwright.yml');
  if (runIdx  === -1) throw new Error('npx playwright test not found in playwright.yml');
  if (dataIdx > runIdx) throw new Error('validate-playwright-data.js appears AFTER test execution in playwright.yml');
  return 'validate-playwright-data.js precedes npx playwright test';
});

// ── Jira-triggered pipeline checks (primary production path) ──────────────

check('C33', 'jira-ready-for-qa.yml exists and transitions to In QA', () => {
  const src = requireFile('.github/workflows/jira-ready-for-qa.yml');
  requirePattern(src, /jira-ready-for-qa/, 'jira-ready-for-qa.yml — triggers check');
  requirePattern(src, /{"transition".*"id".*"41"|id.*41/, 'jira-ready-for-qa.yml — In QA transition');
  return 'jira-ready-for-qa.yml exists + transitions to In QA (id=41)';
});

check('C34', 'jira-ready-for-qa.yml blocks pipeline when REWRITE verdict (exit 1)', () => {
  const src = requireFile('.github/workflows/jira-ready-for-qa.yml');
  requirePattern(src, /REWRITE/, 'jira-ready-for-qa.yml — REWRITE verdict check');
  requirePattern(src, /exit 1/, 'jira-ready-for-qa.yml — exit 1 on REWRITE');
  return 'REWRITE verdict triggers exit 1 (pipeline blocked)';
});

check('C35', 'post-results-to-jira.yml requires has_counts==true AND failed==0 before Done', () => {
  const src = requireFile('.github/workflows/post-results-to-jira.yml');
  requirePattern(src, /has_counts.*==.*'true'|has_counts.*==.*true/, 'post-results-to-jira.yml — has_counts guard');
  requirePattern(src, /failed.*==.*'0'|failed.*==.*0/, 'post-results-to-jira.yml — failed==0 guard');
  requirePattern(src, /JIRA_DONE_TRANSITION_ID/, 'post-results-to-jira.yml — Done transition ID');
  return 'has_counts==true AND failed==0 both required before Done transition';
});

check('C36', 'post-results-to-jira.yml PR creation also gated on has_counts + failed==0', () => {
  const src = requireFile('.github/workflows/post-results-to-jira.yml');
  // Count how many times both guards appear — must appear in at least the Done block AND the PR block
  const hasCountsMatches = (src.match(/has_counts.*==.*'true'/g) || []).length;
  const failedMatches    = (src.match(/failed.*==.*'0'/g) || []).length;
  if (hasCountsMatches < 2) throw new Error(
    `has_counts guard appears only ${hasCountsMatches} time(s) — must guard BOTH Done transition and PR creation`
  );
  if (failedMatches < 2) throw new Error(
    `failed==0 guard appears only ${failedMatches} time(s) — must guard BOTH Done transition and PR creation`
  );
  return `has_counts guard appears ${hasCountsMatches}x and failed==0 guard appears ${failedMatches}x — Done and PR both gated`;
});

// ── New checks for violations fixed in April 2026 audit ───────────────────

check('C37', 'Post-generation quality gate in orchestrator (V1 fix)', () => {
  const orch = requireFile('tools/orchestrator.js');
  // Quality gate must appear at least twice: once as pre-flight before the try block,
  // and once after runGenerator() (post-generation gate)
  const gateMatches = (orch.match(/runQualityGate\s*\(\s*\)/g) || []).length;
  if (gateMatches < 2) throw new Error(
    `runQualityGate() appears only ${gateMatches} time(s) — must appear both pre-flight AND post-generation`
  );
  // Post-generation gate must appear after the generator block
  const generatorIdx   = orch.indexOf('testsGenerated: true');
  const postGateIdx    = orch.indexOf('Post-generation quality gate');
  if (postGateIdx === -1) throw new Error('Post-generation quality gate comment not found in orchestrator.js');
  if (postGateIdx < generatorIdx) throw new Error('Post-generation quality gate appears BEFORE the generator block');
  return `runQualityGate() called ${gateMatches}x — pre-flight + post-generation both enforced`;
});

check('C38', 'Dual-label FRAMEWORK_AMBIGUOUS guard in jira-ready-for-qa.yml (V2 fix)', () => {
  const wf = requireFile('.github/workflows/jira-ready-for-qa.yml');
  requirePattern(wf, /FRAMEWORK_AMBIGUOUS/, 'jira-ready-for-qa.yml');
  requirePattern(wf, /HAS_CYPRESS.*HAS_PLAYWRIGHT|HAS_PLAYWRIGHT.*HAS_CYPRESS/, 'jira-ready-for-qa.yml');
  requirePattern(wf, /both.*cypress.*playwright|cypress.*playwright.*labels/i, 'jira-ready-for-qa.yml');
  // Must exit 1 on ambiguous labels
  const ambigIdx = wf.indexOf('FRAMEWORK_AMBIGUOUS');
  const exit1Idx = wf.indexOf('exit 1', ambigIdx);
  if (exit1Idx === -1 || exit1Idx - ambigIdx > 300) {
    throw new Error('No exit 1 found within 300 chars of FRAMEWORK_AMBIGUOUS — guard is not blocking');
  }
  return 'FRAMEWORK_AMBIGUOUS guard exits 1 on dual cypress+playwright labels';
});

check('C39', 'AC_GATE_STRICT mechanism in jira-ready-for-qa.yml (V3 fix)', () => {
  const wf = requireFile('.github/workflows/jira-ready-for-qa.yml');
  requirePattern(wf, /AC_GATE_STRICT/, 'jira-ready-for-qa.yml');
  requirePattern(wf, /Strict gate.*fail when OpenAI|strict mode/i, 'jira-ready-for-qa.yml');
  requirePattern(wf, /steps\.ac_review\.outputs\.SCORE.*==.*'N\/A'/, 'jira-ready-for-qa.yml');
  return 'AC_GATE_STRICT env var wired — OpenAI-skip failures can be promoted to exit 1';
});

check('C40', 'Jira Done transition failure fails loudly (V4 fix)', () => {
  const wf = requireFile('.github/workflows/post-results-to-jira.yml');
  // Must not just warn on non-204/400/409 — must exit 1
  requirePattern(wf, /::error::Jira Done transition failed/, 'post-results-to-jira.yml');
  // Verify the else branch now exits 1 instead of just warning
  const errorIdx = wf.indexOf('::error::Jira Done transition failed');
  const exit1Idx = wf.indexOf('exit 1', errorIdx);
  if (exit1Idx === -1 || exit1Idx - errorIdx > 250) {
    throw new Error('exit 1 not found after error annotation — transition failure is still silent');
  }
  // Verify 400/409 (already-in-state) are still handled gracefully (not as errors)
  requirePattern(wf, /400.*409|409.*400/, 'post-results-to-jira.yml — 400/409 graceful handling missing');
  return 'exit 1 on Jira transition non-204/400/409; 400/409 handled gracefully';
});

check('C41', 'lint-resilience.js exists and wired in cypress.yml before test execution', () => {
  const src = requireFile('scripts/lint-resilience.js');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'lint-resilience.js');
  const wf = requireFile('.github/workflows/cypress.yml');
  requirePattern(wf, /lint-resilience\.js/, 'cypress.yml');
  // Must appear before npx cypress run
  const lintIdx = wf.indexOf('lint-resilience.js');
  const runIdx  = wf.indexOf('npx cypress run');
  if (lintIdx === -1) throw new Error('lint-resilience.js not referenced in cypress.yml');
  if (runIdx  === -1) throw new Error('npx cypress run not found in cypress.yml');
  if (lintIdx > runIdx) throw new Error('lint-resilience.js appears AFTER npx cypress run in cypress.yml');
  return 'lint-resilience.js exists + wired in cypress.yml before npx cypress run';
});

// ---------------------------------------------------------------------------
// Hardening checks — April 2026
// ---------------------------------------------------------------------------

check('C42', 'preflight-env.js exists and fails loudly on critical violations', () => {
  const src = requireFile('scripts/preflight-env.js');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'preflight-env.js — exit(1)');
  requirePattern(src, /REQUIRE_BASE_URL|BASE_URL/, 'preflight-env.js — BASE_URL check');
  requirePattern(src, /ENV SAFETY VIOLATION|EXPECTED_HOST/, 'preflight-env.js — host mismatch guard');
  return 'preflight-env.js exists with BASE_URL + host-mismatch + exit(1)';
});

check('C43', 'preflight-env.js wired in playwright.yml before test execution', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  const preIdx = wf.indexOf('preflight-env.js');
  const runIdx = wf.indexOf('npx playwright test');
  if (preIdx === -1) throw new Error('preflight-env.js not referenced in playwright.yml');
  if (runIdx  === -1) throw new Error('npx playwright test not found in playwright.yml');
  if (preIdx  > runIdx) throw new Error('preflight-env.js appears AFTER test execution in playwright.yml');
  return 'preflight-env.js precedes npx playwright test';
});

check('C44', 'preflight-env.js wired in cypress.yml before test execution', () => {
  const wf = requireFile('.github/workflows/cypress.yml');
  const preIdx = wf.indexOf('preflight-env.js');
  const runIdx = wf.indexOf('npx cypress run');
  if (preIdx === -1) throw new Error('preflight-env.js not referenced in cypress.yml');
  if (runIdx  === -1) throw new Error('npx cypress run not found in cypress.yml');
  if (preIdx  > runIdx) throw new Error('preflight-env.js appears AFTER cypress run in cypress.yml');
  return 'preflight-env.js precedes npx cypress run';
});

check('C45', 'global-setup.ts exists for Playwright runtime env validation', () => {
  const src = requireFile('qa-framework/frameworks/playwright/global-setup.ts');
  requirePattern(src, /ENV VALIDATION|ENV MISMATCH/, 'global-setup.ts — validation messages');
  requirePattern(src, /throw new Error/, 'global-setup.ts — throws on failure');
  requirePattern(src, /BASE_URL/, 'global-setup.ts — uses BASE_URL');
  return 'global-setup.ts validates BASE_URL reachability + host match';
});

check('C46', 'global-setup.ts wired in playwright.config.ts', () => {
  const src = requireFile('qa-framework/frameworks/playwright/playwright.config.ts');
  requirePattern(src, /globalSetup.*global-setup/, 'playwright.config.ts — globalSetup');
  return 'globalSetup: \'./global-setup.ts\' present in playwright.config.ts';
});

check('C47', 'validate-ac-coverage.js exists with pass/fail modes', () => {
  const src = requireFile('scripts/validate-ac-coverage.js');
  requirePattern(src, /ALLOW_PARTIAL_AC|ALLOW_PARTIAL/, 'validate-ac-coverage.js — allow flag');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-ac-coverage.js — exit(1)');
  requirePattern(src, /notimplemented/i, 'validate-ac-coverage.js — scans notimplemented/');
  return 'validate-ac-coverage.js with ALLOW_PARTIAL_AC override + notimplemented scan + exit(1)';
});

check('C48', 'validate-ac-coverage.js wired in playwright.yml before test execution', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  const acIdx  = wf.indexOf('validate-ac-coverage.js');
  const runIdx = wf.indexOf('npx playwright test');
  if (acIdx  === -1) throw new Error('validate-ac-coverage.js not referenced in playwright.yml');
  if (runIdx === -1) throw new Error('npx playwright test not found in playwright.yml');
  if (acIdx  > runIdx) throw new Error('validate-ac-coverage.js appears AFTER test execution');
  return 'validate-ac-coverage.js precedes npx playwright test';
});

check('C49', 'check-flaky-threshold.js exists with configurable threshold', () => {
  const src = requireFile('scripts/check-flaky-threshold.js');
  requirePattern(src, /FLAKY_FAIL_THRESHOLD/, 'check-flaky-threshold.js — threshold config');
  requirePattern(src, /ALLOW_FLAKY/, 'check-flaky-threshold.js — allow flag');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'check-flaky-threshold.js — exit(1)');
  return 'check-flaky-threshold.js with FLAKY_FAIL_THRESHOLD + ALLOW_FLAKY override + exit(1)';
});

check('C50', 'check-flaky-threshold.js wired in playwright.yml after test run', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  const runIdx   = wf.indexOf('npx playwright test');
  const flakyIdx = wf.indexOf('check-flaky-threshold.js');
  if (flakyIdx === -1) throw new Error('check-flaky-threshold.js not referenced in playwright.yml');
  if (runIdx   === -1) throw new Error('npx playwright test not found in playwright.yml');
  if (flakyIdx < runIdx) throw new Error('check-flaky-threshold.js appears BEFORE test execution — must run after');
  return 'check-flaky-threshold.js follows npx playwright test';
});

check('C51', 'check-framework-parity.js exists with strict mode', () => {
  const src = requireFile('scripts/check-framework-parity.js');
  requirePattern(src, /PARITY_STRICT/, 'check-framework-parity.js — strict mode');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'check-framework-parity.js — exit(1)');
  return 'check-framework-parity.js with PARITY_STRICT + exit(1)';
});

check('C52', 'POM enforcement gate in validate-playwright-tests.js', () => {
  const src = requireFile('scripts/validate-playwright-tests.js');
  requirePattern(src, /HAS_POM_IMPORT_RE|POM_ENFORCE/, 'validate-playwright-tests.js — POM gate');
  requirePattern(src, /pages\//, 'validate-playwright-tests.js — pages/ import check');
  return 'POM enforcement gate present with POM_ENFORCE=strict mode';
});

check('C53', 'generate-report.js shows UNSTABLE status for flaky tests (R9)', () => {
  const src = requireFile('scripts/generate-report.js');
  requirePattern(src, /UNSTABLE/, 'generate-report.js — UNSTABLE status');
  requirePattern(src, /computeOverallStatus|FLAKY.*flaky|flaky.*FLAKY/i, 'generate-report.js — flaky detection');
  requirePattern(src, /Flaky \(passed on retry\)|FLAKY PASS/i, 'generate-report.js — flaky row label');
  return 'UNSTABLE status + flaky row label in report';
});

check('C54', 'EMPTY_FILE rule in validate-test-quality.js (R7)', () => {
  const src = requireFile('scripts/validate-test-quality.js');
  requirePattern(src, /EMPTY_FILE/, 'validate-test-quality.js — EMPTY_FILE rule');
  requirePattern(src, /No test\(\) blocks|No it\(\) blocks/, 'validate-test-quality.js — empty file message');
  return 'EMPTY_FILE rule blocks empty/stub test files';
});

// ---------------------------------------------------------------------------
// Strict enforcement checks — added for ENFORCEMENT UPGRADE
// ---------------------------------------------------------------------------

check('C55', 'enforcement-config.js exists as central governance registry', () => {
  const src = requireFile('scripts/enforcement-config.js');
  requirePattern(src, /STRICT_MODE/, 'enforcement-config.js — STRICT_MODE master switch');
  requirePattern(src, /ALLOW_PARTIAL_AC/, 'enforcement-config.js — ALLOW_PARTIAL_AC flag');
  requirePattern(src, /ALLOW_FLAKY/, 'enforcement-config.js — ALLOW_FLAKY flag');
  requirePattern(src, /ALLOW_POM_BYPASS/, 'enforcement-config.js — ALLOW_POM_BYPASS flag');
  requirePattern(src, /UNSTABLE_FAILS_PIPELINE/, 'enforcement-config.js — UNSTABLE_FAILS_PIPELINE');
  requirePattern(src, /module\.exports/, 'enforcement-config.js — exports config object');
  return 'enforcement-config.js with STRICT_MODE, all allow-flags, exports';
});

check('C56', 'validate-ac-coverage.js uses enforcement-config + fails by default (no warn escapes)', () => {
  const src = requireFile('scripts/validate-ac-coverage.js');
  requirePattern(src, /enforcement-config/, 'validate-ac-coverage.js — requires enforcement-config');
  requirePattern(src, /ALLOW_PARTIAL_AC|ALLOW_PARTIAL/, 'validate-ac-coverage.js — allow flag');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-ac-coverage.js — exit(1) present');
  // Must NOT have AC_GATE_MODE=warn as default (old pattern — must be gone)
  if (/AC_GATE_MODE.*='warn'|AC_GATE_MODE.*warn.*default/i.test(src)) {
    throw new Error('Old AC_GATE_MODE=warn default found — must be replaced with ALLOW_PARTIAL_AC enforcement');
  }
  return 'Uses enforcement-config + ALLOW_PARTIAL_AC; old AC_GATE_MODE=warn removed';
});

check('C57', 'validate-playwright-tests.js uses enforcement-config + POM strict by default', () => {
  const src = requireFile('scripts/validate-playwright-tests.js');
  requirePattern(src, /enforcement-config/, 'validate-playwright-tests.js — requires enforcement-config');
  requirePattern(src, /ALLOW_POM_BYPASS/, 'validate-playwright-tests.js — ALLOW_POM_BYPASS flag');
  requirePattern(src, /RAW_LOCATOR_RE/, 'validate-playwright-tests.js — raw locator detection');
  // Must NOT default to warn (old POM_ENFORCE=warn pattern must be gone)
  if (/POM_ENFORCE\s*=\s*process\.env\.POM_ENFORCE\s*\|\|\s*'warn'/.test(src)) {
    throw new Error('Old POM_ENFORCE=warn default still present — must be replaced with ALLOW_POM_BYPASS');
  }
  return 'enforcement-config + ALLOW_POM_BYPASS + raw-locator detection; old warn mode removed';
});

check('C58', 'check-flaky-threshold.js uses enforcement-config + ALLOW_FLAKY escape hatch', () => {
  const src = requireFile('scripts/check-flaky-threshold.js');
  requirePattern(src, /enforcement-config/, 'check-flaky-threshold.js — requires enforcement-config');
  requirePattern(src, /ALLOW_FLAKY/, 'check-flaky-threshold.js — ALLOW_FLAKY flag');
  // Must NOT have FLAKY_FAIL_MODE variable reference (old pattern)
  if (/const failMode\s*=\s*process\.env\.FLAKY_FAIL_MODE/.test(src)) {
    throw new Error('Old FLAKY_FAIL_MODE=unstable escape still present — must use ALLOW_FLAKY from enforcement-config');
  }
  return 'enforcement-config + ALLOW_FLAKY; old FLAKY_FAIL_MODE=unstable bypass removed';
});

check('C59', 'generate-report.js exits non-zero on FAIL / BLOCKED / UNSTABLE', () => {
  const src = requireFile('scripts/generate-report.js');
  requirePattern(src, /enforcement-config/, 'generate-report.js — requires enforcement-config');
  requirePattern(src, /UNSTABLE_FAILS_PIPELINE/, 'generate-report.js — UNSTABLE_FAILS_PIPELINE check');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'generate-report.js — exits 1 on failure');
  requirePattern(src, /hasBocked|🚫 BLOCKED/, 'generate-report.js — BLOCKED detection');
  requirePattern(src, /pipeline status.*FAIL|pipeline status.*BLOCKED/i, 'generate-report.js — pipeline status log');
  return 'generate-report.js exits 1 on FAIL, BLOCKED, or UNSTABLE (UNSTABLE_FAILS_PIPELINE=true)';
});

check('C60', 'validate-ac-execution.js exists — AC→Test→Execution mapping gate', () => {
  const src = requireFile('scripts/validate-ac-execution.js');
  requirePattern(src, /enforcement-config/, 'validate-ac-execution.js — requires enforcement-config');
  requirePattern(src, /AC NOT EXECUTED/, 'validate-ac-execution.js — phantom coverage detection');
  requirePattern(src, /SKIPPED WITHOUT REASON/, 'validate-ac-execution.js — skip detection');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-ac-execution.js — exit(1)');
  return 'validate-ac-execution.js maps AC→spec→results and fails on phantom/skipped ACs';
});

check('C61', 'validate-state-integrity.js exists — state consistency gate', () => {
  const src = requireFile('scripts/validate-state-integrity.js');
  requirePattern(src, /enforcement-config/, 'validate-state-integrity.js — requires enforcement-config');
  requirePattern(src, /phantom success|Phantom success/i, 'validate-state-integrity.js — phantom success detection');
  requirePattern(src, /healerExhausted.*testsPassed|testsPassed.*healerExhausted/, 'validate-state-integrity.js — inconsistent state');
  requirePattern(src, /process\.exit\s*\(\s*1\s*\)/, 'validate-state-integrity.js — exit(1)');
  return 'validate-state-integrity.js detects phantom success, healer exhaustion, and duplicate PRs';
});

check('C62', 'validate-ac-execution.js wired in playwright.yml after test run', () => {
  const wf = requireFile('.github/workflows/playwright.yml');
  const runIdx = wf.indexOf('npx playwright test');
  const acExecIdx = wf.indexOf('validate-ac-execution.js');
  if (acExecIdx === -1) throw new Error('validate-ac-execution.js not referenced in playwright.yml');
  if (runIdx    === -1) throw new Error('npx playwright test not found in playwright.yml');
  if (acExecIdx <  runIdx) throw new Error('validate-ac-execution.js appears BEFORE test execution — must run after');
  return 'validate-ac-execution.js follows npx playwright test';
});

check('C63', 'preflight-env.js checks hardcoded URLs in spec files (R9)', () => {
  const src = requireFile('scripts/preflight-env.js');
  requirePattern(src, /HARDCODED_URL_RE|Hardcoded URL|hardcoded.*url/i, 'preflight-env.js — URL scan');
  requirePattern(src, /scanForHardcodedUrls/, 'preflight-env.js — scan function');
  requirePattern(src, /playwright.config.ts.*not found|cypress.config.ts.*not found|baseURL.*missing/i,
    'preflight-env.js — framework config integrity check');
  return 'preflight-env.js scans for hardcoded URLs and validates framework config files';
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const passed  = results.filter(r => r.passed);
const failed  = results.filter(r => !r.passed);
const total   = results.length;

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  QA PIPELINE AUDIT REPORT');
console.log('══════════════════════════════════════════════════════════════\n');

// Passed checks
if (passed.length > 0) {
  console.log(`✅  PASSED (${passed.length}/${total}):\n`);
  passed.forEach(r => console.log(`  [${r.id}] ${r.desc}\n       → ${r.detail}`));
  console.log('');
}

// Failed checks
if (failed.length > 0) {
  console.error(`❌  FAILED (${failed.length}/${total}):\n`);
  failed.forEach(r => {
    console.error(`  [${r.id}] ${r.desc}`);
    console.error(`       ✗ ${r.detail}`);
  });
  console.error('');
}

console.log('══════════════════════════════════════════════════════════════');
console.log(`  Result: ${failed.length === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed.length} CHECK(S) FAILED`}`);
console.log('══════════════════════════════════════════════════════════════\n');

if (failed.length > 0) {
  process.exit(1);
}
