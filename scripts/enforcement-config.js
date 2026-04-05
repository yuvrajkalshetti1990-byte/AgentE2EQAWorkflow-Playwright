#!/usr/bin/env node
'use strict';
/**
 * Central Enforcement Configuration                                    (R10)
 *
 * Single source of truth for all pipeline governance settings.
 * STRICT_MODE=true (default) — every gate enforces hard failures.
 *
 * Override ONLY via env flags. Pipeline must not silently produce green results.
 *
 * All consuming scripts require() this file via:
 *   const E = require('./enforcement-config');
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  Flag                    Default        Meaning when true / description
 * ─────────────────────────────────────────────────────────────────────────────
 *  STRICT_MODE             true           Master switch — all gates default to fail
 *  ALLOW_PARTIAL_AC        false          Allow stories with not-implemented ACs
 *  ALLOW_FLAKY             false          Allow flaky tests (>0 retried passes)
 *  PARITY_STRICT           false          Fail on cross-framework folder drift
 *  ALLOW_MISSING_ASSERT    false          Allow test files with no assertions
 *  ALLOW_POM_BYPASS        false          Allow raw page.locator() in spec files
 *  UNSTABLE_FAILS_PIPELINE true           UNSTABLE pipeline status exits 1
 * ─────────────────────────────────────────────────────────────────────────────
 */

function parseBool(envVar, defaultVal) {
  const v = process.env[envVar];
  if (v === undefined || v === '') return defaultVal;
  return v === 'true' || v === '1';
}

const STRICT = parseBool('STRICT_MODE', true);

const config = {
  // ── Master switch ──────────────────────────────────────────────────────────
  STRICT_MODE: STRICT,

  // ── Per-gate overrides ─────────────────────────────────────────────────────
  // AC coverage: FAIL if any not-implemented ACs remain (unless ALLOW_PARTIAL_AC=true)
  ALLOW_PARTIAL_AC:      parseBool('ALLOW_PARTIAL_AC',      false),

  // Flaky governance: FAIL if any flaky tests detected (unless ALLOW_FLAKY=true)
  ALLOW_FLAKY:           parseBool('ALLOW_FLAKY',           !STRICT),

  // Framework parity: FAIL if story folders differ between frameworks
  PARITY_STRICT:         parseBool('PARITY_STRICT',         STRICT),

  // AI output: FAIL if spec has no assertions / no AC mapping
  ALLOW_MISSING_ASSERT:  parseBool('ALLOW_MISSING_ASSERT',  false),

  // POM enforcement: FAIL if spec uses raw page.locator() without POM class
  ALLOW_POM_BYPASS:      parseBool('ALLOW_POM_BYPASS',      false),

  // Reporting: UNSTABLE pipeline status must exit 1 in strict mode
  UNSTABLE_FAILS_PIPELINE: parseBool('UNSTABLE_FAILS_PIPELINE', STRICT),

  // ── Environment validation ─────────────────────────────────────────────────
  REQUIRE_BASE_URL:      parseBool('REQUIRE_BASE_URL',      STRICT),
  EXPECTED_HOST:         process.env.EXPECTED_HOST          || '',
  REQUIRED_ENV_VARS:    (process.env.REQUIRED_ENV_VARS     || '').split(',').map(s => s.trim()).filter(Boolean),

  // ── Flaky threshold ────────────────────────────────────────────────────────
  FLAKY_FAIL_THRESHOLD:  parseInt(process.env.FLAKY_FAIL_THRESHOLD ?? '0', 10),
};

// ── Diagnostics ───────────────────────────────────────────────────────────────
if (process.env.ENFORCEMENT_DEBUG === 'true') {
  console.log('[enforcement-config] Active configuration:');
  for (const [k, v] of Object.entries(config)) {
    console.log(`  ${k.padEnd(26)} = ${JSON.stringify(v)}`);
  }
}

module.exports = config;
