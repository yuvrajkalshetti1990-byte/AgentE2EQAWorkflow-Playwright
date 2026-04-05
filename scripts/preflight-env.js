#!/usr/bin/env node
'use strict';
/**
 * Pre-flight Environment Validation Gate                              (R1 + R5)
 *
 * Runs BEFORE any test execution. Guarantees:
 *   1. BASE_URL is a valid HTTP/HTTPS URL if set
 *   2. BASE_URL host matches the expected environment (prevents accidental prod runs)
 *   3. Warns when credentials will fall back to defaults
 *   4. Hard-fails if REQUIRE_BASE_URL=true and BASE_URL is not set
 *   5. Hard-fails if any value in REQUIRED_ENV_VARS (comma-separated) is absent
 *
 * Configuration (env vars):
 *   REQUIRE_BASE_URL=true          → fail when BASE_URL not set (default: false/warn)
 *   REQUIRED_ENV_VARS=VAR1,VAR2    → additional vars that MUST be present
 *   EXPECTED_HOST=saucedemo.com    → if set, BASE_URL.host must match (env-safety check)
 *
 * Usage:
 *   node scripts/preflight-env.js --framework playwright
 *   node scripts/preflight-env.js --framework cypress
 *
 * Exits 1 on CRITICAL failures, 0 on pass (warnings are printed but do not fail).
 */

const path = require('path');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const eq = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
const fw = getArg('--framework') || 'playwright';

// ── Config ──────────────────────────────────────────────────────────────────
const requireBaseUrl   = process.env.REQUIRE_BASE_URL   === 'true';
const expectedHost     = process.env.EXPECTED_HOST       || '';
const extraRequired    = (process.env.REQUIRED_ENV_VARS || '').split(',').map(s => s.trim()).filter(Boolean);

const violations = [];
const warnings   = [];

function fail(msg)  { violations.push(msg); }
function warn(msg)  { warnings.push(msg); }

// ── 1. BASE_URL validation ──────────────────────────────────────────────────
const baseUrl = process.env.BASE_URL;

if (!baseUrl) {
  if (requireBaseUrl) {
    fail('BASE_URL is not set. Set REQUIRE_BASE_URL=true is active — tests must target an explicit environment.');
  } else {
    warn('BASE_URL not set — framework default (https://www.saucedemo.com) will be used. ' +
         'Set REQUIRE_BASE_URL=true to enforce explicit environment targeting.');
  }
} else {
  try {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      fail(`BASE_URL protocol "${parsed.protocol}" is neither http: nor https:.`);
    }
    // Environment safety: if expectedHost is set, enforce it
    if (expectedHost && !parsed.host.includes(expectedHost)) {
      fail(
        `ENV SAFETY VIOLATION: BASE_URL host is "${parsed.host}" but EXPECTED_HOST="${expectedHost}". ` +
        'Tests must not run against an unexpected environment. Update BASE_URL or unset EXPECTED_HOST.'
      );
    }
    console.log('[preflight-env] BASE_URL OK: ' + baseUrl);
  } catch {
    fail(`BASE_URL="${baseUrl}" is not a valid URL.`);
  }
}

// ── 2. Credential env vars ──────────────────────────────────────────────────
if (fw === 'playwright') {
  if (!process.env.SAUCE_USERNAME) {
    warn('SAUCE_USERNAME not set — LoginPage.loginWithDefaults() will use the "standard_user" fallback.');
  }
  if (!process.env.SAUCE_PASSWORD) {
    warn('SAUCE_PASSWORD not set — LoginPage.loginWithDefaults() will use the "secret_sauce" fallback.');
  }
} else if (fw === 'cypress') {
  // Cypress reads from cypress.env.json; missing values get defaults from cypress.config.ts
  const envJsonPath = path.join('qa-framework', 'frameworks', 'cypress', 'cypress.env.json');
  const fs = require('fs');
  if (!fs.existsSync(envJsonPath)) {
    warn('cypress.env.json not found — all Cypress env values will use built-in defaults from cypress.config.ts.');
  }
}

// ── 3. Additional required vars (configurable) ──────────────────────────────
for (const v of extraRequired) {
  if (!process.env[v]) {
    fail(`Required env var "${v}" (listed in REQUIRED_ENV_VARS) is not set.`);
  }
}

// ── 4. Print results ─────────────────────────────────────────────────────────
if (warnings.length) {
  warnings.forEach(w => console.warn('[preflight-env] WARN: ' + w));
}

if (violations.length) {
  console.error('');
  console.error('PRE-FLIGHT ENVIRONMENT CHECK FAILED — ' + violations.length + ' critical violation(s):');
  violations.forEach((v, i) => console.error('  [' + (i + 1) + '] ' + v));
  console.error('');
  console.error('Fix the above before running tests. Exiting with code 1.');
  console.error('');
  process.exit(1);
}

const baseMsg = baseUrl ? ` | BASE_URL=${baseUrl}` : ' | BASE_URL=<default>';
const warnMsg = warnings.length ? ` | ${warnings.length} warning(s) — see above` : '';
console.log('[preflight-env] PASS — environment validation OK' + baseMsg + warnMsg);
