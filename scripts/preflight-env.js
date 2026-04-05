#!/usr/bin/env node
'use strict';
/**
 * Pre-flight Environment Validation Gate                              (R1 + R9)
 *
 * STRICT MODE (default): FAILS the pipeline on any of the following:
 *   1. BASE_URL not set (when STRICT_MODE=true or REQUIRE_BASE_URL=true)
 *   2. BASE_URL host does not match EXPECTED_HOST
 *   3. Any REQUIRED_ENV_VARS value is absent
 *   4. Hardcoded URLs (http/https literals) found inside spec files
 *   5. Invalid framework config detected (playwright.config.ts / cypress.config.ts)
 *
 * Override ONLY via: STRICT_MODE=false or specific allow flags (see enforcement-config.js)
 *
 * Usage:
 *   node scripts/preflight-env.js --framework playwright
 *   node scripts/preflight-env.js --framework cypress
 *
 * Exits 1 on any critical violation, 0 on pass.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const eq = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
const fw = getArg('--framework') || 'playwright';

// ── Config (from central enforcement registry) ───────────────────────────────
const requireBaseUrl = E.REQUIRE_BASE_URL;
const expectedHost   = E.EXPECTED_HOST;
const extraRequired  = E.REQUIRED_ENV_VARS;

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

// ── 4. Hardcoded URL scan — spec files must not contain absolute http(s) URLs ─
//    (page.goto('https://...') bypasses baseURL and hard-codes target environment)
const HARDCODED_URL_RE = /(?:page\.goto|page\.navigate|cy\.visit)\s*\(\s*['"`]https?:\/\/(?!localhost)/;
function scanForHardcodedUrls(dir, ext) {
  if (!fs.existsSync(dir)) return;
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(ext)) continue;
      if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
      if (entry.name.includes('.notimplemented.')) continue;
      const src   = fs.readFileSync(full, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;        // skip comment lines
        if (HARDCODED_URL_RE.test(line)) {
          fail(
            `HARDCODED URL in ${path.relative(process.cwd(), full)}:${i + 1} — ` +
            `"${line.trim().slice(0, 80)}" — use a relative path and let baseURL control the host.`
          );
        }
      });
    }
  })(dir);
}

const PW_TESTS = path.join('qa-framework', 'frameworks', 'playwright', 'tests');
const CY_TESTS = path.join('qa-framework', 'frameworks', 'cypress',    'tests');

if (fw === 'playwright') scanForHardcodedUrls(PW_TESTS, '.spec.ts');
if (fw === 'cypress')    scanForHardcodedUrls(CY_TESTS, '.cy.ts');

// ── 5. Framework config integrity check ───────────────────────────────────────
if (fw === 'playwright') {
  const cfgPath = path.join('qa-framework', 'frameworks', 'playwright', 'playwright.config.ts');
  if (!fs.existsSync(cfgPath)) {
    fail('playwright.config.ts not found at qa-framework/frameworks/playwright/playwright.config.ts');
  } else {
    const cfg = fs.readFileSync(cfgPath, 'utf8');
    if (!/baseURL/.test(cfg)) {
      fail('playwright.config.ts is missing a baseURL setting — tests will not run against a known environment.');
    }
  }
}

if (fw === 'cypress') {
  const cfgPath = path.join('qa-framework', 'frameworks', 'cypress', 'cypress.config.ts');
  if (!fs.existsSync(cfgPath)) {
    fail('cypress.config.ts not found at qa-framework/frameworks/cypress/cypress.config.ts');
  } else {
    const cfg = fs.readFileSync(cfgPath, 'utf8');
    if (!/baseUrl/.test(cfg)) {
      fail('cypress.config.ts is missing a baseUrl setting — tests will not run against a known environment.');
    }
  }
}

// ── 6. Print results ──────────────────────────────────────────────────────────
if (warnings.length) {
  warnings.forEach(w => console.warn('[preflight-env] WARN: ' + w));
}

if (violations.length) {
  console.error('');
  console.error('PRE-FLIGHT ENVIRONMENT CHECK FAILED — ' + violations.length + ' critical violation(s):');
  violations.forEach((v, i) => console.error('  [' + (i + 1) + '] ' + v));
  console.error('');
  console.error('Strict enforcement is active (STRICT_MODE=true). Fix the above before running tests.');
  console.error('To override: set STRICT_MODE=false (emergency use only — will produce unverified results).');
  console.error('');
  process.exit(1);
}

const baseMsg = baseUrl ? ` | BASE_URL=${baseUrl}` : ' | BASE_URL=<default>';
const warnMsg = warnings.length ? ` | ${warnings.length} warning(s) — see above` : '';
console.log('[preflight-env] PASS — environment validation OK' + baseMsg + warnMsg);
