/**
 * Test Execution Report Generator
 *
 * Parses Playwright or Cypress Mochawesome test results JSON and produces a detailed,
 * human-readable Markdown report at:
 *   qa-framework/reports/{story-key}-test-report.md
 *
 * Usage:
 *   node scripts/generate-report.js \
 *     --framework playwright|cypress \
 *     --results-json <path-to-results.json> \
 *     --story-key   SCRUM-101 \
 *     --branch      auto/test-scrum-101 \
 *     --commit-sha  abc1234 \
 *     --run-url     https://github.com/.../actions/runs/123
 *
 *   All flags are optional except --framework and --results-json.
 *   Missing --story-key is inferred from suite titles or the branch name.
 *
 * Exits 0 always — a missing/corrupt results file produces a partial report.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    framework:   'cypress',
    resultsJson: '',
    storyKey:    '',
    branch:      process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || 'unknown',
    commitSha:   process.env.GITHUB_SHA       || 'unknown',
    runUrl:      '',
    outputDir:   'qa-framework/reports',
  };
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
    cfg.runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--framework':   cfg.framework   = args[++i]; break;
      case '--results-json':cfg.resultsJson = args[++i]; break;
      case '--story-key':   cfg.storyKey    = args[++i]; break;
      case '--branch':      cfg.branch      = args[++i]; break;
      case '--commit-sha':  cfg.commitSha   = args[++i]; break;
      case '--run-url':     cfg.runUrl      = args[++i]; break;
      case '--output-dir':  cfg.outputDir   = args[++i]; break;
    }
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Failure classification — per-framework fix matrices
// ---------------------------------------------------------------------------
const FIX_MATRIX_CYPRESS = {
  API_KEY_MISSING: {
    label: 'API Key Missing',
    autoFixable: true,
    recommendation: 'Replace `cy.request()` with `cy.apiRequest()` — it injects `x-api-key` from `Cypress.env("REQRES_API_KEY")` automatically.',
  },
  ENV_MISSING: {
    label: 'Environment Variable Missing',
    autoFixable: true,
    recommendation: 'Guard `Cypress.env()` calls with a fallback: `const val = (Cypress.env("key") as string | undefined) ?? "default";`.',
  },
  DATA_MISSING: {
    label: 'Fixture / Test Data Missing',
    autoFixable: true,
    recommendation: 'Create the missing fixture file under `qa-framework/frameworks/cypress/fixtures/`. `cypress.config.ts` auto-creates standard fixtures on cold start.',
  },
  SELECTOR_ISSUE: {
    label: 'Selector / Element Not Found',
    autoFixable: true,
    recommendation: 'Use `browser_snapshot` to re-inspect current selectors. Prefer `[data-test]` or `[data-cy]` attributes over class names.',
  },
  NETWORK_FAILURE: {
    label: 'Network / Navigation Failure',
    autoFixable: true,
    recommendation: 'Replace `cy.visit()` with `cy.safeVisit()` which adds `failOnStatusCode: false` and retry logging.',
  },
  ASSERTION_FAILURE: {
    label: 'Assertion Mismatch',
    autoFixable: true,
    recommendation: 'Verify the expected value against the live UI. Update the assertion to match current application behaviour.',
  },
  IFRAME_ISSUE: {
    label: 'iframe Interaction Failure',
    autoFixable: true,
    recommendation: 'Replace direct `cy.get()` inside iframes with `cy.withinIframe("selector", ($body) => { cy.wrap($body).find("...") })`.',
  },
  FRAMEWORK_LIMITATION: {
    label: 'Framework Limitation',
    autoFixable: false,
    recommendation: 'This scenario requires non-browser verification (email, DB, file system, OS-level). Cannot be automated as a browser test — move to `notimplemented/`.',
  },
  UNKNOWN: {
    label: 'Unclassified Failure',
    autoFixable: false,
    recommendation: 'Review the raw error message. Re-classify manually once the root cause is identified.',
  },
};

const FIX_MATRIX_PLAYWRIGHT = {
  API_KEY_MISSING: {
    label: 'API Key Missing',
    autoFixable: true,
    recommendation: 'Pass auth headers via `request.post(url, { headers: { "x-api-key": process.env.API_KEY } })`. Store keys as GitHub Actions secrets and inject via `process.env`.',
  },
  ENV_MISSING: {
    label: 'Environment Variable Missing',
    autoFixable: true,
    recommendation: 'Guard `process.env` calls with a fallback: `const val = process.env.MY_VAR ?? "default"`. Declare required env vars in `playwright.config.ts` under `use.extraHTTPHeaders` or pass via dotenv.',
  },
  DATA_MISSING: {
    label: 'Fixture / Test Data Missing',
    autoFixable: true,
    recommendation: 'Load test data with `const data = JSON.parse(fs.readFileSync("path/to/fixture.json", "utf8"))`. Place fixtures under `qa-framework/frameworks/playwright/fixtures/`.',
  },
  SELECTOR_ISSUE: {
    label: 'Selector / Element Not Found',
    autoFixable: true,
    recommendation: 'Use `browser_snapshot` to re-inspect current selectors. Prefer `page.locator(\'[data-test="..."]\')` over class or XPath selectors. Use `await expect(locator).toBeVisible()` before interacting.',
  },
  NETWORK_FAILURE: {
    label: 'Network / Navigation Failure',
    autoFixable: true,
    recommendation: 'Ensure `baseURL` is set in `playwright.config.ts` and use relative paths in `page.goto()`. For flaky navigation, add `{ waitUntil: "networkidle" }`. Check that the CI environment can reach the target URL.',
  },
  ASSERTION_FAILURE: {
    label: 'Assertion Mismatch',
    autoFixable: true,
    recommendation: 'Verify the expected value against the live UI. Use Playwright\'s auto-retrying assertions: `expect(locator).toHaveText()`, `toHaveURL()`, `toBeVisible()`. Avoid `page.evaluate()` for DOM assertions.',
  },
  IFRAME_ISSUE: {
    label: 'iframe Interaction Failure',
    autoFixable: true,
    recommendation: 'Use `page.frameLocator("iframe-selector")` to scope locators inside an iframe: `const frame = page.frameLocator("#my-iframe"); await frame.locator("button").click()`.',
  },
  FRAMEWORK_LIMITATION: {
    label: 'Framework Limitation',
    autoFixable: false,
    recommendation: 'This scenario requires non-browser verification (email, DB, file system, OS-level). Cannot be automated as a browser test — move to `notimplemented/`.',
  },
  UNKNOWN: {
    label: 'Unclassified Failure',
    autoFixable: false,
    recommendation: 'Review the raw error message. Re-classify manually once the root cause is identified.',
  },
};

function getFixMatrix(framework) {
  return framework === 'playwright' ? FIX_MATRIX_PLAYWRIGHT : FIX_MATRIX_CYPRESS;
}

function classifyFailure(errorMessage) {
  if (!errorMessage) return 'UNKNOWN';
  const m = errorMessage.toLowerCase();
  if (m.includes('x-api-key') || m.includes('api key') || m.includes('api-key'))                         return 'API_KEY_MISSING';
  if ((m.includes('cy.type()') && (m.includes('undefined') || m.includes('null'))) ||
       m.includes('only accept a string or number'))                                                        return 'ENV_MISSING';
  if (m.includes('fixture file could not be found') || m.includes('cy.fixture()') ||
      m.includes('no such file') || m.includes('enoent'))                                                   return 'DATA_MISSING';
  if (m.includes('timed out retrying') || m.includes('cy.get()') ||
      m.includes('cy.contains()') || m.includes('not exist in the dom'))                                    return 'SELECTOR_ISSUE';
  if (m.includes('cy.visit()') || m.includes('failed trying to load') ||
      m.includes('status code was not') || m.includes('net::err_') ||
      m.includes('failed to fetch'))                                                                        return 'NETWORK_FAILURE';
  if (m.includes('iframe') || m.includes('frameloaded') ||
      m.includes('requires a valid clearable element'))                                                     return 'IFRAME_ISSUE';
  if ((m.includes('expected') && (m.includes('to have') || m.includes('to equal') ||
      m.includes('to include'))) || m.includes('assertionerror'))                                           return 'ASSERTION_FAILURE';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Playwright JSON parser
// ---------------------------------------------------------------------------
function flattenPlaywrightSuiteTests(suites, browser) {
  const tests = [];
  for (const suite of (suites || [])) {
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        const lastResult = test.results[test.results.length - 1] || {};
        const status = test.status === 'expected'   ? 'passed'  :
                       test.status === 'unexpected' ? 'failed'  : 'skipped';
        tests.push({
          suiteName:  suite.title,
          title:      spec.title,
          fullTitle:  `${suite.title} > ${spec.title}`,
          browser,
          status,
          durationMs: test.duration || 0,
          retries:    Math.max(0, (test.results || []).length - 1),
          error:      lastResult.error?.message,
        });
      }
    }
    tests.push(...flattenPlaywrightSuiteTests(suite.suites || [], browser));
  }
  return tests;
}

function parsePlaywright(raw) {
  const browserGroups = [];
  for (const browserSuite of (raw.suites || [])) {
    const tests = flattenPlaywrightSuiteTests(browserSuite.suites || [], browserSuite.title);
    browserGroups.push({ browser: browserSuite.title, tests });
  }
  return {
    framework:  'playwright',
    total:      (raw.stats.expected || 0) + (raw.stats.unexpected || 0) + (raw.stats.skipped || 0),
    passed:     raw.stats.expected   || 0,
    failed:     raw.stats.unexpected || 0,
    skipped:    raw.stats.skipped    || 0,
    durationMs: raw.stats.duration   || 0,
    startedAt:  raw.stats?.startTime || null,
    browserGroups,
  };
}

// ---------------------------------------------------------------------------
// Cypress Mochawesome parser
// ---------------------------------------------------------------------------
function flattenMochaSuite(suite) {
  const tests = (suite.tests || []).map(t => ({
    suiteName:  suite.title,
    title:      t.title,
    fullTitle:  t.fullTitle || `${suite.title} ${t.title}`,
    browser:    'Electron (Cypress)',
    status:     t.pass ? 'passed' : t.fail ? 'failed' : 'skipped',
    durationMs: t.duration || 0,
    retries:    0,
    error:      (t.err && t.err.message && t.err.message !== '') ? t.err.message : undefined,
  }));
  for (const nested of (suite.suites || [])) {
    tests.push(...flattenMochaSuite(nested));
  }
  return tests;
}

function parseCypress(raw) {
  const allTests = [];
  for (const result of (raw.results || [])) {
    for (const suite of (result.suites || [])) {
      allTests.push(...flattenMochaSuite(suite));
    }
  }
  return {
    framework:    'cypress',
    total:        (raw.stats.passes || 0) + (raw.stats.failures || 0) + (raw.stats.pending || 0),
    passed:       raw.stats.passes   || 0,
    failed:       raw.stats.failures || 0,
    skipped:      raw.stats.pending  || 0,
    durationMs:   raw.stats.duration || 0,
    startedAt:    raw.stats.start    || null,
    browserGroups: [{ browser: 'Electron (Cypress)', tests: allTests }],
  };
}

// ---------------------------------------------------------------------------
// AC reference extraction
// ---------------------------------------------------------------------------
function extractAcRefs(text) {
  if (!text) return [];
  const raw = text.match(/\bAC[-\s]?\d+\b/gi) || [];
  return [...new Set(raw.map(m =>
    'AC-' + m.replace(/\D/g, '')
  ))];
}

function extractStoryKey(text) {
  if (!text) return null;
  const m = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return m ? m[1] : null;
}

function inferStoryKey(run, branch, storyKeyArg) {
  if (storyKeyArg && storyKeyArg !== '') return storyKeyArg;
  // Try branch name: auto/test-scrum-18 -> SCRUM-18
  const branchMatch = branch.match(/auto\/test[-/](.+)/i);
  if (branchMatch) {
    const slug = branchMatch[1];
    // scrum-18 -> SCRUM-18
    return slug.toUpperCase().replace(/-(\d+)$/, '-$1');
  }
  // Try suite titles
  for (const group of run.browserGroups) {
    for (const test of group.tests) {
      const key = extractStoryKey(test.suiteName) || extractStoryKey(test.fullTitle);
      if (key) return key;
    }
  }
  return `CI-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Utility formatters
// ---------------------------------------------------------------------------
function fmtDuration(ms) {
  if (!ms || ms < 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0);
  return `${m}m ${rem}s`;
}

function fmtDate(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  return d.toUTCString().replace('GMT', 'UTC');
}

function statusIcon(status, retries) {
  // A passed test that needed retries is FLAKY — distinct from a clean pass
  if (status === 'passed' && retries > 0) return '⚠️ Flaky';
  return status === 'passed'  ? '✅ Pass'    :
         status === 'failed'  ? '❌ Fail'    :
         status === 'skipped' ? '⏭️ Skip'    : '❓';
}

function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function escapeTable(str) {
  if (!str) return '';
  return String(str).replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 120);
}

// ---------------------------------------------------------------------------
// Report section builders
// ---------------------------------------------------------------------------
function computeOverallStatus(run) {
  if (run.failed > 0) return '❌ FAIL';
  const flakyCount = run.browserGroups.flatMap(g =>
    g.tests.filter(t => t.retries > 0 && t.status === 'passed')
  ).length;
  if (flakyCount > 0) return `⚠️ UNSTABLE (${flakyCount} flaky)`;
  return '✅ PASS';
}

function buildHeader(run, storyKey, cfg) {
  const overallStatus = computeOverallStatus(run);
  const shortSha = cfg.commitSha ? cfg.commitSha.substring(0, 7) : 'unknown';
  const runLink  = cfg.runUrl ? `[View Run](${cfg.runUrl})` : 'N/A';
  const framework = run.framework === 'playwright'
    ? `Playwright (${run.browserGroups.map(g => g.browser).join(', ')})`
    : 'Cypress';

  return [
    `# Test Execution Report — ${storyKey}`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Overall Status** | ${overallStatus} |`,
    `| **Framework** | ${framework} |`,
    `| **Branch** | \`${cfg.branch}\` |`,
    `| **Commit** | \`${shortSha}\` |`,
    `| **CI Run** | ${runLink} |`,
    `| **Generated** | ${fmtDate(run.startedAt)} |`,
    '',
  ].join('\n');
}

function buildExecutiveSummary(run) {
  const flakyTests = run.browserGroups.flatMap(g =>
    g.tests.filter(t => t.retries > 0 && t.status === 'passed')
  );
  const healingNeeded = run.browserGroups.some(g => g.tests.some(t => t.retries > 0));
  const overallStatus = computeOverallStatus(run);

  return [
    '## 1. Executive Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Overall Status** | ${overallStatus} |`,
    `| **Total Tests** | ${run.total} |`,
    `| **Passed** | ${run.passed} (${pct(run.passed, run.total)}) |`,
    `| **Failed** | ${run.failed} (${pct(run.failed, run.total)}) |`,
    `| **Flaky (passed on retry)** | ${flakyTests.length} |`,
    `| **Skipped / Pending** | ${run.skipped} (${pct(run.skipped, run.total)}) |`,
    `| **Duration** | ${fmtDuration(run.durationMs)} |`,
    `| **Healing Required** | ${healingNeeded ? 'Yes — retries detected (see Section 5)' : 'No'} |`,
    '',
  ].join('\n');
}

function buildExecutionResults(run) {
  const lines = ['## 2. Test Execution Results', ''];

  for (const group of run.browserGroups) {
    if (run.framework === 'playwright') {
      lines.push(`### ${group.browser.charAt(0).toUpperCase() + group.browser.slice(1)}`, '');
    }

    if (group.tests.length === 0) {
      lines.push('_No tests executed in this run._', '');
      continue;
    }

    lines.push('| # | Suite | Test Name | Status | Duration |');
    lines.push('|---|-------|-----------|--------|----------|');

    group.tests.forEach((t, idx) => {
      lines.push(
        `| ${idx + 1} | ${escapeTable(t.suiteName)} | ${escapeTable(t.title)} | ${statusIcon(t.status, t.retries)} | ${fmtDuration(t.durationMs)} |`
      );
    });
    lines.push('');
  }

  return lines.join('\n');
}

function buildAcCoverage(run, storyKey) {
  const acMap = {}; // { 'AC-1': [ { title, status } ] }
  let acFound = false;

  for (const group of run.browserGroups) {
    for (const test of group.tests) {
      const refs = extractAcRefs(test.fullTitle)
                    .concat(extractAcRefs(test.suiteName))
                    .concat(extractAcRefs(test.title));
      const deduped = [...new Set(refs)];
      if (deduped.length > 0) acFound = true;
      for (const ac of deduped) {
        if (!acMap[ac]) acMap[ac] = [];
        acMap[ac].push({ title: test.title, status: test.status });
      }
    }
  }

  const lines = ['## 3. AC Coverage', ''];

  if (!acFound) {
    lines.push(
      '> **No `AC-N` tags detected in test titles.**',
      '> To enable automated AC coverage tracking, prefix `it()` descriptions with the AC reference.',
      '>',
      '> **Example:**',
      '> ```ts',
      '> it("AC-1: should redirect to inventory on valid login", () => { ... })',
      '> ```',
      '',
      `**Coverage by test status (${storyKey}):**`,
      '',
    );
  } else {
    lines.push('| AC Reference | Mapped Test | Status |');
    lines.push('|---|---|---|');
    for (const [ac, tests] of Object.entries(acMap).sort()) {
      for (const t of tests) {
        lines.push(`| **${ac}** | ${escapeTable(t.title)} | ${statusIcon(t.status, t.retries)} |`);
      }
    }
    lines.push('');
  }

  // Always show summary table by story key detected in suites
  const storyTests = {};
  for (const group of run.browserGroups) {
    for (const test of group.tests) {
      const key = extractStoryKey(test.suiteName) || extractStoryKey(test.fullTitle) || storyKey;
      if (!storyTests[key]) storyTests[key] = { passed: 0, failed: 0, skipped: 0 };
      storyTests[key][test.status] = (storyTests[key][test.status] || 0) + 1;
    }
  }

  lines.push('**Coverage by Story:**', '');
  lines.push('| Story Key | Tests | Passed | Failed | Skipped | Coverage |');
  lines.push('|-----------|-------|--------|--------|---------|----------|');
  for (const [key, counts] of Object.entries(storyTests)) {
    const total   = counts.passed + counts.failed + counts.skipped;
    const coverage = pct(counts.passed, total);
    lines.push(`| ${key} | ${total} | ${counts.passed} | ${counts.failed || 0} | ${counts.skipped || 0} | ${coverage} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildFailureAnalysis(run) {
  const lines = ['## 4. Failure Analysis', ''];
  const fixMatrix = getFixMatrix(run.framework);

  const failedTests = run.browserGroups.flatMap(g =>
    g.tests
      .filter(t => t.status === 'failed')
      .map(t => ({ ...t, category: classifyFailure(t.error) }))
  );

  if (failedTests.length === 0) {
    lines.push('> No failures detected in this run. All tests passed or were skipped.', '');
    return lines.join('\n');
  }

  // Group by category
  const byCategory = {};
  for (const t of failedTests) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  lines.push(`> **${failedTests.length} test(s) failed** across **${Object.keys(byCategory).length} failure category(ies).**`, '');

  for (const [cat, tests] of Object.entries(byCategory)) {
    const info = fixMatrix[cat] || fixMatrix.UNKNOWN;
    lines.push(`### ${info.label} (${tests.length} failure${tests.length > 1 ? 's' : ''})`);
    lines.push('');
    lines.push(`**Auto-fixable:** ${info.autoFixable ? 'Yes' : 'No'}  `);
    lines.push(`**Recommendation:** ${info.recommendation}`);
    lines.push('');
    lines.push('| Test Suite | Test Name | Error |');
    lines.push('|-----------|-----------|-------|');
    for (const t of tests) {
      const errSnippet = t.error
        ? escapeTable(t.error.split('\n')[0]).substring(0, 100)
        : '_(no error message captured)_';
      lines.push(`| ${escapeTable(t.suiteName)} | ${escapeTable(t.title)} | \`${errSnippet}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildHealingActivities(run) {
  const lines = ['## 5. Healing Activities', ''];

  const retriedTests = run.browserGroups.flatMap(g =>
    g.tests.filter(t => t.retries > 0)
  );

  if (retriedTests.length === 0) {
    lines.push('> No healing activity detected — all tests passed or failed cleanly on the first attempt.', '');
    return lines.join('\n');
  }

  lines.push(`> **${retriedTests.length} test(s) required retries** during this run. High retry counts indicate flaky tests that may need stability fixes.`, '');
  lines.push('');
  lines.push('| # | Test Name | Browser | Retries | Final Status |');
  lines.push('|---|-----------|---------|---------|--------------|');
  retriedTests.forEach((t, i) => {
    lines.push(
      `| ${i + 1} | ${escapeTable(t.title)} | ${t.browser} | ${t.retries} | ${statusIcon(t.status, t.retries)} |`
    );
  });
  lines.push('');
  lines.push('> **Note:** Auto-healing (selector repair) is performed by `@playwright-test-healer` / `@cypress-test-healer`.');
  lines.push('> If the same tests continue to retry across runs, invoke the healer agent with the failing test file.');
  lines.push('');

  return lines.join('\n');
}

function buildCoverageSummary(run, storyKey) {
  const allTests  = run.browserGroups.flatMap(g => g.tests);
  const allAcRefs = [...new Set(
    allTests.flatMap(t => extractAcRefs(t.fullTitle).concat(extractAcRefs(t.suiteName)))
  )];

  // Detect story keys referenced
  const storyKeys = [...new Set(
    allTests.flatMap(t => [
      extractStoryKey(t.suiteName),
      extractStoryKey(t.fullTitle),
    ]).filter(Boolean)
  )];

  const passRate   = pct(run.passed, run.total);
  const hasNeg     = allTests.some(t =>
    /negative|invalid|locked|error|fail|wrong/.test((t.title + t.suiteName).toLowerCase())
  );
  const hasEdge    = allTests.some(t =>
    /edge|boundary|empty|special|null|undefined|limit/.test((t.title + t.suiteName).toLowerCase())
  );
  const hasApi     = allTests.some(t =>
    /api|network|intercept|mock|stub/.test((t.title + t.suiteName).toLowerCase())
  );

  const lines = ['## 6. Test Coverage Summary', ''];
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Tests Executed** | ${run.total} |`);
  lines.push(`| **Pass Rate** | ${passRate} |`);
  lines.push(`| **AC Tags Found** | ${allAcRefs.length > 0 ? allAcRefs.sort().join(', ') : '_None — see Section 3_'} |`);
  lines.push(`| **Story Keys Detected** | ${storyKeys.length > 0 ? storyKeys.join(', ') : storyKey} |`);
  lines.push(`| **Negative Test Coverage** | ${hasNeg ? '✅ Present' : '⚠️ Not detected'} |`);
  lines.push(`| **Edge Case Coverage** | ${hasEdge ? '✅ Present' : '⚠️ Not detected'} |`);
  lines.push(`| **Network / API Coverage** | ${hasApi ? '✅ Present' : '⚠️ Not detected'} |`);
  lines.push('');

  return lines.join('\n');
}

function buildGapsAndRecommendations(run) {
  const lines = ['## 7. Gaps & Recommendations', ''];
  const recs   = [];
  const fixMatrix = getFixMatrix(run.framework);
  const allTests = run.browserGroups.flatMap(g => g.tests);

  // Failure-based recommendations
  const failedTests = allTests
    .filter(t => t.status === 'failed')
    .map(t => ({ ...t, category: classifyFailure(t.error) }));

  const catCounts = {};
  for (const t of failedTests) {
    catCounts[t.category] = (catCounts[t.category] || 0) + 1;
  }

  for (const [cat, count] of Object.entries(catCounts)) {
    const info = fixMatrix[cat] || fixMatrix.UNKNOWN;
    recs.push({
      priority: info.autoFixable ? 'High' : 'Medium',
      issue:    `${count} test(s) failing — ${info.label}`,
      action:   info.recommendation,
    });
  }

  // Coverage gaps
  const hasNeg = allTests.some(t =>
    /negative|invalid|locked|error|fail|wrong/.test((t.title + t.suiteName).toLowerCase())
  );
  const hasEdge = allTests.some(t =>
    /edge|boundary|empty|special|null|undefined|limit/.test((t.title + t.suiteName).toLowerCase())
  );
  const hasApi = allTests.some(t =>
    /api|network|intercept|mock|stub/.test((t.title + t.suiteName).toLowerCase())
  );
  const hasAc = allTests.some(t =>
    extractAcRefs(t.fullTitle + t.suiteName).length > 0
  );

  if (!hasNeg) {
    recs.push({
      priority: 'Medium',
      issue:    'No negative test scenarios detected',
      action:   'Add tests for invalid inputs, locked-out users, wrong passwords, and server error states.',
    });
  }
  if (!hasEdge) {
    recs.push({
      priority: 'Low',
      issue:    'No edge / boundary condition tests detected',
      action:   'Add tests for empty cart, max-length input, special characters, and zero-quantity scenarios.',
    });
  }
  if (!hasApi) {
    recs.push({
      priority: 'Low',
      issue:    'No network / API interception tests detected',
      action:   'Consider adding `cy.intercept()` assertions on key API calls (login, add-to-cart, checkout) to validate request/response contracts.',
    });
  }
  if (!hasAc) {
    recs.push({
      priority: 'Low',
      issue:    'No AC-N tags in test titles — AC coverage tracking disabled',
      action:   'Prefix `it()` descriptions with the corresponding AC reference (e.g. `"AC-1: should redirect to inventory"`) to enable automated AC coverage mapping.',
    });
  }

  // Flaky tests
  const flakyTests = allTests.filter(t => t.retries > 0);
  if (flakyTests.length > 0) {
    recs.push({
      priority: 'High',
      issue:    `${flakyTests.length} test(s) required retries — possible flakiness`,
      action:   'Invoke `@cypress-test-healer` / `@playwright-test-healer` with the failing test file to perform selector and timing repairs.',
    });
  }

  if (recs.length === 0) {
    lines.push('> No gaps detected. All categories covered, no failures, no flakiness. Great shape! 🎉', '');
    return lines.join('\n');
  }

  lines.push('| Priority | Gap / Issue | Recommended Action |');
  lines.push('|----------|-------------|-------------------|');
  for (const r of recs) {
    const priorityIcon = r.priority === 'High' ? '🔴 High' : r.priority === 'Medium' ? '🟡 Medium' : '🟢 Low';
    lines.push(`| ${priorityIcon} | ${escapeTable(r.issue)} | ${escapeTable(r.action)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildFooter(storyKey, cfg) {
  return [
    '---',
    '',
    `*Report generated by \`scripts/generate-report.js\` · Story: **${storyKey}** · Framework: ${cfg.framework}*`,
    '',
    `*To re-generate: \`node scripts/generate-report.js --framework ${cfg.framework} --results-json <path> --story-key ${storyKey}\`*`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Not-implemented stub scanner (M-6)
// ---------------------------------------------------------------------------
function buildNotImplemented() {
  const notImplDir = path.join('qa-framework', 'notimplemented');
  if (!fs.existsSync(notImplDir)) return '';

  const stubs = [];
  for (const entry of fs.readdirSync(notImplDir)) {
    if (!entry.endsWith('.cy.ts') && !entry.endsWith('.spec.ts')) continue;
    if (entry.startsWith('_TEMPLATE')) continue;
    const src  = fs.readFileSync(path.join(notImplDir, entry), 'utf8');
    const jira     = (src.match(/@jira\s+(\S+)/)   || [])[1] || '—';
    const ac       = (src.match(/@ac\s+(\S+)/)      || [])[1] || '—';
    const acText   = (src.match(/@acText\s+"([^"]+)"/) || [])[1] || '—';
    const category = (src.match(/@category\s+(\S+)/)   || [])[1] || '—';
    stubs.push({ file: entry, jira, ac, acText, category });
  }

  if (stubs.length === 0) return '';

  const lines = [
    '---\n',
    '## 8. Manual Verification Required — 🚫 BLOCKED',
    '',
    '> ⚠️ **STORY STATUS: BLOCKED** — The following acceptance criteria cannot be automated.',
    '> **The story must NOT be marked Done** until all items below are manually verified.',
    '',
    '| Story | AC | Description | Category | Stub File |',
    '|-------|----|-------------|----------|-----------|',
  ];
  for (const s of stubs) {
    lines.push(
      `| ${s.jira} | AC-${s.ac} | ${escapeTable(s.acText)} | \`${s.category}\` | \`${s.file}\` |`
    );
  }
  lines.push('');
  lines.push('> **Action Required:** Complete manual verification steps documented inside each stub file.');
  lines.push('> Once verified, update the stub with `@verified true` and re-generate the report.');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const cfg = parseArgs();

  if (!cfg.resultsJson) {
    console.error('[generate-report] ERROR: --results-json is required.');
    process.exit(1);
  }

  // Load results JSON
  let raw;
  if (!fs.existsSync(cfg.resultsJson)) {
    console.warn(`[generate-report] WARN: Results file not found at "${cfg.resultsJson}" — generating empty report.`);
    raw = null;
  } else {
    try {
      raw = JSON.parse(fs.readFileSync(cfg.resultsJson, 'utf8'));
    } catch (e) {
      console.error(`[generate-report] ERROR: Could not parse "${cfg.resultsJson}": ${e.message}`);
      raw = null;
    }
  }

  // Parse into normalised run object
  let run;
  if (!raw) {
    run = {
      framework: cfg.framework, total: 0, passed: 0, failed: 0, skipped: 0,
      durationMs: 0, startedAt: null,
      browserGroups: [{ browser: cfg.framework === 'playwright' ? 'chromium' : 'Electron (Cypress)', tests: [] }],
    };
  } else if (cfg.framework === 'playwright') {
    run = parsePlaywright(raw);
  } else {
    run = parseCypress(raw);
  }

  const storyKey = inferStoryKey(run, cfg.branch, cfg.storyKey);

  // Build report
  const sections = [
    buildHeader(run, storyKey, cfg),
    '---\n',
    buildExecutiveSummary(run),
    '---\n',
    buildExecutionResults(run),
    '---\n',
    buildAcCoverage(run, storyKey),
    '---\n',
    buildFailureAnalysis(run),
    '---\n',
    buildHealingActivities(run),
    '---\n',
    buildCoverageSummary(run, storyKey),
    '---\n',
    buildGapsAndRecommendations(run),
    buildNotImplemented(),
    buildFooter(storyKey, cfg),
  ];

  const report = sections.join('\n');

  // Write output
  fs.mkdirSync(cfg.outputDir, { recursive: true });
  const outFile = path.join(cfg.outputDir, `${storyKey}-test-report.md`);
  fs.writeFileSync(outFile, report, 'utf8');

  console.log(`[generate-report] Report written to: ${outFile}`);
  console.log(`[generate-report] Summary: ${run.total} total | ${run.passed} passed | ${run.failed} failed | ${run.skipped} skipped | ${fmtDuration(run.durationMs)}`);

  // ── Self-validation: enforce all 7 required sections ────────────────────
  // Self-validation: enforce all 7 required sections are present in the report
  function validateReportContent(content) {
    const sections = [
      'Executive Summary',
      'Test Execution Results',
      'AC Coverage',           // matches '## 3. AC Coverage'
      'Failure Analysis',
      'Healing Activities',
      'Coverage Summary',      // matches '## 6. Test Coverage Summary'
      'Gaps & Recommendations',
    ];
    return sections.every(s => content.includes(s));
  }

  if (!validateReportContent(report)) {
    const missing = [
      'Executive Summary', 'Test Execution Results', 'AC Coverage',
      'Failure Analysis', 'Healing Activities', 'Coverage Summary', 'Gaps & Recommendations',
    ].filter(s => !report.includes(s));
    console.error('[generate-report] ERROR: Report validation failed — missing required section(s):');
    missing.forEach(s => console.error(`  - ${s}`));
    process.exit(1);
  }
  console.log('[generate-report] Report validation: OK — all 7 required sections present.');
}

main();
