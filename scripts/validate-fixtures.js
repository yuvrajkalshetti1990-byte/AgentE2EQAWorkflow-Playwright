/**
 * CI validation script — called by cypress.yml
 * Verifies every cy.fixture() and .selectFile('cypress/fixtures/...') call
 * in the Cypress spec files has a matching @requiredFixtures declaration.
 *
 * Usage: node scripts/validate-fixtures.js
 * Exits 1 if any violations are found, 0 if all checks pass.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Matches: cy.fixture('name.json')  or  cy.fixture<Type>('name.json')
const FIXTURE_SIMPLE = /cy\.fixture\(['"]([\w.\-/]+)['"]|cy\.fixture<[^>]*>\(['"]([\w.\-/]+)['"]/g;
// Matches: .selectFile('cypress/fixtures/name.ext')
const SELECT_FILE = /selectFile\(['"]cypress\/fixtures\/([\w.\-/]+)['"]|\.selectFile\('([^']+)'\)/g;
// Matches: // @requiredFixtures: ["name1.json", "name2.json"]
const META_RE = /@requiredFixtures:\s*(\[[^\]]+\])/;

const violations = [];

function normaliseName(name) {
  // If already has an extension keep it; otherwise add .json
  return name.includes('.') ? name : name + '.json';
}

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!entry.name.endsWith('.cy.ts')) continue;

    const src = fs.readFileSync(full, 'utf8');
    const used = new Set();
    let m;

    FIXTURE_SIMPLE.lastIndex = 0;
    while ((m = FIXTURE_SIMPLE.exec(src)) !== null) {
      const name = m[1] || m[2];
      if (name) used.add(normaliseName(name));
    }

    SELECT_FILE.lastIndex = 0;
    while ((m = SELECT_FILE.exec(src)) !== null) {
      const raw = m[1] || m[2] || '';
      const base = raw.split('/').pop();
      if (base) used.add(normaliseName(base));
    }

    if (used.size === 0) continue;

    const metaMatch = META_RE.exec(src);
    const declared = new Set();
    if (metaMatch) {
      try {
        JSON.parse(metaMatch[1]).forEach(function(f) { declared.add(f); });
      } catch (e) {
        violations.push(
          path.relative(process.cwd(), full) +
          ': @requiredFixtures metadata is not valid JSON — use double quotes: ["name.json"]'
        );
        continue;
      }
    }

    for (const f of used) {
      if (!declared.has(f)) {
        violations.push(
          path.relative(process.cwd(), full) +
          ': uses fixture "' + f + '" but is missing // @requiredFixtures: ["' + f + '"]'
        );
      }
    }
  }
}

scan('qa-framework/frameworks/cypress/tests');

if (violations.length) {
  console.error('FIXTURE VALIDATION FAIL: undeclared fixture(s) found.');
  console.error('Add // @requiredFixtures: [...] to the top of these files:\n');
  violations.forEach(function(v) { console.error('  ' + v); });
  process.exit(1);
}
console.log('Fixture validation: OK — all cy.fixture() calls are declared.');
