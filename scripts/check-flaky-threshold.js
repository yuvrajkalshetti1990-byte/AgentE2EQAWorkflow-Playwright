#!/usr/bin/env node
'use strict';
/**
 * Flaky Test Governance Gate                                            (R4)
 *
 * Parses Playwright or Cypress (Mochawesome) test results JSON after a run
 * and enforces flakiness thresholds.
 *
 * Definitions:
 *   FLAKY  — test that passed only after one or more retries (retries > 0 AND status=passed)
 *   UNSTABLE — pipeline has ≥ 1 flaky test but is below the fail threshold
 *   FAIL   — pipeline has > FLAKY_FAIL_THRESHOLD flaky tests (default threshold: 0)
 *
 * Configuration (env vars):
 *   FLAKY_FAIL_THRESHOLD=N   → number of flaky tests allowed before hard fail (default: 0)
 *   FLAKY_FAIL_MODE=unstable → print UNSTABLE, exit 0 even when threshold exceeded (CI-advisory mode)
 *   FLAKY_FAIL_MODE=fail     → exit 1 when threshold exceeded (default — strict mode)
 *
 * Usage:
 *   node scripts/check-flaky-threshold.js --results-json path/to/results.json --framework playwright
 *   node scripts/check-flaky-threshold.js --results-json path/to/mochawesome.json --framework cypress
 *
 * Exits 0 on pass/unstable, 1 on threshold exceeded (FLAKY_FAIL_MODE=fail).
 */

const fs   = require('fs');
const path = require('path');

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
const threshold = parseInt(process.env.FLAKY_FAIL_THRESHOLD ?? '0', 10);
const failMode  = process.env.FLAKY_FAIL_MODE || 'fail';  // 'fail' | 'unstable'

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
  console.log('Flaky governance: PASS — no flaky tests detected.');
  process.exit(0);
}

// Print the flaky tests
console.log('Flaky test details:');
flakyTests.forEach((t, i) => {
  console.log(`  [${i + 1}] "${t.suite} > ${t.title}" — passed on retry ${t.retries}`);
});
console.log('');

if (flakyCount <= threshold) {
  console.warn(`Flaky governance: UNSTABLE — ${flakyCount} flaky test(s) detected (within threshold of ${threshold}).`);
  console.warn('Review and stabilise these tests before threshold is exceeded.');
  process.exit(0);
}

// Threshold exceeded
const exceeded = flakyCount - threshold;
if (failMode === 'unstable') {
  console.warn(`Flaky governance: UNSTABLE — ${flakyCount} flaky test(s) exceed threshold of ${threshold} by ${exceeded}.`);
  console.warn('FLAKY_FAIL_MODE=unstable — pipeline continues but is marked unstable.');
  console.warn('Set FLAKY_FAIL_MODE=fail to block pipeline on threshold breach.');
  process.exit(0);
}

// Default: fail
console.error(`Flaky governance: FAIL — ${flakyCount} flaky test(s) exceed FLAKY_FAIL_THRESHOLD=${threshold} by ${exceeded}.`);
console.error('Stabilise the flaky tests above before this pipeline can pass cleanly.');
console.error('Quick-fix: run @playwright-test-healer / @cypress-test-healer with the flaky test file.');
console.error('');
process.exit(1);
