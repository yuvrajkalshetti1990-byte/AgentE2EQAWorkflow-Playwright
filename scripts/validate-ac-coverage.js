#!/usr/bin/env node
'use strict';
/**
 * AC Coverage Enforcement Gate                                          (R2)
 *
 * Ensures no story ships with incomplete Acceptance Criteria coverage.
 *
 * Scans:
 *   - Implemented ACs: "// AC-N:" comments in test files
 *   - NotImplemented ACs: @ac tags in qa-framework/notimplemented/ stubs
 *
 * Rules:
 *   - Reports total/implemented/notImplemented counts
 *   - If notImplemented > 0:
 *       AC_GATE_MODE=warn  (default) → print warning, exit 0
 *       AC_GATE_MODE=fail            → print details, exit 1
 *
 * Usage:
 *   node scripts/validate-ac-coverage.js
 *   AC_GATE_MODE=fail node scripts/validate-ac-coverage.js
 *
 * Exits 0 on pass/warn, 1 on fail.
 */

const fs   = require('fs');
const path = require('path');

const MODE    = process.env.AC_GATE_MODE || 'warn';   // 'warn' | 'fail'

const PW_TESTS_DIR  = path.join('qa-framework', 'frameworks', 'playwright', 'tests');
const CY_TESTS_DIR  = path.join('qa-framework', 'frameworks', 'cypress',    'tests');
const NOT_IMPL_DIR  = path.join('qa-framework', 'notimplemented');

// ── Collect implemented ACs from test source files ───────────────────────────
// Matches: // AC-1:  // AC 3:  // AC-10:
const AC_COMMENT_RE = /\/\/\s*AC[-\s]?(\d+)/gi;

function collectImplementedAcs(dir, ext) {
  const acs = new Set();
  if (!fs.existsSync(dir)) return acs;

  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(ext)) continue;
      if (entry.name.includes('.notimplemented.')) continue;
      if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
      if (entry.name.startsWith('_TEMPLATE')) continue;

      const src = fs.readFileSync(full, 'utf8');
      // Extract Jira key from header line
      const jiraMatch = src.match(/\/\/\s*Jira\s*:\s*([\w-]+)/i);
      const story = jiraMatch ? jiraMatch[1].toUpperCase() : 'UNKNOWN';

      let m;
      while ((m = AC_COMMENT_RE.exec(src)) !== null) {
        acs.add(`${story}|AC-${m[1]}`);
      }
      AC_COMMENT_RE.lastIndex = 0;
    }
  })(dir);

  return acs;
}

// ── Collect not-implemented ACs from stubs ────────────────────────────────────
function collectNotImplementedAcs(dir) {
  const stubs = [];
  if (!fs.existsSync(dir)) return stubs;

  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.cy.ts') && !entry.endsWith('.spec.ts')) continue;
    if (entry.startsWith('_TEMPLATE')) continue;

    const src  = fs.readFileSync(path.join(dir, entry), 'utf8');
    const jira     = (src.match(/@jira\s+(\S+)/)   || [])[1] || 'UNKNOWN';
    const ac       = (src.match(/@ac\s+(\S+)/)      || [])[1] || '?';
    const acText   = (src.match(/@acText\s+"([^"]+)"/) || [])[1] || '(no text)';
    const category = (src.match(/@category\s+(\S+)/)   || [])[1] || 'UNKNOWN';
    stubs.push({
      file:     entry,
      key:      `${jira.toUpperCase()}|AC-${ac}`,
      jira:     jira.toUpperCase(),
      ac,
      acText,
      category,
    });
  }
  return stubs;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const pwAcs      = collectImplementedAcs(PW_TESTS_DIR,  '.spec.ts');
const cyAcs      = collectImplementedAcs(CY_TESTS_DIR,  '.cy.ts');
const allAcs     = new Set([...pwAcs, ...cyAcs]);
const notImpl    = collectNotImplementedAcs(NOT_IMPL_DIR);
const implCount  = allAcs.size;
const notImplCnt = notImpl.length;
const totalAcs   = implCount + notImplCnt;

console.log('');
console.log('AC COVERAGE REPORT');
console.log('──────────────────────────────────────────────');
console.log(`  Implemented ACs   : ${implCount}`);
console.log(`  Not-Implemented   : ${notImplCnt}`);
console.log(`  Total ACs tracked : ${totalAcs}`);
console.log('');

if (notImplCnt > 0) {
  console.log('NOT-IMPLEMENTED ACs (require manual verification):');
  notImpl.forEach(s => {
    console.log(`  • ${s.jira} AC-${s.ac} [${s.category}]: ${s.acText}`);
    console.log(`    → stub: qa-framework/notimplemented/${s.file}`);
  });
  console.log('');
}

if (implCount > 0) {
  // Print story-level summary
  const byStory = {};
  for (const key of allAcs) {
    const [story] = key.split('|');
    byStory[story] = (byStory[story] || 0) + 1;
  }
  console.log('Implemented AC breakdown by story:');
  for (const [story, count] of Object.entries(byStory).sort()) {
    console.log(`  ${story}: ${count} AC(s) covered`);
  }
  console.log('');
}

if (notImplCnt === 0) {
  console.log('AC coverage gate: PASS — all tracked ACs are implemented.');
  process.exit(0);
}

const label = notImplCnt === 1 ? '1 AC remains' : `${notImplCnt} ACs remain`;
const msg   = `${label} NOT IMPLEMENTED — manual verification required before story can be marked Done.`;

if (MODE === 'fail') {
  console.error('AC coverage gate: FAIL (AC_GATE_MODE=fail) — ' + msg);
  console.error('Resolve by completing automation or explicitly marking stubs as accepted limitations.');
  console.error('');
  process.exit(1);
} else {
  // warn (default)
  console.warn('AC coverage gate: WARN — ' + msg);
  console.warn('Set AC_GATE_MODE=fail to block the pipeline on incomplete AC coverage.');
  console.warn('');
  process.exit(0);
}
