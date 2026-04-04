'use strict';
/**
 * CI validation script — called by playwright.yml BEFORE running tests.
 *
 * Enforces the mandatory Playwright generator rules on every committed spec file:
 *   1. Must contain a // Jira: header comment (AC traceability)
 *   2. Must contain at least one console.log() call (debug observability)
 *   3. Must NOT use .fill('standard_user') or .fill('secret_sauce') directly
 *      (credentials must be read from process.env with a fallback)
 *
 * Exempted files: seed.spec.ts, example.spec.ts, *.notimplemented.spec.ts
 *
 * Usage: node scripts/validate-playwright-tests.js
 * Exits 1 if any violations are found, 0 if all checks pass.
 */

const fs   = require('fs');
const path = require('path');

const TESTS_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'tests');

// Patterns
const HAS_JIRA_HEADER   = /\/\/\s*Jira\s*:/;
const HAS_CONSOLE_LOG   = /console\.log\s*\(/;
// Matches .fill('standard_user') or .fill('secret_sauce') as a string literal argument
// Does NOT match process.env.SAUCE_USERNAME ?? 'standard_user' (no preceding .fill()
const HARDCODED_CRED_RE = /\.fill\(\s*['"](?:standard_user|secret_sauce)['"]\s*\)/;

const violations = [];

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!entry.name.endsWith('.spec.ts')) continue;

    // Exempt boilerplate and notimplemented stubs
    if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
    if (entry.name.includes('.notimplemented.')) continue;

    const src = fs.readFileSync(full, 'utf8');
    const rel = path.relative(process.cwd(), full);

    if (!HAS_JIRA_HEADER.test(src)) {
      violations.push(rel + ':\n    missing // Jira: header — add "// Jira: SCRUM-XX — <story title>" at the top of the file');
    }

    if (!HAS_CONSOLE_LOG.test(src)) {
      violations.push(rel + ':\n    missing console.log() observability — add [STEP]/[NAV]/[ASSERT] logs per generator rules');
    }

    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // Skip comment lines
      if (/^\s*\/\//.test(line)) return;
      if (HARDCODED_CRED_RE.test(line)) {
        violations.push(
          rel + ':' + (i + 1) + ':\n' +
          '    hardcoded credential in .fill() — use:\n' +
          '      const username = process.env.SAUCE_USERNAME ?? \'standard_user\';\n' +
          '      const password = process.env.SAUCE_PASSWORD ?? \'secret_sauce\';\n' +
          '    and then .fill(username) / .fill(password)'
        );
      }
    });
  }
}

scan(TESTS_DIR);

if (violations.length) {
  console.error('');
  console.error('PLAYWRIGHT COMPLIANCE FAIL — ' + violations.length + ' violation(s) found.\n');
  violations.forEach((v, i) => console.error('  [' + (i + 1) + '] ' + v + '\n'));
  console.error('Fix these by running @playwright-test-generator or @playwright-test-healer.');
  console.error('');
  process.exit(1);
}

console.log('Playwright compliance check: OK — all spec files meet generator rules (' +
  (function countSpecs(dir, n) {
    if (!fs.existsSync(dir)) return n;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n = countSpecs(path.join(dir, e.name), n);
      else if (e.name.endsWith('.spec.ts') &&
               e.name !== 'seed.spec.ts' && e.name !== 'example.spec.ts' &&
               !e.name.includes('.notimplemented.')) n++;
    }
    return n;
  })(TESTS_DIR, 0) + ' spec files checked).');
