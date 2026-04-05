'use strict';
/**
 * CI validation script — called by playwright.yml BEFORE running tests.
 *
 * STRICT MODE (default): FAILS pipeline on ANY of the following in spec files:
 *   1. Missing // Jira: header (AC traceability)
 *   2. Missing console.log() (debug observability)
 *   3. Hardcoded credentials in .fill()
 *   4. Hardcoded absolute URLs in page.goto()
 *   5. Missing POM import — spec must use Page Object classes (ALLOW_POM_BYPASS=true to override)
 *   6. Raw page.locator() / page.getByRole() calls in spec files (must be inside POM only)
 *
 * Exempted: seed.spec.ts, example.spec.ts, *.notimplemented.spec.ts
 *
 * Usage: node scripts/validate-playwright-tests.js
 * Exits 1 if any violations are found, 0 if all checks pass.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

const TESTS_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'tests');

// Patterns
const HAS_JIRA_HEADER   = /\/\/\s*Jira\s*:/;
const HAS_CONSOLE_LOG   = /console\.log\s*\(/;
// Matches .fill('standard_user') or .fill('secret_sauce') as a string literal argument
// Does NOT match process.env.SAUCE_USERNAME ?? 'standard_user' (no preceding .fill()
const HARDCODED_CRED_RE = /\.fill\(\s*['"](?:standard_user|secret_sauce)['"]\s*\)/;
// Matches page.goto('https://...') or page.navigate('https://...') — bypasses baseURL
const HARDCODED_URL_RE  = /(?:page\.goto|page\.navigate)\s*\(\s*['"`]https?:\/\//;
// POM import: must import at least one class from pages/ directory              (R3)
const HAS_POM_IMPORT_RE = /import\s+\{[^}]+\}\s+from\s+['"][^'"]*pages\/[^'"]+['"]/;
// Raw Playwright locator calls that should only appear inside POM files (R3)
const RAW_LOCATOR_RE = /(?:page|this\.page)\s*\.\s*(?:locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\s*\(/;

// ALLOW_POM_BYPASS=true downgrades POM violations to warnings (emergency override)
const ALLOW_POM_BYPASS = E.ALLOW_POM_BYPASS;

const pomViolations = [];  // POM bypass warnings (non-blocking only when ALLOW_POM_BYPASS=true)
const violations    = [];

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

    // POM enforcement — spec files must import from pages/ (R3 STRICT)
    if (!HAS_POM_IMPORT_RE.test(src)) {
      const msg = rel + ':\n    no POM import found — spec files MUST import Page Object classes from pages/.\n' +
                  '    Add: import { LoginPage } from \'../../../pages/saucedemo/LoginPage\';\n' +
                  '    and replace direct page.locator() calls with POM methods.';
      if (ALLOW_POM_BYPASS) {
        pomViolations.push('⚠️  BYPASS ACTIVE: ' + msg);
      } else {
        violations.push(msg);
      }
    }

    // Raw locator check — direct locator calls in spec files bypass POM (R3)
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // Skip comment lines and import lines
      if (/^\s*\/\//.test(line) || /^\s*import\s/.test(line)) return;
      if (HARDCODED_CRED_RE.test(line)) {
        violations.push(
          rel + ':' + (i + 1) + ':\n' +
          '    hardcoded credential in .fill() — use:\n' +
          '      const username = process.env.SAUCE_USERNAME ?? \'standard_user\';\n' +
          '      const password = process.env.SAUCE_PASSWORD ?? \'secret_sauce\';\n' +
          '    and then .fill(username) / .fill(password)'
        );
      }
      if (HARDCODED_URL_RE.test(line)) {
        violations.push(
          rel + ':' + (i + 1) + ':\n' +
          '    hardcoded absolute URL in page.goto() — use a relative path (e.g. \'/cart.html\') so that\n' +
          '    the Playwright baseURL config controls the host. Or use a LoginPage/InventoryPage POM method.'
        );
      }
      // Raw locator in spec = POM bypass violation
      // Exception: allowed inside expect() assertions (e.g. expect(page.locator(...)).toBeVisible())
      // Only flag raw locator ACTION calls — .click(), .fill(), .type(), .check(), .hover() etc.
      if (RAW_LOCATOR_RE.test(line) && !/^\s*(?:await\s+)?expect\s*\(/.test(line)) {
        const msg = rel + ':' + (i + 1) + ':\n' +
          '    raw locator call in spec file — page.locator() / page.getByRole() etc. are forbidden\n' +
          '    in spec files. Encapsulate selectors inside a Page Object method and call that instead.';
        if (ALLOW_POM_BYPASS) {
          pomViolations.push('⚠️  BYPASS ACTIVE: ' + msg);
        } else {
          violations.push(msg);
        }
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
  console.error('Strict enforcement is active (STRICT_MODE=true). To bypass POM checks only: ALLOW_POM_BYPASS=true');
  console.error('');
  process.exit(1);
}

// POM bypass notifications (non-violations when ALLOW_POM_BYPASS=true)
if (pomViolations.length) {
  console.warn('');
  console.warn('PLAYWRIGHT POM BYPASS ACTIVE — ' + pomViolations.length + ' spec file(s) bypassing POM enforcement:');
  pomViolations.forEach((w, i) => console.warn('  [' + (i + 1) + '] ' + w + '\n'));
  console.warn('ALLOW_POM_BYPASS=true is an emergency override. Remove raw locators at earliest opportunity.');
  console.warn('');
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
