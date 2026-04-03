/**
 * CI validation script — called by cypress.yml
 * Verifies no spec or page-object file uses raw cy.visit() or cy.request().
 * All tests must use cy.safeVisit() and cy.apiRequest() instead.
 *
 * Usage: node scripts/lint-resilience.js
 * Exits 1 if any violations are found, 0 if all checks pass.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const violations = [];

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach(function(line, i) {
      if (/\bcy\.(visit|request)\(/.test(line) && !/^\s*\/\//.test(line)) {
        violations.push(full + ':' + (i + 1) + ':  ' + line.trim());
      }
    });
  }
}

scan('qa-framework/frameworks/cypress/tests');
scan('qa-framework/frameworks/cypress/pages');

if (violations.length) {
  console.error('LINT FAIL: Raw cy.visit() or cy.request() detected.');
  console.error('Use cy.safeVisit() and cy.apiRequest() instead.\n');
  violations.forEach(function(v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('Resilience lint: OK — no raw cy.visit() or cy.request() found.');
