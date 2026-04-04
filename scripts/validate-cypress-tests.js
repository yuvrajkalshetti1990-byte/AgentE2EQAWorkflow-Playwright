'use strict';
/**
 * CI validation script — called by cypress.yml BEFORE running tests.
 *
 * Enforces the mandatory Cypress generator rules on every committed spec file:
 *   1. Must contain a // Jira: header comment (AC traceability)
 *   2. Must contain at least one cy.log() call (debug observability)
 *   3. Must NOT use .type('standard_user') or .type('secret_sauce') as a string literal
 *      (credentials must be read from Cypress.env() with a fallback)
 *
 * Exempted files: example.cy.ts, *.notimplemented.cy.ts
 *
 * Usage: node scripts/validate-cypress-tests.js
 * Exits 1 if any violations are found, 0 if all checks pass.
 */

const fs   = require('fs');
const path = require('path');

const TESTS_DIR = path.join('qa-framework', 'frameworks', 'cypress', 'tests');

// Patterns
const HAS_JIRA_HEADER   = /\/\/\s*Jira\s*:/;
const HAS_CY_LOG        = /cy\.log\s*\(/;
// Matches .type('standard_user') or .type('secret_sauce') as a literal argument
// Does NOT match Cypress.env('username') ?? 'standard_user'
const HARDCODED_CRED_RE = /\.type\(\s*['"](?:standard_user|secret_sauce)['"]\s*\)/;

const violations = [];

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    // Only check .cy.ts files
    if (!entry.name.endsWith('.cy.ts')) continue;

    // Exempt boilerplate and notimplemented stubs
    if (entry.name === 'example.cy.ts') continue;
    if (entry.name.includes('.notimplemented.')) continue;

    const src = fs.readFileSync(full, 'utf8');
    const rel = path.relative(process.cwd(), full);

    if (!HAS_JIRA_HEADER.test(src)) {
      violations.push(rel + ':\n    missing // Jira: header — add "// Jira: SCRUM-XX — <story title>" at the top of the file');
    }

    if (!HAS_CY_LOG.test(src)) {
      violations.push(rel + ':\n    missing cy.log() observability — add cy.log(\'STEP: ...\') / cy.log(\'ASSERT: ...\') per generator rules');
    }

    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // Skip comment lines
      if (/^\s*\/\//.test(line)) return;
      if (HARDCODED_CRED_RE.test(line)) {
        violations.push(
          rel + ':' + (i + 1) + ':\n' +
          '    hardcoded credential in .type() — use:\n' +
          '      const user = (Cypress.env(\'username\') as string | undefined) ?? \'standard_user\';\n' +
          '      const pass = (Cypress.env(\'password\') as string | undefined) ?? \'secret_sauce\';\n' +
          '    and then .type(user) / .type(pass)'
        );
      }
    });
  }
}

scan(TESTS_DIR);

if (violations.length) {
  console.error('');
  console.error('CYPRESS COMPLIANCE FAIL — ' + violations.length + ' violation(s) found.\n');
  violations.forEach((v, i) => console.error('  [' + (i + 1) + '] ' + v + '\n'));
  console.error('Fix these by running @cypress-test-generator or @cypress-test-healer.');
  console.error('');
  process.exit(1);
}

console.log('OK — all Cypress spec files meet generator rules (' + (function countFiles(d) {
  if (!fs.existsSync(d)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) n += countFiles(f);
    else if (e.name.endsWith('.cy.ts') && !e.name.includes('example') && !e.name.includes('.notimplemented.')) n++;
  }
  return n;
})(TESTS_DIR) + ' spec files checked)');
