#!/usr/bin/env node
/**
 * Playwright Data Dependency Validator
 *
 * Scans all Playwright test files (.spec.ts) for file-system data dependencies:
 *   1. fs.readFileSync('<path>')            — explicit file reads
 *   2. test.use({ storageState: '<path>' }) — stored authentication state
 *   3. require('<path>.json')              — CommonJS JSON imports
 *   4. import ... from '<path>.json'        — ESM JSON imports
 *   5. // @requiredFiles: ["<file>", ...]   — explicit declaration (recommended)
 *
 * For every referenced file, validates that:
 *   - The file exists relative to the test file, OR
 *   - The file exists relative to the project root
 *
 * If ANY referenced file is missing:
 *   → console.error with the test file and the missing path
 *   → process.exit(1)  — blocks CI before any browser is launched
 *
 * If all references are valid:
 *   → console.log("Playwright data validation: OK")
 *   → process.exit(0)
 *
 * Usage:
 *   node scripts/validate-playwright-data.js
 *
 * Exempted files: seed.spec.ts, example.spec.ts, *.notimplemented.spec.ts
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const TESTS_DIR = path.join('qa-framework', 'frameworks', 'playwright', 'tests');

// ---------------------------------------------------------------------------
// Patterns to detect file references
// ---------------------------------------------------------------------------

// 1. fs.readFileSync('path') / fs.readFileSync("path") / fs.readFileSync(`path`)
const FS_READ_RE = /fs\.readFileSync\s*\(\s*(['"`])([^'"`]+)\1/g;

// 2. storageState: 'path' / storageState: "path" (test.use or fixture calls)
const STORAGE_STATE_RE = /storageState\s*:\s*(['"`])([^'"`]+)\1/g;

// 3. require('path.json') require("path.json") — only data files (json/csv/txt)
const REQUIRE_RE = /\brequire\s*\(\s*(['"`])([^'"`]+\.(?:json|csv|txt))\1/g;

// 4. import ... from 'path.json' / import 'path.json'
const IMPORT_JSON_RE = /\bimport\b[^'"`\n]*['"`]([^'"`]+\.json)['"`]/g;

// 5. // @requiredFiles: ["file1.json", "file2.json"]
const REQUIRED_FILES_META_RE = /@requiredFiles\s*:\s*(\[[^\]]+\])/;

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

function resolveRef(ref, testFileDir) {
  if (path.isAbsolute(ref)) return path.normalize(ref);
  // Try relative to the test file first, then relative to project root
  const fromTestFile = path.resolve(testFileDir, ref);
  if (fs.existsSync(fromTestFile)) return fromTestFile;
  const fromRoot = path.resolve(process.cwd(), ref);
  return fromRoot;
}

function refExists(ref, testFileDir) {
  if (!ref || ref.trim() === '' || ref.startsWith('http') || ref.startsWith('data:')) return true;
  const fromTestFile = path.resolve(testFileDir, ref);
  if (fs.existsSync(fromTestFile)) return true;
  const fromRoot = path.resolve(process.cwd(), ref);
  return fs.existsSync(fromRoot);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const violations = [];
let totalFiles = 0;
let totalRefs  = 0;

function addMissing(testFilePath, ref) {
  const rel = path.relative(process.cwd(), testFilePath);
  const testFileDir = path.dirname(testFilePath);
  const candidatePaths = [
    path.resolve(testFileDir, ref),
    path.resolve(process.cwd(), ref),
  ];
  violations.push({ file: rel, ref, candidates: candidatePaths });
}

// ---------------------------------------------------------------------------
// Per-file scan
// ---------------------------------------------------------------------------

function scanFile(filePath) {
  const src        = fs.readFileSync(filePath, 'utf8');
  const testFileDir = path.dirname(filePath);

  function check(ref) {
    if (!ref || ref.trim() === '' || ref.startsWith('http') || ref.startsWith('data:')) return;
    totalRefs++;
    if (!refExists(ref, testFileDir)) {
      addMissing(filePath, ref);
    }
  }

  let m;

  // Pattern 1: fs.readFileSync
  FS_READ_RE.lastIndex = 0;
  while ((m = FS_READ_RE.exec(src)) !== null) {
    check(m[2]);
  }

  // Pattern 2: storageState
  STORAGE_STATE_RE.lastIndex = 0;
  while ((m = STORAGE_STATE_RE.exec(src)) !== null) {
    check(m[2]);
  }

  // Pattern 3: require(*.json / *.csv / *.txt)
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(src)) !== null) {
    check(m[2]);
  }

  // Pattern 4: import ... from '*.json'
  IMPORT_JSON_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_RE.exec(src)) !== null) {
    check(m[1]);
  }

  // Pattern 5: // @requiredFiles: [...]
  const metaMatch = REQUIRED_FILES_META_RE.exec(src);
  if (metaMatch) {
    try {
      const files = JSON.parse(metaMatch[1]);
      if (Array.isArray(files)) {
        files.forEach(f => check(String(f)));
      }
    } catch (e) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        ref: '@requiredFiles metadata parse error',
        candidates: [e.message],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Directory walk
// ---------------------------------------------------------------------------

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!entry.name.endsWith('.spec.ts')) continue;
    // Exempt standard boilerplate and notimplemented stubs
    if (entry.name === 'seed.spec.ts' || entry.name === 'example.spec.ts') continue;
    if (entry.name.includes('.notimplemented.')) continue;
    totalFiles++;
    scanFile(full);
  }
}

scan(TESTS_DIR);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (violations.length > 0) {
  console.error('');
  console.error('PLAYWRIGHT DATA VALIDATION FAIL — ' + violations.length + ' missing file reference(s) found.\n');
  violations.forEach(function(v, i) {
    console.error('  [' + (i + 1) + '] ' + v.file);
    console.error('       Referenced: ' + v.ref);
    console.error('       Checked:');
    v.candidates.forEach(function(c) { console.error('         ' + c); });
    console.error('');
  });
  console.error('Fix: ensure all referenced data files are committed to the repository.');
  console.error('     Declare files explicitly with: // @requiredFiles: ["path/to/file.json"]');
  console.error('');
  process.exit(1);
}

console.log(
  'Playwright data validation: OK — ' +
  totalFiles + ' file(s) scanned, ' +
  totalRefs + ' data reference(s) verified.'
);
