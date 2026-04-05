#!/usr/bin/env node
'use strict';
/**
 * Cross-Framework Parity Check                                          (R6)
 *
 * Ensures Playwright and Cypress test suites do not drift apart.
 * When a story is covered in one framework, it should exist in both
 * (or the absence should be a deliberate, documented exception).
 *
 * What is compared:
 *   - Story sub-folders under playwright/tests/  (excludes single boilerplate files)
 *   - Story sub-folders under cypress/tests/     (excludes SCRUM-16 learning series)
 *
 * Rules:
 *   - If a story folder exists in Playwright but NOT in Cypress → log warning
 *   - If a story folder exists in Cypress but NOT in Playwright → log warning
 *   - PARITY_STRICT=true → exit 1 on any mismatch (default: warn only)
 *
 * Normalisation:
 *   Folder names are normalised to uppercase slugs so "scrum-17" == "SCRUM-17" == "scrum-17".
 *
 * Usage:
 *   node scripts/check-framework-parity.js
 *   PARITY_STRICT=true node scripts/check-framework-parity.js
 *
 * Exits 0 on pass or warn, 1 in strict mode when mismatches found.
 */

const fs   = require('fs');
const path = require('path');

const STRICT = process.env.PARITY_STRICT === 'true';

const PW_TESTS = path.join('qa-framework', 'frameworks', 'playwright', 'tests');
const CY_TESTS = path.join('qa-framework', 'frameworks', 'cypress',    'tests');

// Folders that are intentionally framework-specific and should not be compared
const EXEMPT_PLAYWRIGHT = new Set(['saucedemo-checkout']); // top-level story group (contains sub-dirs)
const EXEMPT_CYPRESS    = new Set(['SCRUM-16-cypress-learning']); // learning series, not story tests

// ── Collect story folders ────────────────────────────────────────────────────
function getStoryFolders(dir, exemptions) {
  if (!fs.existsSync(dir)) return new Map();
  const result = new Map(); // normalised-key → original-name
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (exemptions.has(entry.name)) continue;
    const norm = entry.name.toUpperCase().replace(/_/g, '-');
    result.set(norm, entry.name);
  }
  return result;
}

// For Playwright, go one level deeper into saucedemo-checkout if it's the only top-level dir
function getPlaywrightStories() {
  const top = getStoryFolders(PW_TESTS, EXEMPT_PLAYWRIGHT);
  // Check if saucedemo-checkout exists and add it as SCRUM-14 equivalent
  const checkoutDir = path.join(PW_TESTS, 'saucedemo-checkout');
  if (fs.existsSync(checkoutDir)) {
    // saucedemo-checkout represents SCRUM-14 story coverage
    top.set('SAUCEDEMO-CHECKOUT', 'saucedemo-checkout');
  }
  return top;
}

const pwStories = getPlaywrightStories();
const cyStories = getStoryFolders(CY_TESTS, EXEMPT_CYPRESS);

// ── Compute diffs ─────────────────────────────────────────────────────────────
const onlyInPw = [];
const onlyInCy = [];
const inBoth   = [];

for (const [norm, name] of pwStories) {
  if (cyStories.has(norm)) {
    inBoth.push(norm);
  } else {
    // Try partial match (e.g. SCRUM-17 matches scrum-17)
    const partial = [...cyStories.keys()].find(k => k.includes(norm) || norm.includes(k));
    if (!partial) onlyInPw.push(name);
  }
}

for (const [norm, name] of cyStories) {
  if (!pwStories.has(norm)) {
    const partial = [...pwStories.keys()].find(k => k.includes(norm) || norm.includes(k));
    if (!partial) onlyInCy.push(name);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
console.log('');
console.log('CROSS-FRAMEWORK PARITY REPORT');
console.log('──────────────────────────────────────────────');
console.log(`  Playwright stories : ${pwStories.size}`);
console.log(`  Cypress stories    : ${cyStories.size}`);
console.log(`  Matched (both)     : ${inBoth.length}`);
console.log(`  Playwright-only    : ${onlyInPw.length}`);
console.log(`  Cypress-only       : ${onlyInCy.length}`);
console.log('');

const hasMismatch = onlyInPw.length > 0 || onlyInCy.length > 0;

if (!hasMismatch) {
  console.log('Framework parity: PASS — all story folders exist in both frameworks.');
  process.exit(0);
}

const prefix = STRICT ? 'FAIL' : 'WARN';
const out    = STRICT ? console.error.bind(console) : console.warn.bind(console);

if (onlyInPw.length > 0) {
  out(`Stories in Playwright but NOT in Cypress (${onlyInPw.length}):`);
  onlyInPw.forEach(n => out(`  • ${n}  →  cypress/tests/${n}/ is missing`));
  out('');
}
if (onlyInCy.length > 0) {
  out(`Stories in Cypress but NOT in Playwright (${onlyInCy.length}):`);
  onlyInCy.forEach(n => out(`  • ${n}  →  playwright/tests/${n}/ is missing`));
  out('');
}

if (!STRICT) {
  console.warn(`Framework parity: ${prefix} — mismatches logged above.`);
  console.warn('Set PARITY_STRICT=true to fail the pipeline on framework drift.');
  process.exit(0);
}

console.error('Framework parity: FAIL — story coverage has drifted between frameworks.');
console.error('Add the missing test folders or add an exemption to check-framework-parity.js.');
process.exit(1);
