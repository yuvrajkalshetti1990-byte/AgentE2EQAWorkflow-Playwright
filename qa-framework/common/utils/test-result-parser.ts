/**
 * Framework-agnostic test result parser.
 *
 * Supported formats:
 *  - Playwright JSON reporter  (`results.json` produced by `@playwright/test`)
 *  - Cypress Mochawesome JSON (`mochawesome.json` produced by `cypress-mochawesome-reporter`)
 *
 * Both formats are normalised into the shared `TestRunSummary` type from `common/types`.
 * Each failed test case is additionally classified into a `FailureCategory` so the
 * healer and pipeline can decide whether to auto-fix or move to notimplemented.
 */

import * as fs from 'fs';
import type { TestRunSummary, TestSuiteResult, TestCaseResult, TestStatus, TestFramework } from '../types/index.js';
import { createLogger } from './logger.js';

const log = createLogger('test-result-parser');

// ---------------------------------------------------------------------------
// Failure Classification
// ---------------------------------------------------------------------------

export type FailureCategory =
  | 'ENV_MISSING'         // cy.type(undefined), missing Cypress.env() key
  | 'DATA_MISSING'        // fixture file not found, cy.fixture() failed
  | 'SELECTOR_ISSUE'      // cy.get() timeout, element not found in DOM
  | 'NETWORK_FAILURE'     // cy.visit() non-2xx, cy.request() failed, timeout on external URL
  | 'ASSERTION_FAILURE'   // .should() assertion failed (value mismatch, not selector)
  | 'IFRAME_ISSUE'        // cy.clear()/cy.type() inside iframe failed
  | 'API_KEY_MISSING'     // "x-api-key header is required" error
  | 'FRAMEWORK_LIMITATION'// cannot be automated as a browser test
  | 'UNKNOWN';            // unclassified

/** Classify a failure message string into a FailureCategory. */
export function classifyFailure(errorMessage: string | undefined): FailureCategory {
  if (!errorMessage) return 'UNKNOWN';
  const m = errorMessage.toLowerCase();

  if (m.includes('x-api-key') || m.includes('api key') || m.includes('api-key')) {
    return 'API_KEY_MISSING';
  }
  if (
    m.includes('cy.type()') && (m.includes('undefined') || m.includes('null')) ||
    m.includes('only accept a string or number')
  ) {
    return 'ENV_MISSING';
  }
  if (
    m.includes('fixture file could not be found') ||
    m.includes('cy.fixture()') ||
    m.includes('no such file') ||
    m.includes('enoent')
  ) {
    return 'DATA_MISSING';
  }
  if (
    m.includes('cy.selectfile') && m.includes('failed') ||
    m.includes('cannot read') && m.includes('fixture')
  ) {
    return 'DATA_MISSING';
  }
  if (
    m.includes('timed out retrying') ||
    m.includes('cy.get()') ||
    m.includes('cy.contains()') ||
    m.includes('element not found') ||
    m.includes('not exist in the dom')
  ) {
    return 'SELECTOR_ISSUE';
  }
  if (
    m.includes('cy.visit()') ||
    m.includes('failed trying to load') ||
    m.includes('status code was not `2xx`') ||
    m.includes('network error') ||
    m.includes('net::err_') ||
    m.includes('failed to fetch') ||
    m.includes('cy.request()') && (m.includes('failed') || m.includes('timeout'))
  ) {
    return 'NETWORK_FAILURE';
  }
  if (
    m.includes('cy.clear()') && m.includes('iframe') ||
    m.includes('cy.type()') && m.includes('iframe') ||
    m.includes('requires a valid clearable element') ||
    m.includes('frameloaded') ||
    m.includes('iframe')
  ) {
    return 'IFRAME_ISSUE';
  }
  if (
    m.includes('expected') && (m.includes('to have class') || m.includes('to equal') || m.includes('to include')) ||
    m.includes('assertionerror')
  ) {
    return 'ASSERTION_FAILURE';
  }
  return 'UNKNOWN';
}

/** Auto-fix recommendation produced alongside the classification. */
export interface FailureAnalysis {
  category:    FailureCategory;
  autoFixable: boolean;
  /** Human-readable fix recommendation for the healer agent. */
  recommendation: string;
  /** If true, the test should be moved to /notimplemented instead of fixed. */
  moveToNotImplemented: boolean;
}

const FIX_MATRIX: Record<FailureCategory, Omit<FailureAnalysis, 'category'>> = {
  API_KEY_MISSING: {
    autoFixable: true,
    recommendation: 'Replace cy.request() with cy.apiRequest() custom command — it injects x-api-key from Cypress.env("REQRES_API_KEY") automatically.',
    moveToNotImplemented: false,
  },
  ENV_MISSING: {
    autoFixable: true,
    recommendation: 'Replace raw Cypress.env("key") with a guarded pattern: `const val = Cypress.env("key") ?? "default"; cy.type(val);`. Ensure cypress.env.json has the key.',
    moveToNotImplemented: false,
  },
  DATA_MISSING: {
    autoFixable: true,
    recommendation: 'Create the missing fixture file in qa-framework/frameworks/cypress/fixtures/. cypress.config.ts auto-creates users.json, test.txt, and checkout-user.json on cold start.',,
    moveToNotImplemented: false,
  },
  SELECTOR_ISSUE: {
    autoFixable: true,
    recommendation: 'Use browser_snapshot to identify current selector. Prefer [data-cy], [data-testid], ARIA roles. Increase defaultCommandTimeout if element is present but slow.',
    moveToNotImplemented: false,
  },
  NETWORK_FAILURE: {
    autoFixable: true,
    recommendation: 'Replace cy.visit(url) with cy.safeVisit(url) — adds failOnStatusCode:false and retry logging. If the site is consistently unreachable, stub with cy.intercept().',
    moveToNotImplemented: false,
  },
  ASSERTION_FAILURE: {
    autoFixable: true,
    recommendation: 'Verify the expected value against the live UI using browser_snapshot. Update the assertion to match current application behaviour.',
    moveToNotImplemented: false,
  },
  IFRAME_ISSUE: {
    autoFixable: true,
    recommendation: 'Replace direct cy.get() inside iframe with cy.withinIframe(selector, $body => { cy.wrap($body).find("...").clear() }). Custom command is available in commands.ts.',
    moveToNotImplemented: false,
  },
  FRAMEWORK_LIMITATION: {
    autoFixable: false,
    recommendation: 'This AC requires non-browser verification (email, database, file system, OS-level). Cannot be automated as a Cypress test.',
    moveToNotImplemented: true,
  },
  UNKNOWN: {
    autoFixable: false,
    recommendation: 'Review the raw error message. If it is a known pattern, re-classify manually. Otherwise escalate.',
    moveToNotImplemented: false,
  },
};

export function analyzeFailure(errorMessage: string | undefined): FailureAnalysis {
  const category = classifyFailure(errorMessage);
  return { category, ...FIX_MATRIX[category] };
}

/**
 * Annotate all failed test cases in a TestRunSummary with their failure analysis.
 * Returns the summary enriched with `failureAnalysis` on each TestCaseResult.
 */
export function annotateWithFailureAnalysis(summary: TestRunSummary): TestRunSummary {
  const enrichedSuites: TestSuiteResult[] = summary.suites.map(suite => ({
    ...suite,
    tests: suite.tests.map(tc => {
      if (tc.status !== 'failed') return tc;
      return { ...tc, failureAnalysis: analyzeFailure(tc.error) } as TestCaseResult & { failureAnalysis: FailureAnalysis };
    }),
  }));

  // Log a classified failure summary
  const failedTests = enrichedSuites.flatMap(s => s.tests).filter(t => t.status === 'failed');
  if (failedTests.length > 0) {
    const byCategory: Partial<Record<FailureCategory, number>> = {};
    for (const t of failedTests) {
      const cat = ((t as TestCaseResult & { failureAnalysis?: FailureAnalysis }).failureAnalysis?.category ?? 'UNKNOWN') as FailureCategory;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
    log.info('Failure classification summary', { total: failedTests.length, byCategory });
  }

  return { ...summary, suites: enrichedSuites };
}

// ---------------------------------------------------------------------------
// Playwright JSON schema (partial — only fields we consume)
// ---------------------------------------------------------------------------
interface PlaywrightResult {
  stats: {
    expected:   number;
    unexpected: number;
    skipped:    number;
    duration:   number;
  };
  suites: PlaywrightSuite[];
}

interface PlaywrightSuite {
  title: string;
  suites?: PlaywrightSuite[];
  specs:   PlaywrightSpec[];
}

interface PlaywrightSpec {
  title: string;
  tests: PlaywrightTest[];
}

interface PlaywrightTest {
  status:  'expected' | 'unexpected' | 'skipped' | 'flaky';
  duration: number;
  results: Array<{ status: string; error?: { message: string } }>;
}

// ---------------------------------------------------------------------------
// Cypress Mochawesome JSON schema (partial)
// ---------------------------------------------------------------------------
interface MochawesomeResult {
  stats: {
    passes:   number;
    failures: number;
    pending:  number;
    duration: number;
  };
  results: MochawesomeSuite[];
}

interface MochawesomeSuite {
  fullTitle: string;
  suites:    MochawesomeSuite[];
  tests:     MochawesomeTest[];
}

interface MochawesomeTest {
  fullTitle: string;
  pass:      boolean;
  fail:      boolean;
  pending:   boolean;
  duration:  number;
  err?:      { message?: string };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Playwright `results.json` file into a `TestRunSummary`.
 */
export function parsePlaywrightResults(
  jsonPath: string,
  meta: Pick<TestRunSummary, 'branch' | 'commitSha' | 'runUrl'>
): TestRunSummary {
  log.info('Parsing Playwright results', { path: jsonPath });

  const raw: PlaywrightResult = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const suites = flattenPlaywrightSuites(raw.suites ?? []);

  const passed  = raw.stats.expected   ?? 0;
  const failed  = raw.stats.unexpected ?? 0;
  const skipped = raw.stats.skipped    ?? 0;

  return {
    framework:   'playwright',
    branch:      meta.branch,
    commitSha:   meta.commitSha,
    runUrl:      meta.runUrl,
    passed,
    failed,
    skipped,
    total:       passed + failed + skipped,
    durationMs:  raw.stats.duration ?? 0,
    conclusion:  failed > 0 ? 'failure' : 'success',
    suites,
  };
}

/**
 * Parse a Cypress Mochawesome `mochawesome.json` file into a `TestRunSummary`.
 */
export function parseCypressResults(
  jsonPath: string,
  meta: Pick<TestRunSummary, 'branch' | 'commitSha' | 'runUrl'>
): TestRunSummary {
  log.info('Parsing Cypress results', { path: jsonPath });

  const raw: MochawesomeResult = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const suites = flattenMochawesomeSuites(raw.results ?? []);

  const passed  = raw.stats.passes   ?? 0;
  const failed  = raw.stats.failures ?? 0;
  const skipped = raw.stats.pending  ?? 0;

  return {
    framework:   'cypress',
    branch:      meta.branch,
    commitSha:   meta.commitSha,
    runUrl:      meta.runUrl,
    passed,
    failed,
    skipped,
    total:       passed + failed + skipped,
    durationMs:  raw.stats.duration ?? 0,
    conclusion:  failed > 0 ? 'failure' : 'success',
    suites,
  };
}

/**
 * Auto-detect the framework from the JSON file path or content and parse accordingly.
 */
export function parseResults(
  jsonPath:  string,
  framework: TestFramework,
  meta:      Pick<TestRunSummary, 'branch' | 'commitSha' | 'runUrl'>
): TestRunSummary {
  if (!fs.existsSync(jsonPath)) {
    log.warn('Result file not found — returning empty summary', { path: jsonPath });
    return {
      framework, ...meta,
      passed: 0, failed: 0, skipped: 0, total: 0, durationMs: 0,
      conclusion: 'cancelled',
      suites: [],
    };
  }
  return framework === 'playwright'
    ? parsePlaywrightResults(jsonPath, meta)
    : parseCypressResults(jsonPath, meta);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function flattenPlaywrightSuites(suites: PlaywrightSuite[]): TestSuiteResult[] {
  return suites.flatMap((suite) => {
    const tests: TestCaseResult[] = (suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((t): TestCaseResult => {
        const lastResult = t.results[t.results.length - 1];
        const status: TestStatus =
          t.status === 'expected'   ? 'passed'  :
          t.status === 'unexpected' ? 'failed'  :
          t.status === 'skipped'    ? 'skipped' : 'skipped';
        return {
          title:      spec.title,
          status,
          durationMs: t.duration ?? 0,
          error:      lastResult?.error?.message,
          retries:    t.results.length - 1,
        };
      })
    );

    const result: TestSuiteResult = {
      suiteName: suite.title,
      tests,
      passed:    tests.filter(t => t.status === 'passed').length,
      failed:    tests.filter(t => t.status === 'failed').length,
      skipped:   tests.filter(t => t.status === 'skipped').length,
      total:     tests.length,
      durationMs: tests.reduce((s, t) => s + t.durationMs, 0),
    };

    const nested = flattenPlaywrightSuites(suite.suites ?? []);
    return [result, ...nested];
  });
}

function flattenMochawesomeSuites(suites: MochawesomeSuite[]): TestSuiteResult[] {
  return suites.flatMap((suite) => {
    const tests: TestCaseResult[] = (suite.tests ?? []).map((t): TestCaseResult => {
      const status: TestStatus =
        t.pass    ? 'passed'  :
        t.fail    ? 'failed'  :
        t.pending ? 'skipped' : 'skipped';
      return {
        title:      t.fullTitle,
        status,
        durationMs: t.duration ?? 0,
        error:      t.err?.message,
      };
    });

    const result: TestSuiteResult = {
      suiteName: suite.fullTitle,
      tests,
      passed:    tests.filter(t => t.status === 'passed').length,
      failed:    tests.filter(t => t.status === 'failed').length,
      skipped:   tests.filter(t => t.status === 'skipped').length,
      total:     tests.length,
      durationMs: tests.reduce((s, t) => s + t.durationMs, 0),
    };

    const nested = flattenMochawesomeSuites(suite.suites ?? []);
    return [result, ...nested];
  });
}
