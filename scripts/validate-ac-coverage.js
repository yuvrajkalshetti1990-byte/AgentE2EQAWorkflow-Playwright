#!/usr/bin/env node
'use strict';
/**
 * AC Coverage Enforcement Gate                                          (R2)
 *
 * STRICT MODE (default): FAILS the pipeline if any story has not-implemented ACs.
 *
 * Scans:
 *   - Implemented ACs  : "// AC-N:" comments in .spec.ts / .cy.ts test files
 *   - NotImplemented ACs: @ac tags in qa-framework/notimplemented/ stubs
 *
 * Rules:
 *   - If notImplemented > 0 → FAIL (exit 1) unless ALLOW_PARTIAL_AC=true
 *   - ALLOW_PARTIAL_AC=true → warn only, exit 0 (explicit override required)
 *
 * Usage:
 *   node scripts/validate-ac-coverage.js
 *   ALLOW_PARTIAL_AC=true node scripts/validate-ac-coverage.js
 *
 * Exits 0 on pass or when ALLOW_PARTIAL_AC=true, 1 when not-implemented ACs found.
 */

const fs   = require('fs');
const path = require('path');
const E    = require('./enforcement-config');

// ALLOW_PARTIAL_AC=true is the only escape hatch — must be explicit
const ALLOW_PARTIAL = E.ALLOW_PARTIAL_AC;

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
  console.log('AC coverage gate: ✅ PASS — all tracked ACs are implemented.');
  process.exit(0);
}

const label = notImplCnt === 1 ? '1 AC remains' : `${notImplCnt} ACs remain`;
const msg   = `${label} NOT IMPLEMENTED — story cannot be marked Done until all ACs are covered.`;

if (ALLOW_PARTIAL) {
  // Explicit override — warn but do not block
  console.warn('AC coverage gate: ⚠️  WARN (ALLOW_PARTIAL_AC=true) — ' + msg);
  console.warn('ALLOW_PARTIAL_AC is an emergency override. Do not ship with missing AC coverage.');
  console.warn('');
  process.exit(0);
} else {
  // Strict enforcement (default)
  console.error('');
  console.error('AC coverage gate: ❌ FAIL — ' + msg);
  console.error('Resolve by:');
  console.error('  1. Completing automation for the above ACs, OR');
  console.error('  2. Moving to notimplemented/ with a documented FRAMEWORK_LIMITATION, OR');
  console.error('  3. Setting ALLOW_PARTIAL_AC=true (emergency override only).');
  console.error('');
  process.exit(1);
}
