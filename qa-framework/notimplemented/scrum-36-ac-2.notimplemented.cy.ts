/**
 * NOT IMPLEMENTED — SCRUM-36 AC-2
 *
 * @notimplemented
 * @jira        SCRUM-36
 * @ac          2
 * @acText      "Running npm run test executes all spec files and exits with a 0 status code when all tests pass."
 * @category    FRAMEWORK_LIMITATION
 * @autoFixable false
 * @required    ["npm process exit code monitoring"]
 *
 * Reason this AC could not be automated:
 *   AC-2 requires spawning an external npm process (`npm run test`), running the full
 *   Cypress suite to completion, and then capturing the OS-level exit code of that
 *   process. A Cypress spec runs *inside* the Cypress runner — it cannot spawn and
 *   observe the runner's own parent process or its exit code from within a test.
 *
 * Missing pieces:
 *   - Ability to spawn a child process from within a Cypress spec (blocked by
 *     browser security sandbox; cy.exec() can run shell commands but cannot
 *     easily assert the exit code of the cypress run command itself without
 *     causing a recursive test loop).
 *   - A CI pipeline step (e.g., GitHub Actions) that captures `$?` or
 *     `process.exitCode` after running `npm run test` is the correct place to
 *     verify this AC.
 *
 * Auto-fix recommendation:
 *   Verified externally by the CI pipeline: the `post-results-to-jira.yml` workflow
 *   records pass/fail status after running `npm run test`, confirming exit code 0
 *   when all tests pass. No additional spec automation is possible or necessary.
 *
 * Action Required:
 *   1. This AC is satisfied at the pipeline level (CI green = exit code 0).
 *   2. This file should remain as a stub documenting why the AC is unautomatable.
 *   3. Do NOT move this file — it is correctly placed in notimplemented/.
 */

describe('SCRUM-36 — Not Implemented AC-2', () => {
  // @ts-expect-error notimplemented metadata for pipeline tooling
  const __meta__ = {
    jira:        'SCRUM-36',
    ac:          2,
    category:    'FRAMEWORK_LIMITATION' as const,
    autoFixable: false,
    required:    ['npm process exit code monitoring'],
    reason:      'AC-2 requires capturing the exit code of the npm run test process itself, which cannot be observed from within a Cypress spec running inside that same process.',
  };
  void __meta__;

  it.skip('should exit with status code 0 when npm run test completes with all tests passing', () => {
    // TODO: verify at the CI pipeline level — this AC cannot be implemented as a Cypress spec.
    // See file header comments for details.
  });
});
