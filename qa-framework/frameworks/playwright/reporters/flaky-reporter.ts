import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

/**
 * FlakyReporter — Playwright custom reporter
 *
 * Marks any test that passes only after one or more retries as [FLAKY PASS].
 * These tests are not failures but they signal instability that pure pass/fail
 * reporting hides.
 *
 * Output:
 *   [FLAKY PASS] "TC-HP-01: ..." — passed on retry 1
 *   [FLAKY SUMMARY] 1 flaky test(s) detected
 *
 * Add to playwright.config.ts reporter array:
 *   ['./reporters/flaky-reporter.ts']
 */
class FlakyReporter implements Reporter {
  private readonly flakyTests: Array<{ suite: string; title: string; retry: number }> = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' && result.retry > 0) {
      const suite = test.parent?.title ?? '';
      this.flakyTests.push({ suite, title: test.title, retry: result.retry });
      console.log(
        `\n[FLAKY PASS] "%s > %s" — passed on retry %d`,
        suite,
        test.title,
        result.retry
      );
    }
  }

  onEnd(_result: FullResult): void | Promise<void> {
    if (this.flakyTests.length === 0) return;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[FLAKY SUMMARY] ${this.flakyTests.length} flaky test(s) detected:`);
    for (const t of this.flakyTests) {
      console.log(`  • [retry ${t.retry}] ${t.suite} > ${t.title}`);
    }
    console.log(`${'─'.repeat(60)}\n`);
  }
}

export default FlakyReporter;
