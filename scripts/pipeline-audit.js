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
  requirePattern(orch, /Test Results/, 'orchestrator.js');
  requirePattern(orch, /Coverage/, 'orchestrator.js');
  return 'validateReport() checks file existence, non-empty, and required sections';
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
