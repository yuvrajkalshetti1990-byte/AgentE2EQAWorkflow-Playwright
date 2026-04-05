#!/usr/bin/env node
'use strict';
/**
 * AC → Test → Execution Validation Gate                                 (R7)
 *
 * STRICT MODE (default): FAILS pipeline if any AC has a test file but the
 * test was never executed (test result not present or test was skipped).
 *
 * Mapping chain:
 *   AC (// AC-N: comment in spec file)
 *     → Test file (spec file containing the AC comment)
 *       → Execution result (entry in Playwright JSON / Mochawesome JSON)
 *
 * FAIL if:
 *   - A spec file exists with an AC comment but no matching entry in results
 *   - A test in results has status="skipped" and no @skip-reason annotation
 *
 * Usage:
 *   node scripts/validate-ac-execution.js \
 *     --results-json path/to/results.json \
 *     --framework playwright|cypress
 *
 * Exits 0 on pass, 1 on violations.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const eq  = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
const resultsJson = getArg('--results-json');
const fw          = getArg('--framework') || 'playwright';

if (!resultsJson) {
  console.error('[ac-execution] ERROR: --results-json is required.');
  process.exit(1);
}

if (!fs.existsSync(resultsJson)) {
  console.error(`[ac-execution] ERROR: Results file not found: "${resultsJson}"`);
  console.error('Tests must be run before executing this gate. Ensure the test step precedes this validation.');
  process.exit(1);
}

// ── Collect spec files with AC comments ───────────────────────────────────────
const AC_COMMENT_RE  = /\/\/\s*AC[-\s]?(\d+)/i;
const JIRA_RE        = /\/\/\s*Jira\s*:\s*([\w-]+)/i;
const SKIP_REASON_RE = /test\.skip|it\.skip|\/\/\s*@skip-reason/i;

const TESTS_DIR = fw === 'playwright'
  ? path.join('qa-framework', 'frameworks', 'playwright', 'tests')
  : path.join('qa-framework', 'frameworks', 'cypress',    'tests');
const EXT = fw === 'playwright' ? '.spec.ts' : '.cy.ts';

const specFiles = [];  // { file, story, acNumbers[] }

(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith(EXT)) continue;
    if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
    if (entry.name.includes('.notimplemented.')) continue;
    if (entry.name.startsWith('_TEMPLATE')) continue;

    const src     = fs.readFileSync(full, 'utf8');
    const jiraM   = src.match(JIRA_RE);
    const story   = jiraM ? jiraM[1].toUpperCase() : path.basename(path.dirname(full)).toUpperCase();
    const acNums  = [];

    const re = /\/\/\s*AC[-\s]?(\d+)/gi;
    let m;
    while ((m = re.exec(src)) !== null) acNums.push(m[1]);

    if (acNums.length > 0) {
      specFiles.push({ file: path.relative(process.cwd(), full), story, acNums: [...new Set(acNums)] });
    }
  }
})(TESTS_DIR);

// ── Parse execution results ───────────────────────────────────────────────────
let raw;
try {
  raw = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));
} catch (e) {
  console.error(`[ac-execution] ERROR: Cannot parse results JSON: ${e.message}`);
  process.exit(1);
}

// Build executed-file set and skipped-test set from results
const executedFiles = new Set();   // file titles / paths referenced in results
const skippedTests  = [];          // { title, file } — tests skipped without reason

if (fw === 'playwright') {
  function walkSuites(suites, parentFile) {
    for (const suite of (suites || [])) {
      const fileRef = suite.file || parentFile || suite.title || '';
      for (const spec of (suite.specs || [])) {
        for (const test of (spec.tests || [])) {
          if (fileRef) executedFiles.add(path.normalize(fileRef));
          if (test.status === 'skipped' || test.status === 'pending') {
            skippedTests.push({ title: spec.title, file: fileRef });
          }
        }
      }
      walkSuites(suite.suites || [], fileRef);
    }
  }
  walkSuites(raw.suites || []);
} else {
  // Cypress Mochawesome
  function walkMocha(suite, fileRef) {
    const fr = suite.file || fileRef || '';
    for (const t of (suite.tests || [])) {
      if (fr) executedFiles.add(path.normalize(fr));
      if (t.pending === true || t.pass === false && t.fail === false) {
        skippedTests.push({ title: t.title, file: fr });
      }
    }
    for (const nested of (suite.suites || [])) walkMocha(nested, fr);
  }
  for (const result of (raw.results || [])) {
    for (const suite of (result.suites || [])) walkMocha(suite, result.file || '');
  }
}

// ── Validate: every spec file with ACs must appear in executed files ──────────
const violations = [];
const warnings   = [];

for (const spec of specFiles) {
  // Normalise the spec path for comparison with results (Playwright uses relative paths)
  const normSpec = path.normalize(spec.file);
  const basename  = path.basename(spec.file, EXT);

  // Check if this file appears in the executed set (by basename or partial path match)
  const wasExecuted = [...executedFiles].some(f =>
    f.includes(basename) || f === normSpec || normSpec.includes(path.basename(f, EXT))
  );

  if (!wasExecuted) {
    violations.push(
      `AC NOT EXECUTED: ${spec.file}\n` +
      `  Story: ${spec.story} | ACs: ${spec.acNums.map(n => 'AC-' + n).join(', ')}\n` +
      `  This file has AC mappings but no matching test execution result was found.\n` +
      `  Ensure tests were run before this validation gate.`
    );
  }
}

// ── Validate: no tests skipped without a documented reason ───────────────────
for (const skipped of skippedTests) {
  // Read the source to check for @skip-reason annotation
  const matchingSpec = specFiles.find(s =>
    skipped.file.includes(path.basename(s.file, EXT)) ||
    s.file.includes(path.basename(skipped.file || '', EXT))
  );

  if (matchingSpec) {
    const src = fs.readFileSync(matchingSpec.file, 'utf8');
    if (!SKIP_REASON_RE.test(src)) {
      violations.push(
        `SKIPPED WITHOUT REASON: "${skipped.title}" in ${skipped.file}\n` +
        `  Skipped tests must have a documented reason: add // @skip-reason: <explanation>\n` +
        `  or use test.fixme() with a descriptive comment. Silent skips are not permitted.`
      );
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('');
console.log('AC EXECUTION VALIDATION REPORT');
console.log('──────────────────────────────────────────────');
console.log(`  Framework   : ${fw}`);
console.log(`  Spec files  : ${specFiles.length}`);
console.log(`  Executed    : ${executedFiles.size}`);
console.log(`  Violations  : ${violations.length}`);
console.log('');

if (violations.length === 0) {
  console.log('AC execution gate: ✅ PASS — all ACs have matching execution results.');
  process.exit(0);
}

console.error('AC execution gate: ❌ FAIL — ' + violations.length + ' ACs with execution gaps:\n');
violations.forEach((v, i) => console.error(`  [${i + 1}] ${v}\n`));
console.error('Every AC must be both implemented AND executed. No phantom coverage.');
console.error('');
process.exit(1);
