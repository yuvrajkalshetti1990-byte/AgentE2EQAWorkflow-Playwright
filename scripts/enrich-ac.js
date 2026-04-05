#!/usr/bin/env node
/**
 * enrich-ac.js — Test Intelligence Layer CLI
 *
 * Self-contained CJS script (no TypeScript compilation needed).
 *
 * Usage:
 *   node scripts/enrich-ac.js \
 *     --story-key  SCRUM-42 \
 *     --acs        "AC text 1" "AC text 2" \
 *     --framework  cypress|playwright
 *
 * Or pipe ACs from JSON:
 *   node scripts/enrich-ac.js \
 *     --story-key  SCRUM-42 \
 *     --acs-file   /tmp/acs.json \
 *     --framework  cypress
 *
 * Output:
 *   qa-framework/intelligence/{story-key}-enhanced-ac.json
 *
 * Exit codes:
 *   0 — success (proceed or proceed-with-warnings)
 *   2 — pipeline blocked (one or more ACs have REWRITE verdict)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}

function getAllArgs(flag) {
  const results = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      // Collect all subsequent values that don't start with --
      let j = i + 1;
      while (j < args.length && !args[j].startsWith('--')) {
        results.push(args[j]);
        j++;
      }
    }
  }
  return results;
}

const storyKey  = getArg('--story-key');
const framework = getArg('--framework')  || 'playwright';
const acsFile   = getArg('--acs-file');
let   rawAcs    = getAllArgs('--acs');

if (!storyKey) {
  console.error('[enrich-ac] ERROR: --story-key is required');
  process.exit(1);
}

if (acsFile) {
  try {
    const content = JSON.parse(fs.readFileSync(acsFile, 'utf8'));
    rawAcs = Array.isArray(content) ? content : (content.acs ?? []);
  } catch (e) {
    console.error('[enrich-ac] ERROR: Could not parse --acs-file: ' + e.message);
    process.exit(1);
  }
}

if (rawAcs.length === 0) {
  console.warn('[enrich-ac] WARN: No ACs provided — producing empty document');
}

// ---------------------------------------------------------------------------
// Score thresholds
// ---------------------------------------------------------------------------

function verdictFromScore(score) {
  if (score >= 4.0) return 'AUTOMATE';
  if (score >= 3.0) return 'IMPROVE';
  return 'REWRITE';
}

const ANTI_PATTERNS = [
  { name: 'vague-assertion',        regex: /\b(should work|works correctly|looks good|should be fast|display correctly|function properly)\b/i, penalty: 1.5 },
  { name: 'result-without-action',  regex: /^the user is (logged in|authenticated|signed in)/i,                                                  penalty: 1.0 },
  { name: 'non-ui-verification',    regex: /\b(database (should|must)|api (should|must) return|server (should|must)|email (should|must) (be sent|arrive))\b/i, penalty: 1.0 },
  { name: 'ambiguous-actor',        regex: /^the system should/i,                                                                               penalty: 0.5 },
  { name: 'missing-data-context',   regex: /\benter valid (details|credentials|information|data)\b/i,                                           penalty: 1.0 },
  { name: 'compound-ac',            regex: /\b(and then|and also|as well as)\b.*\b(and then|and also|and|see|view|go to)\b/i,                   penalty: 0.5 },
];

function scoreDimensions(text) {
  const t = text.toLowerCase();
  const specific = Math.min(5, 2 + [
    /"\w[^"]{2,}"/.test(text),
    /https?:\/\//.test(t),
    /\b\d+(\.\d+)?\s*(px|ms|s|%|items?|chars?)\b/i.test(t),
    /\b(error message|success message|toast|alert)\b/i.test(t),
  ].filter(Boolean).length);

  const verifiable = Math.min(5, 1 + [
    /\b(redirected? to|navigates? to|url (should|must|is))\b/i.test(t),
    /\b(displays?|shows?|contains?|visible|hidden|enabled|disabled)\b/i.test(t),
    /\b(then|assert|expect|verify)\b/i.test(t),
    /\b(error|success|fail(ure)?|warning)\b/i.test(t),
  ].filter(Boolean).length);

  const andCount = (text.match(/\band\b/gi) || []).length;
  const scoped   = Math.max(1, 5 - andCount);

  const dataDependent = [
    /\b(real|live|production|customer|existing)\b/i.test(t),
    /\b(specific|particular) (user|account|record)\b/i.test(t),
  ].filter(Boolean).length;
  const dataIndependent = Math.max(1, 5 - dataDependent * 2);

  const nonUiIndicators = [
    /\b(database|api|server|email|sms|webhook|queue)\b/i.test(t),
    /\b(backend|internal (state|log|audit))\b/i.test(t),
  ].filter(Boolean).length;
  const uiReachable = Math.max(1, 5 - nonUiIndicators * 2);

  return { specific, verifiable, scoped, dataIndependent, uiReachable };
}

function scoreAc(acText) {
  const dims    = scoreDimensions(acText);
  const dimAvg  = Object.values(dims).reduce((a, b) => a + b, 0) / 5;
  let   penalty = 0;
  const issues  = [];

  for (const p of ANTI_PATTERNS) {
    if (p.regex.test(acText)) {
      issues.push(p.name);
      penalty += p.penalty;
    }
  }

  const score   = Math.max(1, Math.min(5, parseFloat((dimAvg - penalty * 0.3).toFixed(1))));
  const verdict = verdictFromScore(score);
  return { score, verdict, issues };
}

// ---------------------------------------------------------------------------
// Non-UI patterns
// ---------------------------------------------------------------------------

const NON_UI_PATTERNS = [
  { regex: /\b(database|db)\b.*(should|must|is updated|contains|has record)/i,    reason: 'Requires direct database access — cannot verify via browser.' },
  { regex: /\b(api|endpoint)\b.*(should|must) return/i,                            reason: 'Backend API contract — use a dedicated API test, not a browser test.' },
  { regex: /\b(email|sms|push notification)\b.*(should|must) (be sent|arrive)/i,  reason: 'Requires access to email/SMS inbox — not verifiable in a browser.' },
  { regex: /\b(server|backend|internal log|audit trail)\b/i,                      reason: 'Server-side or infrastructure verification — not UI automatable.' },
  { regex: /\b(performance|load time|response time)\b.*\b(under|within|less than)\s*\d/i, reason: 'Performance metric — use dedicated perf tooling.' },
];

function detectNonAutomatable(ac) {
  for (const { regex, reason } of NON_UI_PATTERNS) {
    if (regex.test(ac)) return reason;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assertion hints
// ---------------------------------------------------------------------------

const URL_PATTERNS = [
  { regex: /(?:redirected?\s+to|navigates?\s+to|url\s+(?:should\s+)?(?:contain|include|be))\s+[`"']?([/\w-]+)[`"']?/i, extract: m => m[1] },
  { regex: /\bto\s+the\s+(\w[\w\s-]*)\s+page\b/i, extract: m => '/' + m[1].toLowerCase().replace(/\s+/g, '-') },
];

function buildAssertionHints(ac) {
  const hints = [];
  const lower = ac.toLowerCase();

  for (const { regex, extract } of URL_PATTERNS) {
    const m = ac.match(regex);
    if (m) {
      const frag = extract(m);
      hints.push({
        kind:        'url-check',
        description: `URL should contain "${frag}"`,
        snippet:     `// Cypress\ncy.url().should('include', '${frag}');\n// Playwright\nawait expect(page).toHaveURL(/${frag.replace(/\//g, '\\/')}/);`,
      });
      break;
    }
  }

  const visMatch = ac.match(/\b(shows?|displays?|sees?|visible|appear)\b.*[`"']([^`"']+)[`"']/i)
                || ac.match(/\ban?\s+([`"'][^`"']+[`"'])\s*(?:error\s+)?(?:message|toast|alert|banner)\b/i);
  if (visMatch) {
    const text = visMatch[2] || visMatch[1];
    hints.push({
      kind:        'text-visible',
      description: `Element containing "${text}" should be visible`,
      snippet:     `// Cypress\ncy.contains('${text}').should('be.visible');\n// Playwright\nawait expect(page.getByText('${text}')).toBeVisible();`,
    });
  }

  const stateMatch = ac.match(/\b(button|link|field|input)\s+(?:should\s+(?:be\s+)?|becomes?\s+|is\s+)(enabled|disabled|hidden|visible)/i);
  if (stateMatch) {
    hints.push({
      kind:        stateMatch[2] === 'enabled' ? 'element-enabled' : stateMatch[2] === 'disabled' ? 'element-disabled' : 'state-change',
      description: `The ${stateMatch[1]} should be ${stateMatch[2]}`,
      snippet:     `// Cypress\ncy.get('[data-test="${stateMatch[1].toLowerCase()}"]').should('be.${stateMatch[2]}');`,
    });
  }

  if (/\b(total|subtotal|price|cost|sum)\b/i.test(lower) && /\b(should|equals?|is)\b/i.test(lower)) {
    hints.push({
      kind:        'calculation',
      description: 'Verify calculated monetary value matches expected result',
      snippet:     `// Cypress\ncy.get('[data-test="total-price"]').then($el => {\n  const actual = parseFloat($el.text().replace(/[^0-9.]/g, ''));\n  expect(actual).to.be.closeTo(expectedValue, 0.01);\n});`,
    });
  }

  if (/\b(list|items?|results?|products?)\b.*\b(should\s+(?:have|show|contain|display))\b/i.test(ac)) {
    hints.push({
      kind:        'count-equals',
      description: 'Verify list/grid contains expected number of items',
      snippet:     `// Cypress\ncy.get('.inventory_item').should('have.length.greaterThan', 0);`,
    });
  }

  return hints;
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

const EDGE_TEMPLATES = [
  {
    kind:      'empty-input',
    condition: ac => /\b(enter|type|fill|input|provide|submit)\b/i.test(ac),
    build:     ()  => ({ kind: 'empty-input', description: 'Submit with all required fields empty', testInput: '(all blank)', expectedOutcome: 'Validation error shown; form not submitted' }),
  },
  {
    kind:      'invalid-input',
    condition: ac => /\b(username|email|password|login|credential)\b/i.test(ac),
    build:     ()  => ({ kind: 'invalid-input', description: 'Enter credentials that do not match any record', testInput: 'invalid_user / wrong_password', expectedOutcome: 'Error message displayed; remain on current page' }),
  },
  {
    kind:      'boundary-value',
    condition: ac => /\b(quantity|amount|count|items?|qty)\b/i.test(ac),
    build:     ()  => ({ kind: 'boundary-value', description: 'Set quantity to min (0/1) and max allowed', testInput: 'qty=0, qty=1, qty=99', expectedOutcome: 'Boundary values handled; error shown outside valid range' }),
  },
  {
    kind:      'max-length',
    condition: ac => /\b(name|address|city|zip|postal)\b/i.test(ac),
    build:     ()  => ({ kind: 'max-length', description: 'Enter string exceeding max allowed length', testInput: 'A'.repeat(256), expectedOutcome: 'Input truncated or validation error shown' }),
  },
  {
    kind:      'special-characters',
    condition: ac => /\b(search|filter|input|enter|type)\b/i.test(ac),
    build:     ()  => ({ kind: 'special-characters', description: 'Enter XSS/SQLi payloads and special chars', testInput: "<script>alert(1)</script>, ' OR 1=1 --", expectedOutcome: 'Characters safely escaped; no script execution; no crash' }),
  },
  {
    kind:      'zero-quantity',
    condition: ac => /\b(add to cart|cart|basket|quantity|remove)\b/i.test(ac),
    build:     ()  => ({ kind: 'zero-quantity', description: 'Attempt checkout with empty cart or zero-qty item', testInput: 'qty=0 or empty cart', expectedOutcome: 'Cannot add zero-qty; checkout blocked for empty cart' }),
  },
];

function buildEdgeCases(ac) {
  return EDGE_TEMPLATES.filter(t => t.condition(ac)).map(t => t.build());
}

// ---------------------------------------------------------------------------
// Expected outcomes
// ---------------------------------------------------------------------------

function buildExpectedOutcomes(ac) {
  const outcomes = [];
  const lower = ac.toLowerCase();
  if (/redirect|navigat|url\s+changes?/i.test(lower)) outcomes.push('Browser URL changes to the expected path');
  if (/error\s+message|validation\s+error|invalid/i.test(lower)) outcomes.push('An error or validation message is displayed');
  if (/success|confirm|complete|placed|logged.?in/i.test(lower)) outcomes.push('A success or confirmation state is presented');
  if (/cart|basket|badge|counter/i.test(lower)) outcomes.push('Cart badge/counter reflects the updated item count');
  if (/total|subtotal|price|cost/i.test(lower)) outcomes.push('Price/total is recalculated and displayed correctly');
  if (outcomes.length === 0) outcomes.push('Action completes without errors and the UI reflects the result');
  return outcomes;
}

function buildValidationConditions(ac) {
  const conds = [];
  if (/\b(required|mandatory|must not be empty)\b/i.test(ac)) conds.push('All required fields must be filled');
  if (/\b(valid|correct)\s+(email|format)\b/i.test(ac)) conds.push('Input must match the expected format');
  if (/\b(password)\b/i.test(ac)) conds.push('Password must not be visible in plain text');
  if (/\b(logged\s*in|authenticated|session)\b/i.test(ac)) conds.push('User must be authenticated before this action');
  if (/\b(checkout|order|payment)\b/i.test(ac)) conds.push('Cart must contain at least one item');
  if (conds.length === 0) conds.push('Prerequisites in the preconditions section must be met');
  return conds;
}

function buildEnhancedText(ac, verdict, suggestions) {
  if (verdict === 'AUTOMATE') return undefined;

  const hasGWT = /\bgiven\b/i.test(ac) && /\bwhen\b/i.test(ac) && /\bthen\b/i.test(ac);
  if (hasGWT) {
    return ac + (suggestions.length ? `\n[Enhancement: ${suggestions.slice(0, 2).join('; ')}]` : '');
  }

  const lower = ac.toLowerCase();
  const given = 'Given the user is on the relevant page with valid preconditions';
  const when  = `When the user performs: "${ac.substring(0, 80)}"`;
  const then  = /redirect|navigat/i.test(lower) ? 'Then the user is redirected to the expected page' :
                /error/i.test(lower)             ? 'Then an appropriate error message is displayed'   :
                /success|confirm/i.test(lower)   ? 'Then a success confirmation is shown'             :
                                                    'Then the expected UI state change occurs';
  const note  = suggestions.length ? `[Enrichment: ${suggestions.slice(0, 2).join('; ')}]` : '';
  return [given, when, then, note].filter(Boolean).join('\n');
}

function suggestTitle(ac, n) {
  const clean = ac.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().substring(0, 60);
  return `AC-${n}: ${clean}`;
}

// ---------------------------------------------------------------------------
// Enrich
// ---------------------------------------------------------------------------

function enrichAcs(storyKey, rawAcs, framework) {
  const enriched = rawAcs.map((ac, i) => {
    const n       = i + 1;
    const scored  = scoreAc(ac);
    const nonUi   = detectNonAutomatable(ac);
    const automat = nonUi === null && scored.verdict !== 'REWRITE';

    const entry = {
      acNumber:             n,
      originalText:         ac,
      verdict:              scored.verdict,
      score:                scored.score,
      automatable:          automat,
      nonAutomatableReason: nonUi || undefined,
      enhancedText:         buildEnhancedText(ac, scored.verdict, []),
      expectedOutcomes:     buildExpectedOutcomes(ac),
      validationConditions: buildValidationConditions(ac),
      assertionHints:       automat ? buildAssertionHints(ac) : [],
      edgeCases:            automat ? buildEdgeCases(ac)      : [],
      suggestedTestTitle:   suggestTitle(ac, n),
      notImplementedPath:   !automat
        ? `qa-framework/notimplemented/${storyKey.toLowerCase()}-ac-${n}.notimplemented.${framework === 'playwright' ? 'spec' : 'cy'}.ts`
        : undefined,
    };

    return entry;
  });

  const anyRewrite  = enriched.some(e => e.verdict === 'REWRITE');
  const anyNonUi    = enriched.some(e => !e.automatable);
  const allAutomate = enriched.every(e => e.verdict === 'AUTOMATE' && e.automatable);

  return {
    storyKey,
    enrichedAt:        new Date().toISOString(),
    framework,
    overallCanAutomate: !anyRewrite,
    pipelineAction:    anyRewrite ? 'block' : (!allAutomate || anyNonUi) ? 'proceed-with-warnings' : 'proceed',
    originalAcs:       rawAcs,
    enriched,
  };
}

// ---------------------------------------------------------------------------
// Save and log
// ---------------------------------------------------------------------------

const INTELLIGENCE_DIR = path.resolve(process.cwd(), 'qa-framework', 'intelligence');

function run() {
  console.log(`[enrich-ac] Story: ${storyKey} | Framework: ${framework} | ACs: ${rawAcs.length}`);

  const doc      = enrichAcs(storyKey, rawAcs, framework);
  fs.mkdirSync(INTELLIGENCE_DIR, { recursive: true });
  const outPath  = path.join(INTELLIGENCE_DIR, `${storyKey}-enhanced-ac.json`);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');

  // Log transformation summary
  console.log(`[enrich-ac] Pipeline action: ${doc.pipelineAction.toUpperCase()}`);
  console.log(`[enrich-ac] Automatable: ${doc.enriched.filter(e => e.automatable).length}/${doc.enriched.length}`);
  for (const e of doc.enriched) {
    const status = e.automatable ? '✅' : '🚫';
    const hints  = e.assertionHints.length;
    const edges  = e.edgeCases.length;
    console.log(`  ${status} AC-${e.acNumber} [${e.verdict} / score ${e.score}] hints=${hints} edges=${edges}${e.nonAutomatableReason ? ' → NOT AUTOMATABLE: ' + e.nonAutomatableReason : ''}`);
  }

  const nonAuto = doc.enriched.filter(e => !e.automatable);
  if (nonAuto.length > 0) {
    console.log(`\n[enrich-ac] ⚠️  ${nonAuto.length} AC(s) cannot be automated:`);
    for (const e of nonAuto) {
      console.log(`  AC-${e.acNumber}: ${e.nonAutomatableReason}`);
      console.log(`  → Stub path: ${e.notImplementedPath}`);
    }
  }

  const rewrites = doc.enriched.filter(e => e.verdict === 'REWRITE');
  if (rewrites.length > 0) {
    console.log(`\n[enrich-ac] 🚫 PIPELINE BLOCKED — ${rewrites.length} AC(s) require rewrite:`);
    for (const e of rewrites) {
      console.log(`  AC-${e.acNumber}: ${e.originalText.substring(0, 100)}`);
    }
    console.log(`[enrich-ac] Fix the ACs above before re-running the pipeline.`);
    console.log(`[enrich-ac] Report written to: ${outPath}`);
    process.exit(2);
  }

  console.log(`[enrich-ac] Report written to: ${outPath}`);
  process.exit(0);
}

run();
