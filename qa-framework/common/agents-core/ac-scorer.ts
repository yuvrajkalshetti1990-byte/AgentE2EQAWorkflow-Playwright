/**
 * AC Scorer — reusable acceptance criteria scoring logic.
 *
 * Used by:
 *  - The `ac-reviewer` VS Code agent (manual invocation via @ac-reviewer)
 *  - The `jira-ready-for-qa.yml` GitHub Actions workflow (via OpenAI)
 *  - Automated scripts in `qa-framework/scripts/`
 *
 * The scorer identifies AC patterns, flags anti-patterns, and produces a
 * structured `AcReviewReport` regardless of the LLM used.
 */

import type { AcVerdict, AcReview, AcDimension, AcReviewReport } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ac-scorer');

// ---------------------------------------------------------------------------
// Score thresholds
// ---------------------------------------------------------------------------

const THRESHOLD: Record<AcVerdict, number> = {
  AUTOMATE: 4.0,
  IMPROVE:  3.0,
  REWRITE:  0.0,
};

export function verdictFromScore(score: number): AcVerdict {
  if (score >= THRESHOLD.AUTOMATE) return 'AUTOMATE';
  if (score >= THRESHOLD.IMPROVE)  return 'IMPROVE';
  return 'REWRITE';
}

// ---------------------------------------------------------------------------
// Anti-pattern definitions
// ---------------------------------------------------------------------------

interface AntiPattern {
  name:    string;
  regex:   RegExp;
  penalty: number;  // deducted from overall score
  message: string;
}

const ANTI_PATTERNS: AntiPattern[] = [
  {
    name:    'vague-assertion',
    regex:   /\b(should work|works correctly|looks good|should be fast|display correctly|function properly)\b/i,
    penalty: 1.5,
    message: 'Vague assertion — specify the exact expected value, message, or state.',
  },
  {
    name:    'result-without-action',
    regex:   /^the user is (logged in|authenticated|signed in)/i,
    penalty: 1.0,
    message: 'Result stated without a trigger/action. Add Given/When steps.',
  },
  {
    name:    'non-ui-verification',
    regex:   /\b(database (should|must)|api (should|must) return|server (should|must)|email (should|must) (be sent|arrive))\b/i,
    penalty: 1.0,
    message: 'Non-UI verification — cannot be asserted through a browser. Mark as MANUAL ONLY or remove.',
  },
  {
    name:    'ambiguous-actor',
    regex:   /^the system should/i,
    penalty: 0.5,
    message: 'Ambiguous actor — who performs this action? (Admin, Standard User, Guest?)',
  },
  {
    name:    'missing-data-context',
    regex:   /\benter valid (details|credentials|information|data)\b/i,
    penalty: 1.0,
    message: 'Missing data context — specify exact field values, formats, or constraints.',
  },
  {
    name:    'compound-ac',
    regex:   /\b(and then|and also|as well as)\b.*\b(and then|and also|and|see|view|go to)\b/i,
    penalty: 0.5,
    message: 'Compound AC — split into separate acceptance criteria, one behaviour per AC.',
  },
];

// ---------------------------------------------------------------------------
// Heuristic dimension scoring
// ---------------------------------------------------------------------------

function scoreDimensions(acText: string): AcDimension {
  const text = acText.toLowerCase();

  // Specific: looks for exact values, URLs, field names, error messages
  const specificIndicators = [
    /"\w[^"]{2,}"/.test(acText),                           // quoted string
    /https?:\/\//.test(text),                              // URL
    /\b\d+(\.\d+)?\s*(px|ms|s|%|items?|chars?)\b/i.test(text), // numeric value with unit
    /\b(error message|success message|toast|alert)\b/i.test(text),
  ];
  const specific = 2 + specificIndicators.filter(Boolean).length;

  // Verifiable: has a clear pass/fail assertion
  const verifiableIndicators = [
    /\b(redirected? to|navigates? to|url (should|must|is))\b/i.test(text),
    /\b(displays?|shows?|contains?|visible|hidden|enabled|disabled)\b/i.test(text),
    /\b(then|assert|expect|verify)\b/i.test(text),
    /\b(error|success|fail(ure)?|warning)\b/i.test(text),
  ];
  const verifiable = 1 + verifiableIndicators.filter(Boolean).length;

  // Scoped: single behaviour (penalty for "and" chains)
  const andCount = (acText.match(/\band\b/gi) ?? []).length;
  const scoped = Math.max(1, 5 - andCount);

  // Data-independent: uses generic test data, not live-data-dependent
  const dataDependent = [
    /\b(real|live|production|customer|existing)\b/i.test(text),
    /\b(specific|particular) (user|account|record)\b/i.test(text),
  ].filter(Boolean).length;
  const dataIndependent = Math.max(1, 5 - dataDependent * 2);

  // UI-reachable: expressible through browser interactions
  const nonUiIndicators = [
    /\b(database|api|server|email|sms|webhook|queue)\b/i.test(text),
    /\b(backend|internal (state|log|audit))\b/i.test(text),
  ].filter(Boolean).length;
  const uiReachable = Math.max(1, 5 - nonUiIndicators * 2);

  // Clamp all to [1, 5]
  return {
    specific:        Math.min(5, Math.max(1, specific)),
    verifiable:      Math.min(5, Math.max(1, verifiable)),
    scoped:          Math.min(5, Math.max(1, scoped)),
    dataIndependent: Math.min(5, Math.max(1, dataIndependent)),
    uiReachable:     Math.min(5, Math.max(1, uiReachable)),
  };
}

// ---------------------------------------------------------------------------
// Public scoring API
// ---------------------------------------------------------------------------

/**
 * Score a single acceptance criterion heuristically (no LLM required).
 * Used for local / offline scoring and as a fallback when OpenAI is unavailable.
 */
export function scoreAc(acText: string): AcReview {
  const dimensions = scoreDimensions(acText);
  const dimAvg = Object.values(dimensions).reduce((a, b) => a + b, 0) / 5;

  const issues: string[]      = [];
  const suggestions: string[] = [];
  let penaltyTotal = 0;

  for (const pattern of ANTI_PATTERNS) {
    if (pattern.regex.test(acText)) {
      issues.push(`[${pattern.name}] ${pattern.message}`);
      penaltyTotal += pattern.penalty;
    }
  }

  const score   = Math.max(1, Math.min(5, parseFloat((dimAvg - penaltyTotal * 0.3).toFixed(1))));
  const verdict = verdictFromScore(score);

  if (verdict !== 'AUTOMATE') {
    suggestions.push('Rewrite using Given/When/Then format for clarity.');
    suggestions.push('Add exact expected values, URLs, or error messages.');
    if (dimensions.scoped < 3) {
      suggestions.push('Split into multiple ACs — one behaviour per AC.');
    }
  }

  return {
    acText,
    score,
    verdict,
    dimensions,
    issues,
    suggestions,
  };
}

/**
 * Score all ACs for a Jira story and produce a complete `AcReviewReport`.
 */
export function reviewStory(issueKey: string, acs: string[]): AcReviewReport {
  log.info('Scoring ACs', { issueKey, count: acs.length });

  if (acs.length === 0) {
    return {
      issueKey,
      overallScore:   0,
      overallVerdict: 'REWRITE',
      summary: 'No acceptance criteria found. Add ACs before moving to Ready for QA.',
      reviews:      [],
      canAutomate:  false,
    };
  }

  const reviews   = acs.map(scoreAc);
  const avgScore  = reviews.reduce((s, r) => s + r.score, 0) / reviews.length;
  const overall   = parseFloat(avgScore.toFixed(1));
  const verdict   = verdictFromScore(overall);

  const summary = [
    `${reviews.length} AC(s) reviewed.`,
    `Overall score: ${overall}/5.`,
    verdict === 'AUTOMATE' ? 'All ACs are ready for test generation.' :
    verdict === 'IMPROVE'  ? 'Some ACs need minor improvements before test generation.' :
    'ACs are too vague — rewrite before proceeding with automation.',
  ].join(' ');

  return {
    issueKey,
    overallScore:   overall,
    overallVerdict: verdict,
    summary,
    reviews,
    canAutomate: verdict !== 'REWRITE',
  };
}

// ---------------------------------------------------------------------------
// Unimplemented stub generator
// ---------------------------------------------------------------------------

/**
 * When a test cannot be generated for an AC (missing selector, live data,
 * non-UI verification, etc.), generate a stub file path and content.
 */
export function generateNotImplementedStub(params: {
  issueKey: string;
  acText:   string;
  reason:   string;
  missing:  string[];
  index:    number;
  framework: 'playwright' | 'cypress';
}): { path: string; content: string } {
  const { issueKey, acText, reason, missing, index, framework } = params;
  const slug = issueKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const ext  = framework === 'playwright' ? 'spec.ts' : 'cy.ts';
  const path = `qa-framework/notimplemented/${slug}-ac-${index + 1}.notimplemented.${ext}`;

  const missingList = missing.map(m => ` *   - ${m}`).join('\n');

  const content = framework === 'playwright'
    ? `/**
 * NOT IMPLEMENTED — ${issueKey} AC-${index + 1}
 *
 * AC Text:
 *   "${acText}"
 *
 * Reason this AC could not be automated:
 *   ${reason}
 *
 * Missing pieces:
${missingList}
 *
 * Action Required:
 *   1. Resolve the missing pieces listed above.
 *   2. Move this file to: qa-framework/frameworks/playwright/tests/${slug}/
 *   3. Remove the .notimplemented extension and implement the test.
 */

import { test } from '@playwright/test';

test.skip('${acText}', async ({ page }) => {
  // TODO: implement once the missing pieces are resolved
  // See comments above for details
});
`
    : `/**
 * NOT IMPLEMENTED — ${issueKey} AC-${index + 1}
 *
 * AC Text:
 *   "${acText}"
 *
 * Reason this AC could not be automated:
 *   ${reason}
 *
 * Missing pieces:
${missingList}
 *
 * Action Required:
 *   1. Resolve the missing pieces listed above.
 *   2. Move this file to: qa-framework/frameworks/cypress/tests/${slug}/
 *   3. Remove the .notimplemented extension and implement the test.
 */

describe('${issueKey} — Not Implemented', () => {
  it.skip('should: ${acText}', () => {
    // TODO: implement once the missing pieces are resolved
    // See comments above for details
  });
});
`;

  return { path, content };
}
