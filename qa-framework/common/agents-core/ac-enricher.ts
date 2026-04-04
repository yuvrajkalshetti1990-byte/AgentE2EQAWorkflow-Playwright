/**
 * AC Enricher — Test Intelligence Layer
 *
 * Converts raw Jira acceptance criteria into structured, test-ready inputs
 * that the Cypress and Playwright generator agents consume directly.
 *
 * Pipeline:
 *   1. Score each AC via ac-scorer.ts          → AcReview (verdict + dimensions)
 *   2. Enrich each AC                          → EnrichedAc (hints, edge cases, steps)
 *   3. Decide pipeline action                  → proceed | proceed-with-warnings | block
 *   4. Persist to qa-framework/intelligence/   → {story-key}-enhanced-ac.json
 *
 * Rules:
 *   - NEVER modify originalText — traceability is preserved always
 *   - REWRITE verdict blocks the pipeline (pipelineAction = 'block')
 *   - Non-UI ACs are marked automatable=false and routed to notimplemented/
 */

import * as fs   from 'fs';
import * as path from 'path';
import { scoreAc, reviewStory }    from './ac-scorer.js';
import { createLogger }            from '../utils/logger.js';
import type {
  AcVerdict,
  TestFramework,
  EnrichedAc,
  EnhancedAcDocument,
  AssertionHint,
  AssertionHintKind,
  EdgeCase,
  EdgeCaseKind,
} from '../types/index.js';

const log = createLogger('ac-enricher');

const INTELLIGENCE_DIR = path.resolve(process.cwd(), 'qa-framework', 'intelligence');

// ---------------------------------------------------------------------------
// Non-UI detection patterns — these ACs cannot be browser-tested
// ---------------------------------------------------------------------------
const NON_UI_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /\b(database|db)\b.*(should|must|is updated|contains|has record)/i,   reason: 'Requires direct database access — cannot verify via browser.' },
  { regex: /\b(api|endpoint)\b.*(should|must) return/i,                           reason: 'Backend API contract — use a dedicated API test, not a browser test.' },
  { regex: /\b(email|sms|push notification)\b.*(should|must) (be sent|arrive)/i, reason: 'Requires access to email/SMS inbox — not verifiable in a browser.' },
  { regex: /\b(server|backend|internal log|audit trail)\b/i,                     reason: 'Server-side or infrastructure verification — not UI automatable.' },
  { regex: /\b(performance|load time|response time)\b.*\b(under|within|less than)\s*\d/i, reason: 'Performance metric — use a dedicated performance testing tool.' },
];

// ---------------------------------------------------------------------------
// URL-pattern detection for assertion hints
// ---------------------------------------------------------------------------
const URL_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  { regex: /(?:redirected?\s+to|navigates?\s+to|url\s+(?:should\s+)?(?:contain|include|be))\s+[`"']?([/\w-]+)[`"']?/i, extract: m => m[1] },
  { regex: /\bto\s+the\s+(\w[\w\s-]*)\s+page\b/i, extract: m => `/${m[1].toLowerCase().replace(/\s+/g, '-')}` },
];

// ---------------------------------------------------------------------------
// Visibility / text detection for assertion hints
// ---------------------------------------------------------------------------
const VISIBILITY_PATTERNS = [
  /\b(shows?|displays?|sees?|visible|appear)\b.*[`"']([^`"']+)[`"']/i,
  /\ban?\s+([`"'][^`"']+[`"'])\s*(?:error\s+)?(?:message|toast|alert|banner)\b/i,
  /\bsuccessful\s+(message|notification|confirmation)\b/i,
];

const STATE_CHANGE_PATTERNS = [
  /\b(button|link|field|input)\s+(?:should\s+(?:be\s+)?|becomes?\s+|is\s+)(enabled|disabled|hidden|visible|active|inactive)/i,
  /\b(shopping\s+cart|badge|counter|total)\s+(?:should\s+|is\s+|shows?\s+)(updated?|incremented?|decremented?|\d+)/i,
];

const CALCULATION_PATTERNS = [
  /\b(total|subtotal|sum|price|cost|count)\s+(?:should\s+(?:be\s+)?|equals?|is)\s+/i,
  /\b(\d+(?:\.\d+)?)\s*[×x\*]\s*(\d+(?:\.\d+)?)\b/,
  /\bshopping\s+cart\s+(?:total|price|badge)/i,
];

// ---------------------------------------------------------------------------
// Edge-case expansion templates
// ---------------------------------------------------------------------------
interface EdgeTemplate {
  kind: EdgeCaseKind;
  condition: (ac: string) => boolean;
  generate:  (ac: string) => EdgeCase;
}

const EDGE_TEMPLATES: EdgeTemplate[] = [
  {
    kind: 'empty-input',
    condition: ac => /\b(enter|type|fill|input|provide|submit)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'empty-input',
      description:     'Submit the form with all required fields left empty',
      testInput:       '(all fields blank)',
      expectedOutcome: 'Validation error shown for each required field; form not submitted',
    }),
  },
  {
    kind: 'invalid-input',
    condition: ac => /\b(username|email|password|login|credential|field)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'invalid-input',
      description:     'Enter credentials / data that do not match any known valid record',
      testInput:       'invalid_user / wrong_password',
      expectedOutcome: 'Appropriate error message displayed; user remains on current page',
    }),
  },
  {
    kind: 'boundary-value',
    condition: ac => /\b(quantity|amount|count|items?|number|qty)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'boundary-value',
      description:     'Set quantity to its minimum (0 or 1) and maximum allowed value',
      testInput:       'qty=0, qty=1, qty=99',
      expectedOutcome: 'Boundary values handled gracefully; error shown when below min or above max',
    }),
  },
  {
    kind: 'max-length',
    condition: ac => /\b(name|first name|last name|address|city|zip|postal)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'max-length',
      description:     'Enter a string that exceeds the maximum allowed character length',
      testInput:       'A'.repeat(256),
      expectedOutcome: 'Input is truncated to max length OR validation error is shown',
    }),
  },
  {
    kind: 'special-characters',
    condition: ac => /\b(search|filter|input|enter|type)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'special-characters',
      description:     'Enter special characters and SQL/HTML injection strings',
      testInput:       '<script>alert(1)</script>, \' OR 1=1 --, &amp; <b>test</b>',
      expectedOutcome: 'Characters are safely escaped; no script execution; application does not crash',
    }),
  },
  {
    kind: 'zero-quantity',
    condition: ac => /\b(add to cart|cart|basket|quantity|remove)\b/i.test(ac),
    generate:  _ac => ({
      kind:            'zero-quantity',
      description:     'Attempt to add an item with quantity 0 or proceed with an empty cart',
      testInput:       'quantity=0 or empty cart',
      expectedOutcome: 'User cannot add zero-quantity item; checkout blocked for empty cart',
    }),
  },
];

// ---------------------------------------------------------------------------
// Core enrichment
// ---------------------------------------------------------------------------

function detectNonAutomatable(acText: string): { automatable: false; reason: string } | null {
  for (const { regex, reason } of NON_UI_PATTERNS) {
    if (regex.test(acText)) return { automatable: false, reason };
  }
  return null;
}

function buildAssertionHints(acText: string): AssertionHint[] {
  const hints: AssertionHint[] = [];
  const lower = acText.toLowerCase();

  // URL check
  for (const { regex, extract } of URL_PATTERNS) {
    const m = acText.match(regex);
    if (m) {
      const urlFragment = extract(m);
      hints.push({
        kind:        'url-check' as AssertionHintKind,
        description: `URL should contain "${urlFragment}"`,
        snippet:     `// Cypress\ncy.url().should('include', '${urlFragment}');\n// Playwright\nawait expect(page).toHaveURL(/${urlFragment.replace('/', '\\/')}/);`,
      });
      break;
    }
  }

  // Text / element visibility
  for (const pattern of VISIBILITY_PATTERNS) {
    const m = acText.match(pattern);
    if (m) {
      const text = m[2] ?? m[1] ?? 'expected text';
      hints.push({
        kind:        'text-visible' as AssertionHintKind,
        description: `Element containing "${text}" should be visible`,
        snippet:     `// Cypress\ncy.contains('${text}').should('be.visible');\n// Playwright\nawait expect(page.getByText('${text}')).toBeVisible();`,
      });
    }
  }

  // State changes (enabled / disabled / hidden)
  for (const pattern of STATE_CHANGE_PATTERNS) {
    const m = acText.match(pattern);
    if (m) {
      const element = m[1] ?? 'element';
      const state   = (m[2] ?? 'visible').toLowerCase();
      const kind: AssertionHintKind =
        state === 'enabled'  ? 'element-enabled'  :
        state === 'disabled' ? 'element-disabled' : 'state-change';
      hints.push({
        kind,
        description: `The ${element} should be ${state}`,
        snippet:     `// Cypress\ncy.get('[data-test="${element.replace(/\s+/g, '-').toLowerCase()}"]').should('be.${state}');\n// Playwright\nawait expect(page.getByRole('${element}')).toBeEnabled();`,
      });
    }
  }

  // Calculations
  for (const pattern of CALCULATION_PATTERNS) {
    if (pattern.test(lower)) {
      hints.push({
        kind:        'calculation' as AssertionHintKind,
        description: 'Verify calculated value (total/subtotal/count) matches expected result',
        snippet:     `// Cypress\ncy.get('[data-test="total-price"]').then($el => {\n  const actual = parseFloat($el.text().replace(/[^0-9.]/g, ''));\n  expect(actual).to.be.closeTo(expectedValue, 0.01);\n});`,
      });
      break;
    }
  }

  // Element count
  if (/\b(list|items?|results?|products?|rows?)\b.*\b(should\s+(?:have|show|contain|display))\b/i.test(acText)) {
    hints.push({
      kind:        'count-equals' as AssertionHintKind,
      description: 'List/grid should contain the expected number of items',
      snippet:     `// Cypress\ncy.get('.inventory_item').should('have.length.greaterThan', 0);\n// Playwright\nawait expect(page.locator('.inventory_item')).toHaveCount(expectedCount);`,
    });
  }

  return hints;
}

function buildEdgeCases(acText: string): EdgeCase[] {
  return EDGE_TEMPLATES
    .filter(t => t.condition(acText))
    .map(t => t.generate(acText));
}

function buildExpectedOutcomes(acText: string): string[] {
  const outcomes: string[] = [];
  const lower = acText.toLowerCase();

  if (/redirect|navigat|url\s+changes?/i.test(acText)) {
    for (const { regex, extract } of URL_PATTERNS) {
      const m = acText.match(regex);
      if (m) { outcomes.push(`Browser URL changes to include "${extract(m)}"`); break; }
    }
  }
  if (/error\s+message|validation\s+error|invalid/i.test(lower)) {
    outcomes.push('An error or validation message is displayed to the user');
  }
  if (/success|confirm|complete|placed|logged.?in/i.test(lower)) {
    outcomes.push('A success or confirmation state is presented');
  }
  if (/cart|basket|badge|counter/i.test(lower)) {
    outcomes.push('Cart badge / counter reflects the updated item count');
  }
  if (/total|subtotal|price|cost/i.test(lower)) {
    outcomes.push('Price or total is recalculated and displayed correctly');
  }
  if (outcomes.length === 0) {
    outcomes.push('The stated action completes without errors and the UI reflects the result');
  }
  return outcomes;
}

function buildValidationConditions(acText: string): string[] {
  const conditions: string[] = [];

  if (/\b(required|mandatory|must not be empty)\b/i.test(acText)) {
    conditions.push('All required fields must be filled before submission is accepted');
  }
  if (/\b(valid|correct)\s+(email|format|pattern)\b/i.test(acText)) {
    conditions.push('Input must match the expected format (e.g. email regex)');
  }
  if (/\b(password)\b/i.test(acText)) {
    conditions.push('Password field value must not be visible in plain text');
  }
  if (/\b(logged\s*in|authenticated|session)\b/i.test(acText)) {
    conditions.push('User must be authenticated before this action is accessible');
  }
  if (/\b(checkout|order|payment)\b/i.test(acText)) {
    conditions.push('Cart must contain at least one item before checkout is permitted');
  }
  if (conditions.length === 0) {
    conditions.push('Action is only valid when prerequisites in the preconditions section are met');
  }
  return conditions;
}

function buildTestableSteps(acText: string, verdict: AcVerdict): string[] | undefined {
  if (verdict === 'AUTOMATE') return undefined;

  // Break "Given ... When ... Then" if present
  const gwt = acText.match(/given\s+(.+?)\s+when\s+(.+?)\s+then\s+(.+)/i);
  if (gwt) {
    return [
      `GIVEN: ${gwt[1].trim()}`,
      `WHEN: ${gwt[2].trim()}`,
      `THEN: ${gwt[3].trim()}`,
    ];
  }

  // Heuristic: split on action words
  const steps: string[] = [];
  const lower = acText.toLowerCase();
  if (/navigate|visit|open|go to/i.test(lower))  steps.push(`Navigate to the relevant page`);
  if (/enter|type|fill|input/i.test(lower))       steps.push(`Enter the required data into the form fields`);
  if (/click|press|submit|tap/i.test(lower))      steps.push(`Perform the primary action (click/submit)`);
  if (/see|view|display|show|redirect/i.test(lower)) steps.push(`Verify the expected UI outcome`);

  return steps.length >= 2 ? steps : undefined;
}

function buildSuggestedTitle(acText: string, acNumber: number): string {
  const lower = acText.toLowerCase().trim();

  // Prefer "should <verb> ..." form
  const match = lower.match(/(?:ac[-\s]?\d+[:\s]*)?(?:given\s+.+?\s+)?(?:when\s+.+?\s+)?(?:then\s+)?(.{10,80})/i);
  const core  = match ? match[1].trim() : lower.substring(0, 60);

  // Clean up
  const clean = core
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `AC-${acNumber}: ${clean}`;
}

function enrichSingleAc(acText: string, acNumber: number, framework: TestFramework, storyKey: string): EnrichedAc {
  const review = scoreAc(acText);

  // Non-UI detection overrides verdict
  const nonUiCheck = detectNonAutomatable(acText);
  const automatable = nonUiCheck === null && review.verdict !== 'REWRITE';

  const enhancedText = (review.verdict !== 'AUTOMATE' && automatable)
    ? buildEnhancedText(acText, review.suggestions)
    : undefined;

  const result: EnrichedAc = {
    acNumber,
    originalText:        acText,
    verdict:             review.verdict,
    score:               review.score,
    automatable,
    nonAutomatableReason: nonUiCheck?.reason,
    enhancedText,
    expectedOutcomes:    buildExpectedOutcomes(acText),
    validationConditions: buildValidationConditions(acText),
    assertionHints:      automatable ? buildAssertionHints(acText) : [],
    edgeCases:           automatable ? buildEdgeCases(acText)      : [],
    testableSteps:       buildTestableSteps(acText, review.verdict),
    suggestedTestTitle:  buildSuggestedTitle(acText, acNumber),
    notImplementedPath:  !automatable
      ? `qa-framework/notimplemented/${storyKey.toLowerCase()}-ac-${acNumber}.notimplemented.${framework === 'playwright' ? 'spec' : 'cy'}.ts`
      : undefined,
  };

  log.info('AC enriched', {
    acNumber,
    verdict:     result.verdict,
    automatable: result.automatable,
    hints:       result.assertionHints.length,
    edgeCases:   result.edgeCases.length,
  });

  return result;
}

function buildEnhancedText(acText: string, suggestions: string[]): string {
  const lower = acText.toLowerCase();
  const parts: string[] = [];

  // Try to construct a GWT frame
  const hasGiven = /\bgiven\b/i.test(acText);
  const hasWhen  = /\bwhen\b/i.test(acText);
  const hasThen  = /\bthen\b/i.test(acText);

  if (hasGiven && hasWhen && hasThen) {
    // Already structured — return as-is with a clarification note
    parts.push(acText);
    if (suggestions.length > 0) parts.push(`\n[Enhancement notes: ${suggestions.slice(0, 2).join('; ')}]`);
  } else {
    // Build GWT scaffold
    const given = hasGiven ? '' : `Given the user is on the relevant page with valid preconditions`;
    const when  = hasWhen  ? '' : `When the user performs the action described: "${acText.substring(0, 80)}"`;
    const then  = hasThen  ? '' :
      /redirect|navigat/i.test(lower) ? 'Then the user is redirected to the expected page' :
      /error/i.test(lower)            ? 'Then an appropriate error message is displayed'    :
      /success|confirm/i.test(lower)  ? 'Then a success confirmation is shown'              :
                                        'Then the expected UI state change occurs';

    parts.push([given, when, then].filter(Boolean).join('\n'));
    if (suggestions.length > 0) parts.push(`[Enrichment suggestions applied: ${suggestions.slice(0, 2).join('; ')}]`);
  }

  return parts.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich all ACs for a story and return the structured document.
 * Does NOT write to disk — call saveEnhancedAcDocument separately.
 */
export function enrichAcs(
  storyKey:  string,
  rawAcs:    string[],
  framework: TestFramework
): EnhancedAcDocument {
  log.info('Enriching ACs', { storyKey, count: rawAcs.length, framework });

  const storyReport = reviewStory(storyKey, rawAcs);
  const enriched    = rawAcs.map((ac, i) => enrichSingleAc(ac, i + 1, framework, storyKey));

  const anyRewrite = enriched.some(e => e.verdict === 'REWRITE');
  const anyNonUi   = enriched.some(e => !e.automatable);
  const allAutomate = enriched.every(e => e.verdict === 'AUTOMATE' && e.automatable);

  const pipelineAction =
    anyRewrite    ? 'block'                  :
    anyNonUi      ? 'proceed-with-warnings'  :
    !allAutomate  ? 'proceed-with-warnings'  : 'proceed';

  const doc: EnhancedAcDocument = {
    storyKey,
    enrichedAt:        new Date().toISOString(),
    framework,
    overallCanAutomate: storyReport.canAutomate,
    pipelineAction,
    originalAcs:       rawAcs,
    enriched,
  };

  log.info('Enrichment complete', {
    storyKey,
    pipelineAction,
    automatable:      enriched.filter(e => e.automatable).length,
    nonAutomatable:   enriched.filter(e => !e.automatable).length,
    edgeCasesTotal:   enriched.reduce((s, e) => s + e.edgeCases.length, 0),
    hintsTotal:       enriched.reduce((s, e) => s + e.assertionHints.length, 0),
  });

  return doc;
}

/**
 * Persist the enhanced AC document to disk.
 * Path: qa-framework/intelligence/{story-key}-enhanced-ac.json
 */
export function saveEnhancedAcDocument(doc: EnhancedAcDocument): string {
  fs.mkdirSync(INTELLIGENCE_DIR, { recursive: true });
  const filePath = path.join(INTELLIGENCE_DIR, `${doc.storyKey}-enhanced-ac.json`);

  // Log transformation diff
  const before = doc.originalAcs.map((ac, i) => ({ acNumber: i + 1, text: ac }));
  const after  = doc.enriched.map(e => ({
    acNumber:   e.acNumber,
    verdict:    e.verdict,
    automatable: e.automatable,
    hints:      e.assertionHints.length,
    edgeCases:  e.edgeCases.length,
    enhanced:   !!e.enhancedText,
  }));
  log.info('AC transformation diff', { before: before.length, after });

  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
  log.info('Enhanced AC document saved', { path: filePath });
  return filePath;
}

/**
 * Load a previously saved enhanced AC document if it exists.
 * Returns null when no enriched file is found for the story key.
 */
export function loadEnhancedAcDocument(storyKey: string): EnhancedAcDocument | null {
  const filePath = path.join(INTELLIGENCE_DIR, `${storyKey}-enhanced-ac.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as EnhancedAcDocument;
  } catch {
    log.warn('Failed to parse enhanced AC document', { path: filePath });
    return null;
  }
}
