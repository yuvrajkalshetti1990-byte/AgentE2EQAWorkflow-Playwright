/**
 * Test Execution Report Generator — TypeScript source
 *
 * Accepts a normalised `TestRunSummary` (output of `test-result-parser.ts`)
 * and produces a polished Markdown report string.
 *
 * CLI runtime: `scripts/generate-report.js` (self-contained CJS, no TS imports needed)
 * TypeScript usage:
 *   import { generateReport } from './report-generator.js';
 *   const md = generateReport(summary, { storyKey: 'SCRUM-42', branch: 'dev', ... });
 */

import type { TestRunSummary, TestCaseResult, TestSuiteResult } from '../types/index.js';
import { analyzeFailure, type FailureAnalysis } from './test-result-parser.js';

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

export interface ReportOptions {
  /** Jira story key, e.g. "SCRUM-42" */
  storyKey:  string;
  /** Git branch name */
  branch:    string;
  /** Full commit SHA */
  commitSha: string;
  /** GitHub Actions run URL */
  runUrl:    string;
}

// ---------------------------------------------------------------------------
// Extended test type that carries failure analysis
// ---------------------------------------------------------------------------

interface AnnotatedTestCase extends TestCaseResult {
  suiteName:   string;
  browser?:    string;
  failureInfo?: FailureAnalysis;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function generateReport(summary: TestRunSummary, opts: ReportOptions): string {
  const allTests = buildAnnotatedTests(summary);
  const sections = [
    buildHeader(summary, opts),
    '---\n',
    buildExecutiveSummary(summary, allTests),
    '---\n',
    buildExecutionResults(summary),
    '---\n',
    buildAcCoverage(allTests, opts.storyKey),
    '---\n',
    buildFailureAnalysis(allTests),
    '---\n',
    buildHealingActivities(allTests),
    '---\n',
    buildCoverageSummary(summary, allTests, opts.storyKey),
    '---\n',
    buildGapsAndRecommendations(allTests),
    buildFooter(opts),
  ];
  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers — annotation
// ---------------------------------------------------------------------------

function buildAnnotatedTests(summary: TestRunSummary): AnnotatedTestCase[] {
  return summary.suites.flatMap((suite: TestSuiteResult) =>
    suite.tests.map((tc: TestCaseResult): AnnotatedTestCase => ({
      ...tc,
      suiteName:   suite.suiteName,
      failureInfo: tc.status === 'failed' ? analyzeFailure(tc.error) : undefined,
    }))
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toFixed(0)}s`;
}

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function statusIcon(status: string): string {
  return status === 'passed'  ? '✅ Pass'  :
         status === 'failed'  ? '❌ Fail'  :
         status === 'skipped' ? '⏭️ Skip'  : '❓';
}

function esc(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 120);
}

function extractAcRefs(text: string): string[] {
  if (!text) return [];
  const raw = text.match(/\bAC[-\s]?\d+\b/gi) ?? [];
  return [...new Set(raw.map(m => 'AC-' + m.replace(/\D/g, '')))];
}

function extractStoryKey(text: string): string | null {
  const m = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildHeader(summary: TestRunSummary, opts: ReportOptions): string {
  const overallStatus = summary.failed > 0 ? '❌ FAIL' : '✅ PASS';
  const shortSha = opts.commitSha ? opts.commitSha.substring(0, 7) : 'unknown';
  const runLink  = opts.runUrl ? `[View Run](${opts.runUrl})` : 'N/A';
  const fwLabel  = summary.framework === 'playwright'
    ? `Playwright (${summary.suites.map(s => s.suiteName).join(', ')})`
    : 'Cypress';

  return [
    `# Test Execution Report — ${opts.storyKey}`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Overall Status** | ${overallStatus} |`,
    `| **Framework** | ${fwLabel} |`,
    `| **Branch** | \`${opts.branch}\` |`,
    `| **Commit** | \`${shortSha}\` |`,
    `| **CI Run** | ${runLink} |`,
    '',
  ].join('\n');
}

function buildExecutiveSummary(
  summary: TestRunSummary,
  allTests: AnnotatedTestCase[]
): string {
  const healingNeeded = allTests.some(t => (t.retries ?? 0) > 0);
  const overallStatus = summary.failed > 0 ? '❌ FAIL' : '✅ PASS';

  return [
    '## 1. Executive Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Overall Status** | ${overallStatus} |`,
    `| **Total Tests** | ${summary.total} |`,
    `| **Passed** | ${summary.passed} (${pct(summary.passed, summary.total)}) |`,
    `| **Failed** | ${summary.failed} (${pct(summary.failed, summary.total)}) |`,
    `| **Skipped / Pending** | ${summary.skipped} (${pct(summary.skipped, summary.total)}) |`,
    `| **Duration** | ${fmtDuration(summary.durationMs)} |`,
    `| **Healing Required** | ${healingNeeded ? 'Yes — retries detected (see Section 5)' : 'No'} |`,
    '',
  ].join('\n');
}

function buildExecutionResults(summary: TestRunSummary): string {
  const lines: string[] = ['## 2. Test Execution Results', ''];
  let idx = 1;

  for (const suite of summary.suites) {
    if (summary.framework === 'playwright') {
      lines.push(`### ${suite.suiteName}`, '');
    }

    if (suite.tests.length === 0) {
      lines.push('_No tests in this suite._', '');
      continue;
    }

    lines.push('| # | Suite | Test Name | Status | Duration |');
    lines.push('|---|-------|-----------|--------|----------|');

    for (const tc of suite.tests) {
      lines.push(
        `| ${idx++} | ${esc(suite.suiteName)} | ${esc(tc.title)} | ${statusIcon(tc.status)} | ${fmtDuration(tc.durationMs)} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildAcCoverage(allTests: AnnotatedTestCase[], storyKey: string): string {
  const acMap: Record<string, Array<{ title: string; status: string }>> = {};
  let acFound = false;

  for (const t of allTests) {
    const refs = [
      ...extractAcRefs(t.title),
      ...extractAcRefs(t.suiteName),
    ];
    if (refs.length) acFound = true;
    for (const ac of refs) {
      if (!acMap[ac]) acMap[ac] = [];
      acMap[ac].push({ title: t.title, status: t.status });
    }
  }

  const lines: string[] = ['## 3. Acceptance Criteria Coverage', ''];

  if (!acFound) {
    lines.push(
      '> **No `AC-N` tags detected in test titles.**',
      '> Prefix `it()` descriptions with the AC reference to enable automated tracking.',
      '>',
      '> **Example:** `it("AC-1: should redirect to inventory on valid login", ...)`',
      '',
    );
  } else {
    lines.push('| AC Reference | Mapped Test | Status |');
    lines.push('|---|---|---|');
    for (const [ac, tests] of Object.entries(acMap).sort()) {
      for (const t of tests) {
        lines.push(`| **${ac}** | ${esc(t.title)} | ${statusIcon(t.status)} |`);
      }
    }
    lines.push('');
  }

  // Story-level summary
  const storyMap: Record<string, { passed: number; failed: number; skipped: number }> = {};
  for (const t of allTests) {
    const key = extractStoryKey(t.suiteName) ?? storyKey;
    if (!storyMap[key]) storyMap[key] = { passed: 0, failed: 0, skipped: 0 };
    storyMap[key][t.status as 'passed' | 'failed' | 'skipped'] =
      (storyMap[key][t.status as 'passed' | 'failed' | 'skipped'] ?? 0) + 1;
  }

  lines.push('**Coverage by Story:**', '');
  lines.push('| Story Key | Tests | Passed | Failed | Skipped | Pass Rate |');
  lines.push('|-----------|-------|--------|--------|---------|-----------|');
  for (const [key, c] of Object.entries(storyMap)) {
    const total = c.passed + c.failed + c.skipped;
    lines.push(`| ${key} | ${total} | ${c.passed} | ${c.failed} | ${c.skipped} | ${pct(c.passed, total)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildFailureAnalysis(allTests: AnnotatedTestCase[]): string {
  const lines: string[] = ['## 4. Failure Analysis', ''];
  const failed = allTests.filter(t => t.status === 'failed');

  if (failed.length === 0) {
    lines.push('> No failures detected in this run. All tests passed or were skipped.', '');
    return lines.join('\n');
  }

  const byCategory: Record<string, AnnotatedTestCase[]> = {};
  for (const t of failed) {
    const cat = t.failureInfo?.category ?? 'UNKNOWN';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  lines.push(`> **${failed.length} test(s) failed** across **${Object.keys(byCategory).length} category(ies).**`, '');

  for (const [cat, tests] of Object.entries(byCategory)) {
    const info = tests[0].failureInfo!;
    lines.push(`### ${cat.replace(/_/g, ' ')} (${tests.length} failure${tests.length > 1 ? 's' : ''})`);
    lines.push('');
    lines.push(`**Auto-fixable:** ${info.autoFixable ? 'Yes' : 'No'}  `);
    lines.push(`**Recommendation:** ${info.recommendation}`);
    lines.push('');
    lines.push('| Suite | Test | Error Snippet |');
    lines.push('|-------|------|----------------|');
    for (const t of tests) {
      const snip = t.error
        ? esc(t.error.split('\n')[0]).substring(0, 100)
        : '_(no message)_';
      lines.push(`| ${esc(t.suiteName)} | ${esc(t.title)} | \`${snip}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildHealingActivities(allTests: AnnotatedTestCase[]): string {
  const lines: string[] = ['## 5. Healing Activities', ''];
  const retried = allTests.filter(t => (t.retries ?? 0) > 0);

  if (retried.length === 0) {
    lines.push('> No healing activity detected — all tests passed or failed cleanly on the first attempt.', '');
    return lines.join('\n');
  }

  lines.push(`> **${retried.length} test(s) required retries** during this run.`, '');
  lines.push('');
  lines.push('| # | Test Name | Retries | Final Status |');
  lines.push('|---|-----------|---------|--------------|');
  retried.forEach((t, i) => {
    lines.push(`| ${i + 1} | ${esc(t.title)} | ${t.retries} | ${statusIcon(t.status)} |`);
  });
  lines.push('');
  lines.push('> Invoke `@playwright-test-healer` or `@cypress-test-healer` with the affected test file to perform automated repairs.');
  lines.push('');

  return lines.join('\n');
}

function buildCoverageSummary(
  summary: TestRunSummary,
  allTests: AnnotatedTestCase[],
  storyKey: string
): string {
  const allAcRefs = [...new Set(
    allTests.flatMap(t => [...extractAcRefs(t.title), ...extractAcRefs(t.suiteName)])
  )];
  const storyKeys = [...new Set(
    allTests.map(t => extractStoryKey(t.suiteName)).filter((k): k is string => k !== null)
  )];
  const hasNeg  = allTests.some(t => /negative|invalid|locked|error|wrong/.test((t.title + t.suiteName).toLowerCase()));
  const hasEdge = allTests.some(t => /edge|boundary|empty|limit|null/.test((t.title + t.suiteName).toLowerCase()));
  const hasApi  = allTests.some(t => /api|network|intercept|mock|stub/.test((t.title + t.suiteName).toLowerCase()));

  return [
    '## 6. Test Coverage Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| **Tests Executed** | ${summary.total} |`,
    `| **Pass Rate** | ${pct(summary.passed, summary.total)} |`,
    `| **AC Tags Found** | ${allAcRefs.length > 0 ? allAcRefs.sort().join(', ') : '_None — see Section 3_'} |`,
    `| **Story Keys Detected** | ${storyKeys.length > 0 ? storyKeys.join(', ') : storyKey} |`,
    `| **Negative Test Coverage** | ${hasNeg  ? '✅ Present' : '⚠️ Not detected'} |`,
    `| **Edge Case Coverage** | ${hasEdge ? '✅ Present' : '⚠️ Not detected'} |`,
    `| **Network / API Coverage** | ${hasApi  ? '✅ Present' : '⚠️ Not detected'} |`,
    '',
  ].join('\n');
}

function buildGapsAndRecommendations(allTests: AnnotatedTestCase[]): string {
  const lines: string[] = ['## 7. Gaps & Recommendations', ''];
  const recs: Array<{ priority: string; issue: string; action: string }> = [];

  // Failure-driven recs
  const byCategory: Record<string, number> = {};
  for (const t of allTests.filter(a => a.status === 'failed')) {
    const cat = t.failureInfo?.category ?? 'UNKNOWN';
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCategory)) {
    const info = allTests.find(t => t.failureInfo?.category === cat)?.failureInfo;
    recs.push({
      priority: info?.autoFixable ? 'High' : 'Medium',
      issue:    `${count} test(s) failing — ${cat.replace(/_/g, ' ')}`,
      action:   info?.recommendation ?? 'Review and fix manually.',
    });
  }

  // Coverage gaps
  const hasNeg  = allTests.some(t => /negative|invalid|locked|error|wrong/.test((t.title + t.suiteName).toLowerCase()));
  const hasEdge = allTests.some(t => /edge|boundary|empty|limit|null/.test((t.title + t.suiteName).toLowerCase()));
  const hasApi  = allTests.some(t => /api|network|intercept|mock|stub/.test((t.title + t.suiteName).toLowerCase()));
  const hasAc   = allTests.some(t => extractAcRefs(t.title + t.suiteName).length > 0);
  const retried = allTests.filter(t => (t.retries ?? 0) > 0);

  if (!hasNeg)  recs.push({ priority: 'Medium', issue: 'No negative scenarios detected', action: 'Add tests for invalid inputs, locked-out users, and server error states.' });
  if (!hasEdge) recs.push({ priority: 'Low', issue: 'No edge / boundary tests detected', action: 'Add tests for empty fields, max-length inputs, and zero-quantity scenarios.' });
  if (!hasApi)  recs.push({ priority: 'Low', issue: 'No network/API interception tests', action: 'Add `cy.intercept()` / `page.route()` assertions on key API calls.' });
  if (!hasAc)   recs.push({ priority: 'Low', issue: 'No AC-N tags in test titles', action: 'Prefix `it()` descriptions with AC references to enable coverage tracking.' });
  if (retried.length > 0) recs.push({ priority: 'High', issue: `${retried.length} test(s) flaky (required retries)`, action: 'Invoke the healer agent to stabilise selector and timing issues.' });

  if (recs.length === 0) {
    lines.push('> No gaps detected. All categories covered, no failures, no flakiness. 🎉', '');
    return lines.join('\n');
  }

  lines.push('| Priority | Gap / Issue | Recommended Action |');
  lines.push('|----------|-------------|-------------------|');
  for (const r of recs) {
    const icon = r.priority === 'High' ? '🔴 High' : r.priority === 'Medium' ? '🟡 Medium' : '🟢 Low';
    lines.push(`| ${icon} | ${esc(r.issue)} | ${esc(r.action)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildFooter(opts: ReportOptions): string {
  return [
    '---',
    '',
    `*Report generated by \`report-generator.ts\` · Story: **${opts.storyKey}** · Branch: \`${opts.branch}\`*`,
    '',
  ].join('\n');
}
