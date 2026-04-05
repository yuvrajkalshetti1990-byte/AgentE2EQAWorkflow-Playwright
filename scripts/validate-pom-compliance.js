#!/usr/bin/env node
'use strict';
/**
 * POM Compliance Enforcement Gate                                       (R3)
 *
 * Detects Playwright spec files that bypass Page Objects and use raw
 * page.locator() / page.fill() / page.click() calls directly in test bodies.
 *
 * Why this matters:
 *   Direct locators in test files create duplicated selector strings that
 *   break silently when the DOM changes. POM centralises all selectors so
 *   a single POM change propagates everywhere.
 *
 * Detection rules:
 *   VIOLATION — spec file contains page.locator( or page.fill( or page.click(
 *               or page.type( outside of POM files and beforeEach blocks
 *   ALLOWED   — Any file under pages/ (POM definitions themselves)
 *   ALLOWED   — beforeEach blocks (transitional; generator should use POM there)
 *
 * Configuration:
 *   POM_STRICT=true  → exit 1 on violations (default: false / warn only)
 *
 * Usage:
 *   node scripts/validate-pom-compliance.js
 *   POM_STRICT=true node scripts/validate-pom-compliance.js
 *
 * Exits 0 always in warn mode, 1 in strict mode when violations found.
 */

const fs   = require('fs');
const path = require('path');

const STRICT   = process.env.POM_STRICT === 'true';
const TESTS_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'tests');
const PAGES_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'pages');

// Raw page.* calls that should live in POMs, not spec bodies
const RAW_LOCATOR_RE = /\bpage\s*\.\s*(?:locator|fill|click|type|check|uncheck|selectOption|hover|dblclick|tap)\s*\(/;

const violations = [];

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.spec.ts')) continue;
      if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
      if (entry.name.includes('.notimplemented.')) continue;

      const src  = fs.readFileSync(full, 'utf8');
      const rel  = path.relative(process.cwd(), full);
      const lines = src.split('\n');

      lines.forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;       // skip comments
        // Allow inside beforeEach (login navigation is transitionally acceptable)
        if (/beforeEach/.test(line)) return;
        if (!RAW_LOCATOR_RE.test(line)) return;

        // Skip lines that are from expect() wrappers — expect(page.locator()).toHaveText()
        // These are assertion lines, not action lines, and are expected
        if (/^\s*await\s+expect\s*\(/.test(line)) return;
        if (/expect\s*\(\s*page\.locator/.test(line)) return;

        violations.push({ file: rel, line: i + 1, src: line.trim() });
      });
    }
  })(dir);
}

scan(TESTS_DIR);

const fileCount = [...new Set(violations.map(v => v.file))].length;

if (violations.length === 0) {
  console.log('POM compliance check: PASS — no raw page.locator/fill/click found in spec action lines.');
  process.exit(0);
}

const prefix = STRICT ? 'FAIL' : 'WARN';
const out    = STRICT ? console.error.bind(console) : console.warn.bind(console);

out('');
out(`POM COMPLIANCE ${prefix} — ${violations.length} raw page.* call(s) in ${fileCount} spec file(s).`);
out('These calls should be moved into Page Object classes under playwright/pages/saucedemo/.');
out('');

// Group by file for readability
const byFile = {};
for (const v of violations) {
  if (!byFile[v.file]) byFile[v.file] = [];
  byFile[v.file].push(v);
}
for (const [file, vs] of Object.entries(byFile)) {
  out(`  ${file}:`);
  vs.forEach(v => out(`    line ${v.line}: ${v.src}`));
  out('');
}

if (!STRICT) {
  console.warn('Set POM_STRICT=true to block the pipeline on POM compliance violations.');
  console.warn('');
  process.exit(0);
}

console.error('Fix: Move direct page.locator/fill/click calls into the appropriate POM class.');
console.error('Then call the POM method from the spec: e.g. inventoryPage.addToCart(\'...\')');
console.error('');
process.exit(1);
