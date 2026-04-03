/**
 * NOT IMPLEMENTED — {ISSUE_KEY} AC-{N}
 *
 * @notimplemented
 * @jira        {ISSUE_KEY}
 * @ac          {N}
 * @acText      "{AC_TEXT}"
 * @category    {FAILURE_CATEGORY}  // one of: ENV_MISSING | DATA_MISSING | SELECTOR_ISSUE | NETWORK_FAILURE | ASSERTION_FAILURE | IFRAME_ISSUE | API_KEY_MISSING | FRAMEWORK_LIMITATION | UNKNOWN
 * @autoFixable {true|false}
 * @required    ["{REQUIRED_VAR_OR_FILE_1}", "{REQUIRED_VAR_OR_FILE_2}"]
 *
 * Reason this AC could not be automated:
 *   {REASON — e.g. "AC requires verifying a database record (non-UI verification)"}
 *
 * Missing pieces:
 *   - {MISSING_1 — e.g. "Stable data-cy attribute on the success toast element"}
 *   - {MISSING_2 — e.g. "Fixture with a valid promo code for discount calculation"}
 *   - {MISSING_3 — add as many as needed}
 *
 * Auto-fix recommendation:
 *   {RECOMMENDATION from FailureAnalysis.recommendation}
 *
 * Action Required:
 *   1. Resolve the missing pieces listed above.
 *   2. Move this file to: Cypress/cypress/e2e/{story-slug}/
 *   3. Remove the `.notimplemented` segment from the filename.
 *   4. Replace it.skip() with a real implementation.
 */

describe('{ISSUE_KEY} — Not Implemented AC-{N}', () => {
  // @ts-expect-error notimplemented metadata for pipeline tooling
  const __meta__ = {
    jira:        '{ISSUE_KEY}',
    ac:          {N},
    category:    '{FAILURE_CATEGORY}' as const,
    autoFixable: {true|false},
    required:    ['{REQUIRED_VAR_OR_FILE}'],
    reason:      '{REASON}',
  };
  void __meta__;

  it.skip('should: {AC_TEXT}', () => {
    // TODO: implement once the missing pieces are resolved.
    // See file header comments for details.
  });
});
