#!/usr/bin/env node
/**
 * Test Quality Gate Validator
 *
 * Fails the pipeline (exit 1) if any test file violates quality rules:
 *
 *   1. Navigation-only test — no assertions at all
 *   2. Weak assertions only — e.g. .toBeTruthy(), .to.exist, .to.be.visible alone
 *   3. Missing AC traceability — no // Jira: comment
 *   4. No real assertion — only console.log() or expect(true).toBe(true)
 *   5. Missing observability — Playwright files must have console.log()
 *   6. Missing observability — Cypress files must have cy.log()
 *
 * Supports:
 *   - Playwright: .spec.ts  (expect() assertions)
 *   - Cypress:   .cy.ts    (cy.should() / assert / expect assertions)
 *
 * Usage:
 *   node scripts/validate-test-quality.js
 *
 * Exits 0 if all checks pass, 1 if any violation is found.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Directories to scan
// ---------------------------------------------------------------------------

const PLAYWRIGHT_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'tests');
const CYPRESS_DIR    = path.join('qa-framework', 'frameworks', 'cypress',    'tests');

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

// AC traceability — must have // Jira: SCRUM-XX somewhere in file
const JIRA_HEADER_RE = /\/\/\s*Jira\s*:/i;

// ─── Playwright ─────────────────────────────────────────────────────────────

// Real assertions — NOT trivially true (e.g. .toBe(true), .toBeTruthy() with no value)
const PW_REAL_ASSERT_RE = /expect\s*\(\s*(?!true\b|false\b)([^)]+)\)\s*\.\s*(?:toBe|toEqual|toContain|toHaveText|toHaveValue|toHaveURL|toHaveTitle|toBeVisible|toBeEnabled|toBeDisabled|toBeChecked|toHaveCount|toHaveAttribute|toHaveClass|toMatchSnapshot|toMatchRegex|toHaveLength|toBeGreaterThan|toBeLessThan|not\.\w+)/;

// Weak-only assertions (trivial)
const PW_WEAK_ASSERT_RE = /expect\s*\(\s*(?:true|page|response)\s*\)\s*\.\s*(?:toBeTruthy|toBeDefined|not\.toBeFalsy)\s*\(\s*\)/g;

// Navigation calls
const PW_NAV_RE = /(?:page\.goto|page\.navigate|page\.reload)\s*\(/;

// Any expect()
const PW_HAS_EXPECT_RE = /expect\s*\(/;

// Observability — must have at least one console.log() call
const PW_HAS_CONSOLE_LOG_RE = /console\.log\s*\(/;

// ─── Cypress ────────────────────────────────────────────────────────────────

// Real assertions
const CY_REAL_ASSERT_RE = /(?:cy\.(?:get|find|contains|url|title|location)\s*\([^)]*\)\s*(?:\.should|\.and)\s*\([^)]*\)|assert\s*\.\w+|expect\s*\(\s*(?!true\b|false\b)[^)]+\))/;

// Weak-only Cypress assertions
const CY_WEAK_ASSERT_RE = /\.should\s*\(\s*['"]exist['"]\s*\)\s*$|\.should\s*\(\s*['"]be\.visible['"]\s*\)\s*$/gm;

// Navigation calls
const CY_NAV_RE = /cy\.(?:visit|go|reload)\s*\(/;

// Any should() — also accepts page-object assertion/verify methods (e.g. inventoryPage.assertOnPage())
const CY_HAS_SHOULD_RE = /\.should\s*\(|assert\.|expect\s*\(|\.\s*assert[A-Z]\w*\s*\(|\.\s*verify[A-Z]\w*\s*\(/;

// Observability — must have at least one cy.log() call
const CY_HAS_CY_LOG_RE = /cy\.log\s*\(/;

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

const violations = [];

function addViolation(file, rule, detail) {
  violations.push({ file: path.relative(process.cwd(), file), rule, detail });
}

function isExempt(filename, filePath) {
  return (
    filename === 'seed.spec.ts'    ||
    filename === 'example.spec.ts' ||
    filename.includes('.notimplemented.') ||
    filename === '_TEMPLATE.spec.ts' ||
    filename === '_TEMPLATE.cy.ts'  ||
    // SCRUM-16 is a learning/exploration series, not story-driven tests —
    // AC traceability and per-test AC comments are not required.
    (filePath && filePath.includes('SCRUM-16'))
  );
}

function checkPlaywrightFile(filePath) {
  const src      = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);

  // Rule 0: Empty / stub file — must contain at least one test() block              (R7)
  if (!/\btest\s*\(/.test(src)) {
    addViolation(filePath, 'EMPTY_FILE',
      'No test() blocks found. This file is empty or a stub. ' +
      'Add at least one test() block or move the file to notimplemented/.');
  }

  // Rule 1: AC traceability
  if (!JIRA_HEADER_RE.test(src)) {
    addViolation(filePath, 'MISSING_AC_TRACEABILITY',
      'No "// Jira: SCRUM-XX" header found. Every test file must trace back to a Jira story.');
  }

  // Rule 5: Observability — must have at least one console.log()
  if (!PW_HAS_CONSOLE_LOG_RE.test(src)) {
    addViolation(filePath, 'MISSING_OBSERVABILITY',
      'No console.log() found. Playwright files must include [STEP]/[NAV]/[ASSERT] log calls for CI observability.');
  }

  // Split into test blocks to check each individually
  const testBlocks = extractTestBlocks(src, 'playwright');

  for (const block of testBlocks) {
    const blockSrc = block.src;
    const blockId  = `${filename}:${block.name}`;

    const hasNav    = PW_NAV_RE.test(blockSrc);
    const hasExpect = PW_HAS_EXPECT_RE.test(blockSrc);

    // Rule 2: Navigation-only test
    if (hasNav && !hasExpect) {
      addViolation(filePath, 'NAVIGATION_ONLY',
        `Test "${block.name}" navigates but has no expect() assertion — add meaningful assertions`);
    }

    // Rule 3: No assertions at all
    if (!hasExpect) {
      addViolation(filePath, 'NO_ASSERTIONS',
        `Test "${block.name}" has no expect() calls — must assert something`);
    }

    // Rule 4: Weak assertions only
    if (hasExpect && !PW_REAL_ASSERT_RE.test(blockSrc)) {
      const weakMatches = blockSrc.match(PW_WEAK_ASSERT_RE) || [];
      if (weakMatches.length > 0) {
        addViolation(filePath, 'WEAK_ASSERTIONS_ONLY',
          `Test "${block.name}" uses only trivially-true assertions (e.g. toBeTruthy()). ` +
          'Add specific assertions like toHaveText(), toHaveURL(), toBeVisible().');
      }
    }

    // Rule 7: AC-level traceability — each test block must be preceded by // AC-N: comment
    if (block.pos !== undefined) {
      const preceding = src.slice(Math.max(0, block.pos - 300), block.pos);
      if (!/\/\/\s*AC[-\s]?\d+/i.test(preceding)) {
        addViolation(filePath, 'MISSING_AC_COMMENT',
          `Test "${block.name}" is missing a "// AC-N:" traceability comment. ` +
          'Add "// AC-1: <exact AC text from Jira>" immediately before each test().');
      }
    }
  }
}

function checkCypressFile(filePath) {
  const src      = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);

  // Rule 0: Empty / stub file — must contain at least one it() block               (R7)
  if (!/\bit\s*\(/.test(src)) {
    addViolation(filePath, 'EMPTY_FILE',
      'No it() blocks found. This file is empty or a stub. ' +
      'Add at least one it() block or move the file to notimplemented/.');
  }

  // Rule 1: AC traceability
  if (!JIRA_HEADER_RE.test(src)) {
    addViolation(filePath, 'MISSING_AC_TRACEABILITY',
      'No "// Jira: SCRUM-XX" header found. Every test file must trace back to a Jira story.');
  }

  // Rule 6: Observability — must have at least one cy.log()
  if (!CY_HAS_CY_LOG_RE.test(src)) {
    addViolation(filePath, 'MISSING_OBSERVABILITY',
      'No cy.log() found. Cypress files must include cy.log() calls for CI observability.');
  }

  const testBlocks = extractTestBlocks(src, 'cypress');

  for (const block of testBlocks) {
    const blockSrc = block.src;
    const blockId  = `${filename}:${block.name}`;

    const hasNav    = CY_NAV_RE.test(blockSrc);
    const hasAssert = CY_HAS_SHOULD_RE.test(blockSrc);

    // Rule 2: Navigation-only test
    if (hasNav && !hasAssert) {
      addViolation(filePath, 'NAVIGATION_ONLY',
        `Test "${block.name}" visits pages but has no cy.should()/assert/expect — add assertions`);
    }

    // Rule 3: No assertions at all
    if (!hasAssert) {
      addViolation(filePath, 'NO_ASSERTIONS',
        `Test "${block.name}" has no assertions — must use cy.should(), assert, or expect`);
    }

    // Rule 4: Weak assertions only (exist/visible with no value check)
    if (hasAssert && !CY_REAL_ASSERT_RE.test(blockSrc)) {
      const weakMatches = blockSrc.match(CY_WEAK_ASSERT_RE) || [];
      if (weakMatches.length > 0) {
        addViolation(filePath, 'WEAK_ASSERTIONS_ONLY',
          `Test "${block.name}" uses only .should('exist') or .should('be.visible'). ` +
          "Add value-checking assertions like .should('have.text', '...') or .should('have.value', '...').");
      }
    }

    // Rule 8: AC-level traceability — each test block must be preceded by // AC-N: comment
    if (block.pos !== undefined) {
      const preceding = src.slice(Math.max(0, block.pos - 300), block.pos);
      if (!/\/\/\s*AC[-\s]?\d+/i.test(preceding)) {
        addViolation(filePath, 'MISSING_AC_COMMENT',
          `Test "${block.name}" is missing a "// AC-N:" traceability comment. ` +
          'Add "// AC-1: <exact AC text from Jira>" immediately before each it().');
      }
    }
  }
}

/**
 * Extract test block bodies from source.
 * Handles:
 *   test('name', async ({ page }) => { ... })     ← Playwright (destructured params)
 *   test('name', async (page) => { ... })         ← Playwright (simple params)
 *   it('name', () => { ... })                     ← Cypress/Jest arrow
 *   it('name', function() { ... })                ← Cypress/Jest classic
 */
function extractTestBlocks(src, framework) {
  const blocks = [];
  const testRe = /(?:^|\n)\s*(?:test|it)\s*\(\s*(['"`])(.*?)\1/g;
  let match;

  while ((match = testRe.exec(src)) !== null) {
    const name      = match[2] || 'unnamed';
    const scanStart = match.index + match[0].length;

    // Strategy: find the function body '{' by looking for:
    //   1. An arrow '=>' after the test name, then the first '{' after it
    //   2. Or the keyword 'function', then the first '{' after it
    //   3. Fallback: skip paren-balanced argument list then take first '{'
    let braceStart = -1;

    const arrowIdx    = src.indexOf('=>', scanStart);
    const functionIdx = src.indexOf('function', scanStart);

    if (arrowIdx !== -1 && (functionIdx === -1 || arrowIdx < functionIdx)) {
      // Arrow function: find first '{' after '=>'
      braceStart = src.indexOf('{', arrowIdx + 2);
    } else if (functionIdx !== -1) {
      // Classic function keyword: find first '{' after 'function'
      braceStart = src.indexOf('{', functionIdx + 8);
    } else {
      // Fallback: skip paren depth to end of argument list, then first '{'
      let depth = 0, i = scanStart;
      while (i < src.length) {
        if (src[i] === '(') { depth++; }
        else if (src[i] === ')') { depth--; if (depth < 0) { braceStart = src.indexOf('{', i); break; } }
        i++;
      }
    }

    if (braceStart === -1) continue;

    // Guard: the '{' we found must be reasonably close (within ~500 chars)
    if (braceStart - scanStart > 500) continue;

    // Walk forward to find balanced closing brace (function body)
    let depth = 1;
    let i     = braceStart + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }

    const body = src.slice(braceStart, i);
    // Only useful if body is non-trivial (>10 chars)
    if (body.length > 10) {
      blocks.push({ name, src: body, pos: match.index });
    }
  }

  // If no test blocks extracted fall back to whole-file check
  if (blocks.length === 0) {
    blocks.push({ name: '(whole file)', src });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Scan directories
// ---------------------------------------------------------------------------

function scanDir(dir, ext, checkFn) {
  if (!fs.existsSync(dir)) return;
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(ext)) continue;
      if (isExempt(entry.name, full)) continue;
      checkFn(full);
    }
  })(dir);
}

scanDir(PLAYWRIGHT_DIR, '.spec.ts', checkPlaywrightFile);
scanDir(CYPRESS_DIR,    '.cy.ts',   checkCypressFile);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const total = (function countFiles(dirs, exts) {
  let n = 0;
  dirs.forEach((dir, i) => {
    const ext = exts[i];
    if (!fs.existsSync(dir)) return;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(ext) && !isExempt(e.name, full)) n++;
      }
    })(dir);
  });
  return n;
})([PLAYWRIGHT_DIR, CYPRESS_DIR], ['.spec.ts', '.cy.ts']);

if (violations.length === 0) {
  console.log(`\n✅ Quality gate: PASSED — ${total} test file(s) checked, 0 violations.\n`);
  process.exit(0);
}

console.error(`\n❌ Quality gate: FAILED — ${violations.length} violation(s) in ${total} file(s) checked.\n`);

// Group by rule
const byRule = {};
for (const v of violations) {
  (byRule[v.rule] = byRule[v.rule] || []).push(v);
}

for (const [rule, items] of Object.entries(byRule)) {
  console.error(`  [${rule}] (${items.length} occurrence(s))`);
  items.forEach((v, i) => {
    console.error(`    ${i + 1}. ${v.file}`);
    console.error(`       → ${v.detail}`);
  });
  console.error('');
}

console.error('Fix these violations in your test files before the pipeline can proceed.');
console.error('Run @playwright-test-healer or @cypress-test-healer to auto-fix.\n');
process.exit(1);
