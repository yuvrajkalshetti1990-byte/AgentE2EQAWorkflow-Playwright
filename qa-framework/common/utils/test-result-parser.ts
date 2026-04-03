/**
 * Framework-agnostic test result parser.
 *
 * Supported formats:
 *  - Playwright JSON reporter  (`results.json` produced by `@playwright/test`)
 *  - Cypress Mochawesome JSON (`mochawesome.json` produced by `cypress-mochawesome-reporter`)
 *
 * Both formats are normalised into the shared `TestRunSummary` type from `common/types`.
 */

import * as fs from 'fs';
import type { TestRunSummary, TestSuiteResult, TestCaseResult, TestStatus, TestFramework } from '../types/index.js';
import { createLogger } from './logger.js';

const log = createLogger('test-result-parser');

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
