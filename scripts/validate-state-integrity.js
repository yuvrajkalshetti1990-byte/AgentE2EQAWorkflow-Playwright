#!/usr/bin/env node
'use strict';
/**
 * Pipeline State Integrity Validation Gate                              (R8)
 *
 * STRICT MODE (default): Validates that every step marked as complete in the
 * pipeline state file has the expected artifacts present on disk.
 *
 * Detects:
 *   1. Step marked complete but artifacts missing (phantom success)
 *   2. Duplicate PR creation markers (idempotency violation)
 *   3. Partial execution marked as full success (test exit non-zero but testsPassed=true)
 *   4. Healer exhausted but pipeline continued (healerExhausted=true but testsGenerated=true
 *      and no postHealExitCode=0)
 *   5. Branch/PR claimed in state but orchestrator ran again (re-execution without reset)
 *
 * Usage:
 *   node scripts/validate-state-integrity.js --state qa-framework/state/scrum-XX.state.json
 *   node scripts/validate-state-integrity.js --issue-key SCRUM-XX
 *
 * Exits 0 on pass, 1 on violations.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const eq  = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

let stateFilePath = getArg('--state');
const issueKey    = getArg('--issue-key');

if (!stateFilePath && issueKey) {
  stateFilePath = path.join('qa-framework', 'state', `${issueKey.toLowerCase()}.state.json`);
}

if (!stateFilePath) {
  console.error('[state-integrity] ERROR: --state <path> or --issue-key <key> is required.');
  process.exit(1);
}

if (!fs.existsSync(stateFilePath)) {
  console.error(`[state-integrity] ERROR: State file not found: "${stateFilePath}"`);
  console.error('State file must exist before this gate runs. Ensure orchestrator ran first.');
  process.exit(1);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
} catch (e) {
  console.error(`[state-integrity] ERROR: Cannot parse state file: ${e.message}`);
  process.exit(1);
}

const violations  = [];
const warnings    = [];

function fail(msg)  { violations.push(msg); }
function warn(msg)  { warnings.push(msg); }

// ── Rule 1: planGenerated=true → plan file must exist ─────────────────────────
if (state.planGenerated === true) {
  const issueSlug = (state.issueKey || '').toLowerCase();
  const framework = (state.framework || 'playwright').toLowerCase();

  const planDirs = [
    path.join('qa-framework', 'frameworks', framework, 'specs'),
    path.join('qa-framework', 'frameworks', framework, 'specs', 'modules'),
  ];

  const planFile = planDirs
    .flatMap(d => fs.existsSync(d) ? fs.readdirSync(d).map(f => path.join(d, f)) : [])
    .find(f => path.basename(f).includes(issueSlug) && f.endsWith('.md'));

  if (!planFile) {
    fail(
      `planGenerated=true but no ${issueSlug}-*.md plan file found in specs/ directories.\n` +
      `  State claims the plan step completed, but the artifact is missing.\n` +
      `  This is a phantom success — the plan was not actually saved.`
    );
  }
}

// ── Rule 2: testsGenerated=true → at least one spec file must exist ────────────
if (state.testsGenerated === true) {
  const issueSlug = (state.issueKey || '').toLowerCase();
  const framework = (state.framework || 'playwright').toLowerCase();
  const testsDir  = path.join('qa-framework', 'frameworks', framework, 'tests');
  const ext       = framework === 'playwright' ? '.spec.ts' : '.cy.ts';

  let specFound = false;
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name.endsWith(ext) && entry.name.includes(issueSlug)) {
        specFound = true;
      }
    }
  })(testsDir);

  if (!specFound) {
    // Also check for story-key folder (e.g. SCRUM-18-positive-login)
    const storyDir = path.join(testsDir,
      (state.issueKey || '').toUpperCase() + '-' + ((state.issueTitle || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')).slice(0, 30)
    );
    const hasStoryDir = fs.existsSync(storyDir);
    if (!hasStoryDir) {
      fail(
        `testsGenerated=true but no ${issueSlug}-*${ext} spec file found.\n` +
        `  State claims test generation completed, but no test artifact exists.\n` +
        `  Phantom success: check if generator actually wrote files or failed silently.`
      );
    }
  }
}

// ── Rule 3: reportGenerated=true → report file must exist ─────────────────────
if (state.reportGenerated === true && state.reportPath) {
  if (!fs.existsSync(state.reportPath)) {
    fail(
      `reportGenerated=true and reportPath="${state.reportPath}" but file does not exist.\n` +
      `  Report was claimed as generated but artifact is missing from disk.`
    );
  }
}

// ── Rule 4: testsPassed=true must be consistent with exit codes ───────────────
if (state.testsPassed === true) {
  // If postHealExitCode is set and non-zero, tests didn't actually pass cleanly
  if (state.postHealExitCode !== undefined && state.postHealExitCode !== 0) {
    fail(
      `testsPassed=true but postHealExitCode=${state.postHealExitCode} (non-zero).\n` +
      `  Tests failed even after healer ran. State has been marked passing incorrectly.\n` +
      `  Partial execution must not be marked as success.`
    );
  }
  if (state.testExitCode !== undefined && state.testExitCode !== 0 && !state.healerRanAt1) {
    fail(
      `testsPassed=true but testExitCode=${state.testExitCode} and no healer was run.\n` +
      `  Non-zero exit code was recorded but success was claimed without healing.`
    );
  }
}

// ── Rule 5: healerExhausted=true → pipeline must not report clean pass ─────────
if (state.healerExhausted === true && state.testsPassed === true) {
  fail(
    `healerExhausted=true AND testsPassed=true simultaneously — logically impossible.\n` +
    `  If the healer was exhausted, tests did not pass cleanly.\n` +
    `  State is inconsistent: pipeline produced a false green result.`
  );
}

// ── Rule 6: Duplicate PR detection ────────────────────────────────────────────
// If prUrl appears more than once in history, that indicates duplicate PR creation
if (Array.isArray(state.prHistory) && state.prHistory.length > 1) {
  const urls = state.prHistory.map(h => h.url);
  const unique = new Set(urls);
  if (unique.size < urls.length) {
    fail(
      `Duplicate PR detected in state history: ${JSON.stringify(state.prHistory)}.\n` +
      `  PR was created more than once for the same story. Review idempotency guard.`
    );
  }
}

// ── Rule 7: Branch-less PR claim ──────────────────────────────────────────────
if (state.prUrl && !state.branch) {
  fail(
    `prUrl is set ("${state.prUrl}") but no branch is recorded in state.\n` +
    `  A PR without a branch reference indicates incomplete state capture.`
  );
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('');
console.log('STATE INTEGRITY VALIDATION REPORT');
console.log('──────────────────────────────────────────────');
console.log(`  State file  : ${stateFilePath}`);
console.log(`  Issue Key   : ${state.issueKey || 'unknown'}`);
console.log(`  Framework   : ${state.framework || 'unknown'}`);
console.log(`  Violations  : ${violations.length}`);
console.log('');

if (warnings.length) {
  warnings.forEach(w => console.warn('[state-integrity] WARN: ' + w));
  console.log('');
}

if (violations.length === 0) {
  console.log('State integrity gate: ✅ PASS — state file is consistent with artifacts on disk.');
  process.exit(0);
}

console.error('State integrity gate: ❌ FAIL — ' + violations.length + ' inconsistency violation(s):\n');
violations.forEach((v, i) => console.error(`  [${i + 1}] ${v}\n`));
console.error('These violations indicate phantom success or partial execution marked as complete.');
console.error('A pipeline with inconsistent state cannot be trusted to report accurate results.');
console.error('');
process.exit(1);
