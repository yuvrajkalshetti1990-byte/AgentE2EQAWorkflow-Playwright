/**
 * NOT IMPLEMENTED — {ISSUE_KEY} AC-{N}
 *
 * @notimplemented
 * @jira        {ISSUE_KEY}
 * @ac          {N}
 * @acText      "{AC_TEXT}"
 * @category    {FAILURE_CATEGORY}  // ENV_MISSING | DATA_MISSING | SELECTOR_ISSUE | NETWORK_FAILURE | ASSERTION_FAILURE | FRAMEWORK_LIMITATION | UNKNOWN
 * @autoFixable {true|false}
 * @required    ["{REQUIRED_VAR_OR_FILE}"]
 *
 * Reason this AC could not be automated:
 *   {REASON — e.g. "AC requires verifying email inbox (non-UI verification)"}
 *
 * Missing pieces:
 *   - {MISSING_1 — e.g. "Stable data-testid on the error message container"}
 *   - {MISSING_2 — e.g. "Test email inbox access (Mailhog / Mailtrap integration)"}
 *   - {MISSING_3 — add as many as needed}
 *
 * Auto-fix recommendation:
 *   {RECOMMENDATION}
 *
 * Action Required:
 *   1. Resolve the missing pieces listed above.
 *   2. Move this file to: qa-framework/frameworks/playwright/tests/{story-slug}/
 *   3. Remove the `.notimplemented` segment from the filename.
 *   4. Replace test.skip() with a real implementation.
 */

import { test } from '@playwright/test';

// Machine-readable metadata for pipeline tooling
const __meta__ = {
  jira:        '{ISSUE_KEY}',
  ac:          '{N}',
  category:    '{FAILURE_CATEGORY}' as const,
  autoFixable: false,
  required:    ['{REQUIRED_VAR_OR_FILE}'],
  reason:      '{REASON}',
};
void __meta__;

test.skip('{ISSUE_KEY} — {AC_TEXT}', async ({ page: _page }) => {
  // TODO: implement once the missing pieces are resolved.
  // See file header comments for details.
});
