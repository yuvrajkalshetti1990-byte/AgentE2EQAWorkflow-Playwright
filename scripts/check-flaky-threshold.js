#!/usr/bin/env node
'use strict';
/**
 * Flaky Test Governance Gate                                            (R4)
 *
 * STRICT MODE (default): FAILS pipeline if any flaky tests detected.
 *
 * Definitions:
 *   FLAKY    — test that passed only after >=1 retries
 *   UNSTABLE — flakyCount > 0 and below configured threshold
 *   FAIL     — flakyCount > FLAKY_FAIL_THRESHOLD (default 0 — zero tolerance)
 *
 * Override (emergency only):
 *   ALLOW_FLAKY=true       — print UNSTABLE, exit 0 instead of failing
 *   FLAKY_FAIL_THRESHOLD=N — allow N flaky tests before strict fail
 *
 * Usage:
 *   node scripts/check-flaky-threshold.js --results-json path/to/results.json --framework playwright
 *   node scripts/check-flaky-threshold.js --results-json path/to/mochawesome.json --framework cypress
 *
 * Exits 0 on pass or ALLOW_FLAKY=true, 1 when threshold exceeded in strict mode.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const eq  = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
const resultsJson  = getArg('--results-json');
const fw           = getArg('--framework') || 'playwright';

// ── Config ──────────────────────────────────────────────────────────────────
const threshold  = E.FLAKY_FAIL_THRESHOLD;   // default 0 — zero tolerance
const allowFlaky = E.ALLOW_FLAKY;            // default false in strict mode

if (!resultsJson) {
  console.error('[check-flaky] ERROR: --results-json is required.');
  process.exit(1);
}

if (!fs.existsSync(resultsJson)) {
  console.warn(`[check-flaky] WARN: Results file not found at "${resultsJson}" — skipping flaky check.`);
  process.exit(0);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));
} catch (e) {
  console.error(`[check-flaky] ERROR: Cannot parse "${resultsJson}": ${e.message}`);
  process.exit(1);
}

// ── Parse results ────────────────────────────────────────────────────────────
const flakyTests = [];

if (fw === 'playwright') {
  // Playwright JSON: suites → suites → specs → tests[] → results[]
  function walk(suites) {
    for (const suite of (suites || [])) {
      for (const spec of (suite.specs || [])) {
        for (const test of (spec.tests || [])) {
          const passed  = test.status === 'expected';
          const retries = Math.max(0, (test.results || []).length - 1);
          if (passed && retries > 0) {
            flakyTests.push({
              suite:  suite.title,
              title:  spec.title,
              retries,
            });
          }
        }
      }
      walk(suite.suites || []);
    }
  }
  for (const browserSuite of (raw.suites || [])) {
    walk(browserSuite.suites || []);
  }
} else {
  // Cypress Mochawesome: results[] → suites[] → tests[]
  function walkMocha(suite) {
    for (const t of (suite.tests || [])) {
      // Cypress retries are tracked via attempts array if present
      const attempts = t.attempts || [];
      const retried  = attempts.length > 1;
      const passed   = t.pass === true;
      if (passed && retried) {
        flakyTests.push({
          suite:  suite.title,
          title:  t.title,
          retries: attempts.length - 1,
        });
      }
    }
    for (const nested of (suite.suites || [])) walkMocha(nested);
  }
  for (const result of (raw.results || [])) {
    for (const suite of (result.suites || [])) walkMocha(suite);
  }
}

// ── Evaluate thresholds ──────────────────────────────────────────────────────
const flakyCount = flakyTests.length;

console.log('');
console.log('FLAKY TEST GOVERNANCE REPORT');
console.log('──────────────────────────────────────────────');
console.log(`  Flaky tests detected : ${flakyCount}`);
console.log(`  Fail threshold       : ${threshold}`);
console.log(`  Fail mode            : ${failMode}`);
console.log('');

if (flakyCount === 0) {
  console.log('Flaky governance: ✅ PASS — no flaky tests detected.');
  process.exit(0);
}

// Print the flaky tests
console.log('Flaky test details:');
flakyTests.forEach((t, i) => {
  console.log(`  [${i + 1}] "${t.suite} > ${t.title}" — passed on retry ${t.retries}`);
});
console.log('');

// ALLOW_FLAKY=true — explicit escape hatch, must be declared
if (allowFlaky) {
  console.warn(`Flaky governance: ⚠️  UNSTABLE (ALLOW_FLAKY=true) — ${flakyCount} flaky test(s) detected.`);
  console.warn('ALLOW_FLAKY is an emergency override. Stabilise these tests at earliest opportunity.');
  process.exit(0);
}

if (flakyCount <= threshold && threshold > 0) {
  console.warn(`Flaky governance: ⚠️  UNSTABLE — ${flakyCount} flaky test(s) detected (within threshold of ${threshold}).`);
  console.warn('Review and stabilise these tests before threshold is exceeded.');
  process.exit(0);
}

// Threshold exceeded (or threshold=0 and any flaky tests present)
const exceeded = flakyCount - threshold;
console.error('');
console.error(`Flaky governance: ❌ FAIL — ${flakyCount} flaky test(s) exceed FLAKY_FAIL_THRESHOLD=${threshold}.`);
console.error('Flaky tests indicate non-deterministic behaviour that must be resolved before shipping.');
console.error('Fix with @playwright-test-healer / @cypress-test-healer, or set ALLOW_FLAKY=true as an emergency override.');
console.error('');
process.exit(1);
