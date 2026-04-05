#!/usr/bin/env node
/**
 * QA Automation Orchestrator
 *
 * Fully automated, event-driven QA pipeline that:
 *   1. Fetches Jira issue (ACs, labels, summary, URL)
 *   2. Detects framework: label "cypress" -> Cypress, else -> Playwright
 *   3. Validates quality gates (pre-flight)
 *   4. Runs LLM-powered Planner  -> produces test plan
 *   5. Runs LLM-powered Generator -> creates test files
 *   6. Runs tests (npx playwright test | npx cypress run)
 *   7. Runs LLM-powered Healer if tests fail (one retry)
 *   8. Generates Markdown report
 *   9. Updates Jira status + comment
 *  10. Creates branch + commits tests + opens PR
 *
 * Environment variables (all required unless marked optional):
 *   ISSUE_KEY               - Jira issue key, e.g. SCRUM-42
 *   ATLASSIAN_TOKEN         - Atlassian API token
 *   ATLASSIAN_EMAIL         - Atlassian account email
 *   ATLASSIAN_CLOUD_ID      - Atlassian Cloud ID
 *   ATLASSIAN_BASE_URL      - (optional) override base URL for Jira REST API
 *   GITHUB_TOKEN            - GitHub token (actions default or PAT)
 *   GITHUB_REPOSITORY       - "owner/repo" (set automatically in Actions)
 *   OPENAI_API_KEY          - OpenAI API key for LLM steps
 *   OPENAI_MODEL            - (optional) default: gpt-4o
 *   FRAMEWORK_OVERRIDE      - (optional) "playwright" | "cypress" — overrides label detection
 *   BASE_BRANCH             - (optional) PR target branch, default: dev
 *   JIRA_IN_QA_TRANSITION   - (optional) Jira transition ID for "In QA", default: 41
 *   JIRA_DONE_TRANSITION    - (optional) Jira transition ID for "Done",  default: 52
 *   HEALER_MAX_RETRIES      - (optional) maximum healer retry attempts, default: 2
 *
 * Usage:
 *   node tools/orchestrator.js
 *
 * Exit codes:
 *   0 — pipeline completed successfully
 *   1 — pipeline failed (check logs)
 */

'use strict';

const https        = require('https');
const fs           = require('fs');
const path         = require('path');
const { execSync, spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const cfg = {
  issueKey:         requireEnv('ISSUE_KEY'),
  atlassianToken:   requireEnv('ATLASSIAN_TOKEN'),
  atlassianEmail:   requireEnv('ATLASSIAN_EMAIL'),
  atlassianCloudId: requireEnv('ATLASSIAN_CLOUD_ID'),
  atlassianBase:    process.env.ATLASSIAN_BASE_URL ||
                    `https://api.atlassian.com/ex/jira/${process.env.ATLASSIAN_CLOUD_ID}`,
  githubToken:      requireEnv('GITHUB_TOKEN'),
  githubRepo:       requireEnv('GITHUB_REPOSITORY'),
  openaiKey:        requireEnv('OPENAI_API_KEY'),
  openaiModel:      process.env.OPENAI_MODEL || 'gpt-4o',
  frameworkOverride:process.env.FRAMEWORK_OVERRIDE || '',
  baseBranch:       process.env.BASE_BRANCH || 'dev',
  jiraInQaId:       process.env.JIRA_IN_QA_TRANSITION || '41',
  jiraDoneId:       process.env.JIRA_DONE_TRANSITION  || '52',
  healerMaxRetries: parseInt(process.env.HEALER_MAX_RETRIES || '2', 10),
};

const [GH_OWNER, GH_REPO] = cfg.githubRepo.split('/');
const BRANCH_NAME = `auto/test-${cfg.issueKey.toLowerCase()}`;
const STATE_DIR   = path.resolve(process.cwd(), 'qa-framework', 'state');
const STATE_FILE  = path.join(STATE_DIR, `${cfg.issueKey.toLowerCase()}.state.json`);
const REPORT_DIR  = path.resolve(process.cwd(), 'qa-framework', 'reports');
const CI_RULES_DIR = path.resolve(process.cwd(), 'config', 'ci-rules');

// ---------------------------------------------------------------------------
// CI Rules — load from centralized config (shared with agent front matter)
// ---------------------------------------------------------------------------

function loadCiRules(framework) {
  const rulesFile = path.join(CI_RULES_DIR, `${framework}-rules.json`);
  try {
    const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
    info('CI-RULES', `Loaded CI rules for ${framework} from ${path.relative(process.cwd(), rulesFile)}`);
    return rules;
  } catch (e) {
    warn('CI-RULES', `Could not load CI rules for ${framework}: ${e.message} — proceeding with empty rules`);
    return {
      framework,
      planner:   { forbiddenInPlan: [] },
      generator: { mandatoryRules: [], forbiddenPatterns: [], requiredPatterns: [] },
    };
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level, step, msg, extra) {
  const ts  = new Date().toISOString();
  const tag = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[${ts}] [${level}] [${step}]${tag} ${msg}`);
  if (level === 'ERROR') {
    // Mirror to stderr for GitHub Actions ::error:: annotation
    process.stderr.write(`::error title=${step}::${msg}\n`);
  }
}
const info  = (step, msg, x) => log('INFO',  step, msg, x);
const warn  = (step, msg, x) => log('WARN',  step, msg, x);
const error = (step, msg, x) => log('ERROR', step, msg, x);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`FATAL: environment variable ${name} is required but not set`);
    process.exit(1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// State management (delegates to existing scripts/state.js format)
// ---------------------------------------------------------------------------

function stateLoad() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    warn('STATE', `Could not parse state file: ${e.message}`);
    return null;
  }
}

function stateSave(patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const current = stateLoad() || {
    issueKey:  cfg.issueKey,
    createdAt: new Date().toISOString(),
  };
  const next = Object.assign({}, current, patch, { updatedAt: new Date().toISOString() });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpsRequest(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlStr);
    const payload = body ? JSON.stringify(body) : undefined;
    const opts    = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: Object.assign(
        { Accept: 'application/json' },
        payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
        headers
      ),
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        let data = raw;
        try { data = JSON.parse(raw); } catch {}
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} ${method} ${urlStr}: ${typeof data === 'object' ? JSON.stringify(data) : data}`));
        } else {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Request timed out after 30s: ${method} ${urlStr}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function jiraAuth() {
  return { Authorization: 'Basic ' + Buffer.from(`${cfg.atlassianEmail}:${cfg.atlassianToken}`).toString('base64') };
}
function githubAuth() {
  return { Authorization: `token ${cfg.githubToken}`, 'User-Agent': 'qa-orchestrator-bot' };
}

async function withRetry(label, fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (e) {
      if (attempt === 2) throw e;
      warn(label, `Attempt ${attempt} failed: ${e.message} — retrying once…`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ---------------------------------------------------------------------------
// Branch existence check — used by dual-pipeline guard and PR creation
// Returns true if branch exists, false on 404. Exits with code 1 on any
// other error (auth / network failure) to prevent silent duplicate runs.
// ---------------------------------------------------------------------------

async function branchExists(branchName) {
  try {
    await httpsRequest('GET',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/ref/heads/${branchName}`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth())
    );
    return true;
  } catch (e) {
    if (!e.message.includes('404')) {
      // Unexpected error (auth / network) — fail loudly rather than risk duplication
      error('SKIP', `Could not verify branch existence for ${branchName}: ${e.message}`);
      process.exit(1);
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Fetch Jira issue
// ---------------------------------------------------------------------------

async function fetchJiraIssue() {
  info('JIRA', `Fetching issue ${cfg.issueKey}`);

  const url = `https://api.atlassian.com/ex/jira/${cfg.atlassianCloudId}/rest/api/3/issue/${cfg.issueKey}?fields=summary,description,labels,status,assignee,priority,issuetype`;

  const { data: issue } = await withRetry('JIRA', () =>
    httpsRequest('GET', url, jiraAuth())
  );

  const summary     = issue.fields?.summary || cfg.issueKey;
  const labels      = (issue.fields?.labels || []).map(l => l.toLowerCase());
  const description = extractAdfText(issue.fields?.description);
  const status      = issue.fields?.status?.name || 'Unknown';

  info('JIRA', `Issue: "${summary}" | Labels: [${labels.join(', ')}] | Status: ${status}`);

  return { summary, labels, description, status, raw: issue };
}

function extractAdfText(adf) {
  if (!adf || typeof adf !== 'object') return typeof adf === 'string' ? adf : '';
  const texts = [];
  function walk(node) {
    if (!node) return;
    if (node.type === 'text' && node.text) texts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(adf);
  return texts.join('\n');
}

// ---------------------------------------------------------------------------
// Step 2 — Framework detection
// ---------------------------------------------------------------------------

function detectFramework(labels) {
  if (cfg.frameworkOverride && cfg.frameworkOverride !== 'auto') {
    info('FRAMEWORK', `Using explicit override: ${cfg.frameworkOverride}`);
    return cfg.frameworkOverride;
  }

  const hasCypress    = labels.includes('cypress');
  const hasPlaywright = labels.includes('playwright');

  // HARD FAIL: both labels present is ambiguous — fail loudly
  if (hasCypress && hasPlaywright) {
    throw new Error(
      'FRAMEWORK_AMBIGUOUS: Jira issue has BOTH "cypress" and "playwright" labels. ' +
      'Remove one label or set FRAMEWORK_OVERRIDE env var to resolve this.'
    );
  }

  const fw = hasCypress ? 'cypress' : 'playwright';
  info('FRAMEWORK', `Detected framework: ${fw} (labels: [${labels.join(', ')}])`);
  return fw;
}

// ---------------------------------------------------------------------------
// Step 3 — Quality gate (pre-flight)
// ---------------------------------------------------------------------------

function runQualityGate() {
  info('GATE', 'Running quality gate pre-flight check');
  const result = spawnSync('node', ['scripts/validate-test-quality.js'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error('Quality gate pre-flight failed — fix violations before proceeding');
  }
  info('GATE', 'Quality gate: OK');
}

// ---------------------------------------------------------------------------
// Step 4 — LLM Planner
// ---------------------------------------------------------------------------

async function runPlanner(framework, issueKey, summary, description) {
  info('PLANNER', `Generating test plan for ${issueKey} using ${framework}`);

  // Load framework-specific CI rules
  const ciRules = loadCiRules(framework);

  // Build framework-specific system prompt (embedded CI rules)
  const sysPrompt = framework === 'cypress'
    ? buildCypressPlannerPrompt(ciRules)
    : buildPlaywrightPlannerPrompt(ciRules);

  // Log what we are sending to the LLM so CI output is fully traceable
  info('PLANNER', `Framework: ${framework} | System prompt: ${framework === 'cypress' ? 'CYPRESS_PLANNER' : 'PLAYWRIGHT_PLANNER'} | CI rules: ${(ciRules.generator?.ciGates || []).join(', ') || 'none'}`);
  info('PLANNER', `Forbidden plan patterns: ${(ciRules.planner?.forbiddenInPlan || []).join(', ') || 'none'}`);

  const userPrompt = `Jira Issue: ${issueKey}
Summary: ${summary}
Description / Acceptance Criteria:
${description || '(No description provided)'}

Generate a comprehensive, automatable test plan with happy-path, negative, and edge-case scenarios.
Include step-by-step details and expected outcomes using ONLY ${framework.toUpperCase()} patterns.
AC numbering is required on every scenario (AC-1, AC-2, ...).`;

  const responseText = await callLLM(sysPrompt, userPrompt, 'PLANNER');
  const plan = extractJSON(responseText);

  if (!plan || !Array.isArray(plan.testPlan) || plan.testPlan.length === 0) {
    throw new Error('Planner returned empty or invalid test plan');
  }

  // ── Runtime drift validation ───────────────────────────────────────────
  // Detect cross-framework contamination: the plan must declare the correct framework
  // and must not contain vocabulary from the other framework.
  validatePlannerOutput(framework, plan, responseText);

  info('PLANNER', `Test plan contains ${plan.testPlan.length} scenario(s) | framework field: ${plan.framework || '(not set)'}`);

  // Persist plan
  const planDir  = path.join('qa-framework', 'frameworks', framework === 'cypress' ? 'cypress' : 'playwright', 'specs');
  fs.mkdirSync(planDir, { recursive: true });
  const planFile = path.join(planDir, `${issueKey.toLowerCase()}-test-plan.json`);
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  info('PLANNER', `Saved plan: ${planFile}`);

  return plan;
}

// ---------------------------------------------------------------------------
// Planner system prompts — framework-specific (loaded with embedded CI rules)
// ---------------------------------------------------------------------------

function buildPlaywrightPlannerPrompt(ciRules) {
  const forbidden = (ciRules.planner?.forbiddenInPlan || []).join(', ') || 'cy.visit(), cy.get(), .should(), describe(), it()';
  const hints     = (ciRules.planner?.requiredSectionHints || []).map(h => `  - ${h}`).join('\n');
  return `You are an expert PLAYWRIGHT test planner for web applications. You produce test plans that feed
directly into the LLM Generator and are validated by strict CI gates before any test runs.

# FRAMEWORK: PLAYWRIGHT — NOT Cypress
Every scenario you produce will become a Playwright .spec.ts file. You MUST use Playwright vocabulary:
- test() and expect() — NOT describe()/it() (those are Cypress)
- async/await — NOT .then() chains
- Page Object Model classes from qa-framework/frameworks/playwright/pages/
- Relative URL paths for all navigation (e.g. navigate to /) — NEVER hardcode https://...
- FORBIDDEN in your plan output: ${forbidden}

# CI GATE REQUIREMENTS — YOUR PLAN MUST ENABLE THESE
The generator output is validated by scripts/validate-playwright-tests.js. Ensure every scenario:
1. Maps 1:1 to an AC number — prefix each with AC-1:, AC-2:, etc.
2. Names the exact Page Object class to use (e.g. LoginPage, InventoryPage, CartPage, CheckoutPage)
3. Uses only relative precondition URLs (never https://...)
4. Marks non-UI ACs (email, DB, filesystem) as: **NOT AUTOMATABLE** — reason: <reason>
5. Describes steps in Playwright terms: "click via LoginPage.clickLogin()" — NOT cy.contains(...)
6. Includes at least one assertion hint per scenario (what expect() should check)
7. Assigns a test area abbreviation for file naming (auth, checkout, inventory, cart, etc.)

# PLAN SECTION HINTS
Each scenario MUST provide:
${hints || '  - Page Object class name\n  - Relative URL path\n  - AC reference\n  - POM method names in steps'}

# OUTPUT FORMAT — MANDATORY
Return ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "framework": "playwright",
  "testPlan": [
    {
      "id": "TC-01",
      "acRef": "AC-1",
      "title": "Descriptive test title",
      "type": "happy-path|negative|edge-case",
      "pageObject": "LoginPage",
      "preconditions": "Navigate to /",
      "steps": ["Call LoginPage.fillUsername(user)", "Call LoginPage.fillPassword(pass)", "Call LoginPage.clickLogin()"],
      "expectedOutcome": "User is redirected to /inventory.html",
      "assertionHint": "expect(page.url()).toContain('/inventory.html')",
      "area": "auth",
      "automatable": true
    }
  ]
}`;
}

function buildCypressPlannerPrompt(ciRules) {
  const forbidden = (ciRules.planner?.forbiddenInPlan || []).join(', ') || 'cy.visit(), cy.request(), page.goto, test(), expect()';
  const hints     = (ciRules.planner?.requiredSectionHints || []).map(h => `  - ${h}`).join('\n');
  const cmds      = (ciRules.planner?.customCommands || []).join(', ') || 'cy.login(), cy.safeVisit(), cy.apiRequest()';
  return `You are an expert CYPRESS test planner for web applications. You produce test plans that feed
directly into the LLM Generator and are validated by strict CI gates before any test runs.

# FRAMEWORK: CYPRESS — NOT Playwright
Every scenario you produce will become a Cypress .cy.ts file. You MUST use Cypress vocabulary:
- describe() / it() structure — NOT test() (that is Playwright)
- cy.safeVisit() for ALL navigation — cy.visit() is FORBIDDEN and CI-linted
- cy.apiRequest() for ALL HTTP requests — cy.request() is FORBIDDEN and CI-linted
- .should() for assertions — NOT expect() as the primary form
- Custom commands available: ${cmds}
- Selectors priority: [data-test] > id > name > ARIA role > stable class
- Relative URL paths only (e.g. /) — NEVER cy.safeVisit('https://...')
- FORBIDDEN in your plan output: ${forbidden}

# CI GATE REQUIREMENTS — YOUR PLAN MUST ENABLE THESE
The generator output is validated by scripts/validate-cypress-tests.js. Ensure every scenario:
1. Maps 1:1 to an AC number — prefix each with AC-1:, AC-2:, etc.
2. Specifies cy.login() or cy.session() for any scenario accessing authenticated routes
3. Uses cy.safeVisit() (never cy.visit()) in step descriptions
4. Specifies cy.intercept() + cy.wait('@alias') for network assertion scenarios
5. Documents any fixture names needed so @requiredFixtures metadata can be generated
6. Marks non-UI ACs (email verification, DB, filesystem) as: **NOT AUTOMATABLE** — reason: <reason>
7. Includes at least one .should() assertion hint per scenario
8. Assigns a test area abbreviation for file naming (auth, checkout, inventory, cart, etc.)

# PLAN SECTION HINTS
Each scenario MUST provide:
${hints || '  - [data-test] selector references\n  - Relative URL path\n  - AC reference\n  - cy.safeVisit() navigation steps'}

# OUTPUT FORMAT — MANDATORY
Return ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "framework": "cypress",
  "testPlan": [
    {
      "id": "TC-01",
      "acRef": "AC-1",
      "title": "Descriptive test title",
      "type": "happy-path|negative|edge-case",
      "preconditions": "cy.login(); cy.safeVisit('/inventory.html')",
      "steps": ["cy.safeVisit('/')", "cy.get('[data-test=username]').type(user)", "cy.get('[data-test=login-button]').click()"],
      "expectedOutcome": "URL includes /inventory.html and Products heading visible",
      "assertionHint": "cy.url().should('include', '/inventory.html')",
      "fixtures": [],
      "area": "auth",
      "automatable": true
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Runtime drift validation — FAIL if planner output is framework-agnostic
// ---------------------------------------------------------------------------

function validatePlannerOutput(framework, plan, rawText) {
  const opposite = framework === 'cypress' ? 'playwright' : 'cypress';

  // Rule 1: plan must declare correct framework (when field present)
  if (plan.framework && plan.framework !== framework) {
    throw new Error(
      `PLANNER_DRIFT: plan declares framework="${plan.framework}" but orchestrator is running "${framework}". ` +
      'System prompts may have drifted — check buildPlaywrightPlannerPrompt and buildCypressPlannerPrompt.'
    );
  }

  // Rule 2: detect opposite-framework vocabulary in the raw response text
  const PLAYWRIGHT_MARKERS = ['cy.visit(', 'cy.get(', 'cy.should(', '.should(', 'describe(', 'it('];
  const CYPRESS_MARKERS    = ['page.goto', 'page.locator', 'page.getByRole', 'expect(', 'test(', 'async ({ page })'];

  const markers   = framework === 'playwright' ? PLAYWRIGHT_MARKERS : CYPRESS_MARKERS;
  const found     = markers.filter(m => rawText.includes(m));
  if (found.length > 0) {
    throw new Error(
      `PLANNER_DRIFT: Planner output for "${framework}" contains ${opposite}-specific markers: [${found.join(', ')}]. ` +
      'Generated plan is framework-agnostic. Check system prompt isolation.'
    );
  }

  // Rule 3: verify at least one scenario has an AC reference
  const hasAcRef = plan.testPlan.some(tc => tc.acRef || /AC-\d+/i.test(tc.title + (tc.preconditions || '') + (tc.steps || []).join(' ')));
  if (!hasAcRef) {
    warn('PLANNER', 'PLANNER_DRIFT WARNING: No AC references detected in planner output. Traceability will fail CI.');
  }

  info('PLANNER', `Drift validation passed — framework=${framework}, framework field=${plan.framework || '(not set by LLM)'}`);
}

// ---------------------------------------------------------------------------
// Step 5 — LLM Generator
// ---------------------------------------------------------------------------

async function runGenerator(framework, issueKey, summary, description, testPlan) {
  info('GENERATOR', `Generating test files for ${framework}`);

  // Load framework-specific CI rules (same source as planner — single source of truth)
  const ciRules   = loadCiRules(framework);
  const sysPrompt = framework === 'cypress'
    ? buildCypressGeneratorPrompt(ciRules)
    : buildPlaywrightGeneratorPrompt(ciRules);

  // Log pipeline config for full observability
  info('GENERATOR', `Framework: ${framework} | System prompt: ${framework === 'cypress' ? 'CYPRESS_GENERATOR' : 'PLAYWRIGHT_GENERATOR'}`);
  info('GENERATOR', `CI gates: ${(ciRules.generator?.ciGates || []).join(', ') || 'none'}`);
  info('GENERATOR', `Mandatory rules (${(ciRules.generator?.mandatoryRules || []).length}): ${(ciRules.generator?.mandatoryRules || []).slice(0, 3).join(' | ')}...`);
  info('GENERATOR', `Forbidden patterns: ${(ciRules.generator?.forbiddenPatterns || []).join(', ') || 'none'}`);

  const testFiles = [];

  for (const scenario of testPlan.testPlan) {
    const fileName = buildFileName(framework, issueKey, scenario);
    const filePath = buildFilePath(framework, issueKey, scenario, fileName);

    if (fs.existsSync(filePath)) {
      info('GENERATOR', `Skipping existing file: ${filePath}`);
      testFiles.push(filePath);
      continue;
    }

    info('GENERATOR', `Generating: ${fileName}`);

    const userPrompt = buildGeneratorPrompt(framework, issueKey, summary, description, scenario, ciRules);
    const code = await withRetry('GENERATOR', () => callLLM(sysPrompt, userPrompt, 'GENERATOR'));
    const extracted = extractCode(code) || code;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, extracted, 'utf8');
    info('GENERATOR', `Created: ${filePath}`);
    testFiles.push(filePath);
  }

  info('GENERATOR', `Generated ${testFiles.length} test file(s)`);
  return testFiles;
}

function buildFileName(framework, issueKey, scenario) {
  const area = (scenario.area || 'general').toLowerCase().replace(/\s+/g, '-');
  const slug = scenario.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const prefix = 'saucedemo';
  const seq    = String(testPlan_seqForScenario(scenario)).padStart(2, '0');

  if (framework === 'cypress') {
    return `${prefix}-cy-${area}-${seq}-${slug}.cy.ts`;
  }
  return `${prefix}-tc-${area}-${seq}-${slug}.spec.ts`;
}

const _seqMap = {};
function testPlan_seqForScenario(scenario) {
  const id = scenario.id || scenario.title;
  if (!_seqMap[id]) {
    _seqMap[id] = Object.keys(_seqMap).length + 1;
  }
  return _seqMap[id];
}

function buildFilePath(framework, issueKey, scenario, fileName) {
  const storySlug = issueKey.toLowerCase();
  const area = (scenario.area || 'general').toLowerCase();
  if (framework === 'cypress') {
    return path.join('qa-framework', 'frameworks', 'cypress', 'tests', storySlug, fileName);
  }
  return path.join('qa-framework', 'frameworks', 'playwright', 'tests', storySlug, area, fileName);
}

function buildGeneratorPrompt(framework, issueKey, summary, description, scenario, ciRules) {
  const rules        = ciRules?.generator || {};
  const mandatory    = (rules.mandatoryRules    || []).map((r, i) => `  ${i + 1}. ${r}`).join('\n');
  const forbidden    = (rules.forbiddenPatterns  || []).map(p => `  - ${p}`).join('\n');
  const required     = (rules.requiredPatterns   || []).map(p => `  - ${p}`).join('\n');
  const ciGates      = (rules.ciGates            || []).join(', ') || 'none';

  return `Generate a complete, production-ready test file for the following scenario.
This file will be validated by: ${ciGates}. It MUST pass CI or the pipeline fails.

Jira Issue:   ${issueKey}
Framework:    ${framework.toUpperCase()}
Summary:      ${summary}
Scenario ID:  ${scenario.id}
AC Ref:       ${scenario.acRef || 'see description'}
Scenario:     ${scenario.title}
Type:         ${scenario.type}
Preconditions: ${scenario.preconditions}
Steps:
${scenario.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
Expected:     ${scenario.expectedOutcome}

# MANDATORY RULES — CI WILL REJECT FILES THAT VIOLATE THESE
${mandatory || '  (no rules loaded — check config/ci-rules/)'}

# FORBIDDEN PATTERNS — CI REJECTS FILES CONTAINING THESE
${forbidden || '  (none)'}

# REQUIRED PATTERNS — FILE MUST CONTAIN THESE
${required || '  (none)'}

Return ONLY the complete TypeScript source code. No explanations, no code fences.`;
}

// ---------------------------------------------------------------------------
// Generator system prompts — comprehensive, framework-specific
// ---------------------------------------------------------------------------

function buildPlaywrightGeneratorPrompt(ciRules) {
  const rules     = ciRules?.generator || {};
  const pomDir    = rules.pomRules?.pageObjectDir || 'qa-framework/frameworks/playwright/pages/';
  const stubPath  = rules.notImplementedStubPath  || 'qa-framework/notimplemented/';
  const stubTmpl  = rules.stubTemplate            || 'qa-framework/notimplemented/_TEMPLATE.spec.ts';
  return `You are an expert PLAYWRIGHT TypeScript test generator. You produce production-ready .spec.ts files
that are validated by scripts/validate-playwright-tests.js before any browser is launched.

# FRAMEWORK: PLAYWRIGHT — NEVER generate Cypress syntax
You MUST use: test(), expect(), async/await, @playwright/test imports.
You MUST NOT use: describe(), it(), cy.*, .should() — these are Cypress and will cause parse errors.

# CI GATE — FILES ARE REJECTED IF THEY VIOLATE THESE RULES
1. File MUST start with: // Jira: <issue-key>
2. File MUST import test and expect from '@playwright/test'
3. File MUST import at least one Page Object class from ${pomDir}
4. All browser ACTIONS (click, fill, type, hover, check) MUST go through POM methods in the spec — never raw page.locator() for actions
5. Every test() block MUST contain at least one expect() assertion — zero-assertion tests fail CI
6. Never use page.goto('https://...') — use relative paths e.g. page.goto('/') — baseURL resolves the host from playwright.config.ts
7. Never hardcode credential strings in .fill() — use: process.env.SAUCE_USERNAME ?? 'standard_user'
8. Never use test.skip() or test.fixme() without: // @skip-reason: <explanation>
9. File MUST contain at least one console.log() call
10. console.log() calls MUST use [STEP], [NAV], or [ASSERT] prefix for pipeline observability

# POM RULES — MANDATORY
- Import from ${pomDir}
- Create or extend POM class if needed — declare it inline in the spec if not yet extracted to a file
- Export selector constants as readonly class properties, not inline strings
- Expose action methods (e.g. clickLogin()) and assertion methods (e.g. assertPageLoaded())
- Spec file calls ONLY POM methods for actions — never raw locators

# OBSERVABILITY — MANDATORY
Log before each major action block   : console.log('[STEP] <description>');
Log after every navigation           : console.log('[NAV] url=%s title=%s', page.url(), await page.title());
Log before each expect() assertion   : console.log('[ASSERT] Expected: <expectation>, got: %s', actualValue);

# CREDENTIAL RULES
const user = process.env.SAUCE_USERNAME ?? 'standard_user';
const pass = process.env.SAUCE_PASSWORD ?? 'secret_sauce';

# NOTIMPLEMENTED STUBS
For non-UI ACs create a stub at: ${stubPath}
Use template: ${stubTmpl}
Fill @category, @autoFixable, @required fields.

# FILE STRUCTURE
// Jira: <issue-key> — <story title>
// AC-N: <AC text>
import { test, expect } from '@playwright/test';
import { LoginPage }    from '${pomDir}saucedemo/LoginPage';

test.describe('<Scenario Group>', () => {
  // AC-N: <AC text>
  test('<test title>', async ({ page }) => {
    console.log('[STEP] <action>');
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    console.log('[NAV] url=%s title=%s', page.url(), await page.title());
    await loginPage.login(user, pass);
    const url = page.url();
    console.log('[ASSERT] Expected /inventory, got: %s', url);
    expect(url).toContain('/inventory');
  });
});

Return ONLY the TypeScript source code. No markdown, no explanations, no code fences.`;
}

function buildCypressGeneratorPrompt(ciRules) {
  const rules     = ciRules?.generator || {};
  const fixtures  = (rules.fixtureRules?.knownFixtures || ['users.json', 'checkout-user.json', 'test.txt', 'example.json']).join(', ');
  const stubPath  = rules.notImplementedStubPath || 'qa-framework/notimplemented/';
  const stubTmpl  = rules.stubTemplate           || 'qa-framework/notimplemented/_TEMPLATE.cy.ts';
  const cmds      = Object.entries(ciRules?.generator?.customCommandDocs || {
    'cy.login()':       'Uses Cypress.env(username) ?? standard_user with safe defaults',
    'cy.safeVisit()':   'Adds failOnStatusCode:false and logs landed URL automatically',
    'cy.apiRequest()':  'Injects x-api-key from Cypress.env(REQRES_API_KEY)',
    'cy.withinIframe()':'Wraps iframe interaction to avoid raw DOM access',
  }).map(([k, v]) => `  ${k} — ${v}`).join('\n');
  return `You are an expert CYPRESS TypeScript test generator. You produce production-ready .cy.ts files
that are validated by scripts/validate-cypress-tests.js before any browser is launched.

# FRAMEWORK: CYPRESS — NEVER generate Playwright syntax
You MUST use: describe(), it(), cy.* commands.
You MUST NOT use: test(), expect() as primary form, page.goto, async/await patterns — these are Playwright.

# CI GATE — FILES ARE REJECTED IF THEY VIOLATE THESE RULES
1. File MUST start with: // Jira: <issue-key>
2. cy.visit() is FORBIDDEN — always use cy.safeVisit() (CI lint enforced)
3. cy.request() is FORBIDDEN — always use cy.apiRequest() (CI lint enforced)
4. Every it() block MUST contain at least one .should() / .should( / expect() assertion
5. Never use it.skip() or xit() without: // @skip-reason: <explanation>
6. Never hardcode credential strings in .type() — use: (Cypress.env('username') as string | undefined) ?? 'standard_user'
7. File MUST contain at least one cy.log() call
8. If cy.fixture() or .selectFile('cypress/fixtures/...') is used, line 3 MUST have: // @requiredFixtures: [...]
9. cy.safeVisit() MUST use relative paths — NEVER cy.safeVisit('https://...')
10. Iframe interactions MUST use cy.withinIframe() — never raw .its('contentDocument.body')

# CUSTOM COMMANDS — USE THESE INSTEAD OF RAW COMMANDS
${cmds}

# KNOWN FIXTURES (auto-created)
${fixtures}
For new fixtures, create the fixture file and add to REQUIRED_FIXTURES in cypress.config.ts.

# OBSERVABILITY — MANDATORY
cy.log('STEP: <description>') before each major action block
cy.url().then(url => cy.log('NAV: ' + url)) after every navigation
cy.url().then(url => cy.log('ASSERT: Expected X in: ' + url)) before URL assertions

# CREDENTIAL RULES
const user = (Cypress.env('username') as string | undefined) ?? 'standard_user';
const pass = (Cypress.env('password') as string | undefined) ?? 'secret_sauce';
Use cy.login() instead of repeating these inline.

# SESSION / AUTH PATTERN
// Option A — custom command (preferred)
beforeEach(() => { cy.login(); cy.safeVisit('/inventory.html'); });
// Option B — session caching
beforeEach(() => {
  cy.session(['standard_user'], () => {
    cy.safeVisit('/');
    cy.get('[data-test="username"]').type(user);
    cy.get('[data-test="password"]').type(pass);
    cy.get('[data-test="login-button"]').click();
    cy.url().should('include', '/inventory.html');
  });
  cy.safeVisit('/inventory.html');
});

# NOTIMPLEMENTED STUBS
For non-UI ACs create a stub at: ${stubPath}
Use template: ${stubTmpl}
Fill @category, @autoFixable, @required fields.

# FILE STRUCTURE
// Jira: <issue-key> — <story title>
// AC-N: <AC text>
// @requiredFixtures: ["users.json"]   ← ONLY if cy.fixture() is used; omit otherwise

describe('<Test Suite>', () => {
  beforeEach(() => { cy.login(); cy.safeVisit('/'); });

  // AC-N: <AC text>
  it('<test title>', () => {
    cy.log('STEP: <action>');
    cy.safeVisit('/inventory.html');
    cy.url().then(url => cy.log('NAV: ' + url));
    cy.url().then(url => cy.log('ASSERT: Expected /inventory in: ' + url));
    cy.url().should('include', '/inventory.html');
  });
});

Return ONLY the TypeScript source code. No markdown, no explanations, no code fences.`;
}

// ---------------------------------------------------------------------------
// Step 6 — Execute Tests
// ---------------------------------------------------------------------------

function executeTests(framework, issueKey) {
  info('TEST-RUN', `Executing ${framework} tests`);

  const isCI = !!process.env.CI;

  if (framework === 'cypress') {
    const resultsDir = path.join('qa-framework', 'frameworks', 'cypress', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    const result = spawnSync('npx', [
      'cypress', 'run',
      '--config-file', 'qa-framework/frameworks/cypress/cypress.config.ts',
      '--reporter', 'mochawesome',
      '--reporter-options', `reportDir=${resultsDir},overwrite=false,html=true,json=true`,
    ], {
      stdio: 'pipe',
      encoding: 'utf8',
      env: Object.assign({}, process.env, { FORCE_COLOR: '1' }),
    });
    // Forward captured output to parent process for CI log visibility
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const testOutput = [result.stdout || '', result.stderr || ''].join('\n').trim();
    const resultsJson = path.join(resultsDir, 'mochawesome.json');
    let stats = null;
    if (fs.existsSync(resultsJson)) {
      try {
        const raw = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));
        stats = { passed: raw.stats?.passes || 0, failed: raw.stats?.failures || 0, skipped: raw.stats?.pending || 0 };
      } catch {}
    }
    return {
      passed: result.status === 0,
      exitCode: result.status,
      resultsJson: fs.existsSync(resultsJson) ? resultsJson : null,
      stats,
      output: testOutput,
    };
  }

  // Playwright
  const reportDir  = path.join('qa-framework', 'frameworks', 'playwright', 'test-results');
  const jsonReport = path.join(reportDir, 'results.json');
  fs.mkdirSync(reportDir, { recursive: true });
  const result = spawnSync('npx', [
    'playwright', 'test',
    '--config', 'qa-framework/frameworks/playwright/playwright.config.ts',
    '--reporter', `json:${jsonReport}`,
  ], {
    stdio: 'pipe',
    encoding: 'utf8',
    env: Object.assign({}, process.env, { FORCE_COLOR: '1' }),
  });
  // Forward captured output to parent process for CI log visibility
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const testOutput = [result.stdout || '', result.stderr || ''].join('\n').trim();

  let stats = null;
  if (fs.existsSync(jsonReport)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonReport, 'utf8'));
      stats = { passed: raw.stats?.expected || 0, failed: raw.stats?.unexpected || 0, skipped: raw.stats?.skipped || 0 };
    } catch {}
  }
  return {
    passed: result.status === 0,
    exitCode: result.status,
    resultsJson: fs.existsSync(jsonReport) ? jsonReport : null,
    stats,
    output: testOutput,
  };
}

// ---------------------------------------------------------------------------
// Step 7 — LLM Healer (up to HEALER_MAX_RETRIES attempts, then notimplemented)
// ---------------------------------------------------------------------------

const NOT_IMPL_DIR = path.resolve(process.cwd(), 'qa-framework', 'notimplemented');

// ---------------------------------------------------------------------------
// Healer helper — extract only the test files mentioned in failure output
// ---------------------------------------------------------------------------

function extractFailingFiles(output, allFiles) {
  if (!output || output.trim() === '') return [];
  // Match any .spec.ts or .cy.ts path fragments that appear in test runner output
  const matches = output.match(/[\w./@-]+\.(?:spec|cy)\.ts/g);
  const mentioned = new Set(matches || []);
  // Cross-reference against the known test files so we never return phantom paths
  const failing = allFiles.filter(f => {
    const base = path.basename(f);
    return [...mentioned].some(m => f.includes(m) || base === path.basename(m));
  });
  return failing;
}

function moveToNotImplemented(filePath, issueKey, reason) {
  fs.mkdirSync(NOT_IMPL_DIR, { recursive: true });
  const basename = path.basename(filePath);
  // Convert .spec.ts / .cy.ts → .notimplemented.spec.ts / .notimplemented.cy.ts
  const notImplName = basename
    .replace(/\.spec\.ts$/, '.notimplemented.spec.ts')
    .replace(/\.cy\.ts$/,   '.notimplemented.cy.ts');
  const dest = path.join(NOT_IMPL_DIR, notImplName);

  const originalSrc = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const stub = [
    `// NOT IMPLEMENTED — moved by QA Healer after ${cfg.healerMaxRetries} failed attempt(s)`,
    `// Jira: ${issueKey}`,
    `// Reason: ${reason}`,
    `// Original file: ${path.relative(process.cwd(), filePath)}`,
    `// Moved at: ${new Date().toISOString()}`,
    '',
    '/* Original source preserved below for manual review */',
    originalSrc,
  ].join('\n');

  fs.writeFileSync(dest, stub, 'utf8');

  // Remove the original so it no longer runs in CI
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  warn('HEALER', `Moved unrecoverable file to notimplemented: ${dest}`);
  return dest;
}

async function runHealer(framework, issueKey, testFiles, failureOutput, attempt) {
  const attemptNum = attempt || 1;
  info('HEALER', `Heal attempt ${attemptNum}/${cfg.healerMaxRetries} for ${testFiles.length} file(s)`);

  const healed = [];
  const unrecoverable = [];

  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) continue;

    const originalCode = fs.readFileSync(filePath, 'utf8');
    const sysPrompt    = framework === 'cypress'
      ? CYPRESS_HEALER_SYSTEM_PROMPT
      : PLAYWRIGHT_HEALER_SYSTEM_PROMPT;

    const userPrompt = `The following test file is failing in CI. Fix it.

Framework: ${framework}
File: ${filePath}
Issue Key: ${issueKey}
Heal attempt: ${attemptNum} of ${cfg.healerMaxRetries}

Failure output:
${(failureOutput || '').substring(0, 3000)}

Original test code:
\`\`\`typescript
${originalCode}
\`\`\`

Return ONLY the fixed TypeScript source code. Preserve all existing assertions and logic.`;

    try {
      const fixedCode = await withRetry('HEALER', () => callLLM(sysPrompt, userPrompt, 'HEALER'));
      const extracted = extractCode(fixedCode) || fixedCode;

      // Back up original before overwriting
      fs.writeFileSync(`${filePath}.bak.${attemptNum}`, originalCode, 'utf8');
      fs.writeFileSync(filePath, extracted, 'utf8');
      info('HEALER', `Patched (attempt ${attemptNum}): ${filePath}`);
      healed.push(filePath);
    } catch (e) {
      warn('HEALER', `Could not heal ${filePath} on attempt ${attemptNum}: ${e.message}`);
      unrecoverable.push({ filePath, reason: e.message });
    }
  }

  // Files the LLM couldn't even generate a fix for → move immediately
  for (const { filePath, reason } of unrecoverable) {
    if (attemptNum >= cfg.healerMaxRetries) {
      moveToNotImplemented(filePath, issueKey, `LLM heal failed after ${cfg.healerMaxRetries} attempt(s): ${reason}`);
    }
  }

  return healed;
}

const PLAYWRIGHT_HEALER_SYSTEM_PROMPT = `You are an expert Playwright test healer.
Given a failing test file and the error output, fix the test to pass.
Rules you MUST follow:
- Preserve all assertions (do NOT weaken or remove expect() calls)
- Preserve the // Jira: header
- Fix selectors, waits, navigation issues, type errors
- Use process.env for credentials, never hardcoded strings
Return ONLY the fixed TypeScript source code.`;

const CYPRESS_HEALER_SYSTEM_PROMPT = `You are an expert Cypress test healer.
Given a failing test file and the error output, fix the test to pass.
Rules you MUST follow:
- Preserve all cy.should() assertions
- Fix selectors, intercept patterns, session issues
- Keep // @requiredFixtures comment if fixtures are used
Return ONLY the fixed TypeScript source code.`;

// ---------------------------------------------------------------------------
// Step 8 — Generate report + validate it
// ---------------------------------------------------------------------------

const REQUIRED_REPORT_SECTIONS = [
  'Executive Summary',
  'Test Execution Results',
  'AC Coverage',           // matches '## 3. AC Coverage' (Acceptance Criteria coverage section)
  'Failure Analysis',
  'Healing Activities',
  'Coverage Summary',      // matches '## 6. Test Coverage Summary'
  'Gaps & Recommendations',
];

function validateReport(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error(`Report file does not exist: ${reportPath}`);
  }

  const content = fs.readFileSync(reportPath, 'utf8');

  if (content.trim().length === 0) {
    throw new Error(`Report file is empty: ${reportPath}`);
  }

  const missing = REQUIRED_REPORT_SECTIONS.filter(section =>
    !content.includes(section)
  );

  if (missing.length > 0) {
    throw new Error(
      `Report is missing required section(s): [${missing.join(', ')}]. ` +
      `Found in: ${reportPath}`
    );
  }

  info('REPORT', `Report validated: all required sections present (${REQUIRED_REPORT_SECTIONS.join(', ')})`);
}

function generateReport(framework, issueKey, resultsJson) {
  info('REPORT', `Generating Markdown report for ${issueKey}`);

  if (!resultsJson || !fs.existsSync(resultsJson)) {
    throw new Error(
      `No test results JSON found for ${issueKey}. ` +
      'Tests must produce a results file before a report can be generated.'
    );
  }

  // Layer 1 — Execution failure: let execSync throw naturally so the pipeline stops immediately.
  // Layer 2 — Content validation: validateReport() below enforces all 7 required sections.
  execSync(
    `node scripts/generate-report.js --framework ${framework} --results-json "${resultsJson}" --story-key "${issueKey}"`,
    { stdio: 'inherit' }
  );

  // Resolve actual report file (handle casing variants)
  const candidates = [
    path.join(REPORT_DIR, `${issueKey}-test-report.md`),
    path.join(REPORT_DIR, `${issueKey.toLowerCase()}-test-report.md`),
    path.join(REPORT_DIR, `${issueKey.toUpperCase()}-test-report.md`),
  ];

  const reportFile = candidates.find(f => fs.existsSync(f));
  if (!reportFile) {
    throw new Error(
      `Report file was not created by generate-report.js. ` +
      `Expected one of: ${candidates.join(', ')}`
    );
  }

  // Validate report content
  validateReport(reportFile);

  info('REPORT', `Report: ${reportFile}`);
  return reportFile;
}

// ---------------------------------------------------------------------------
// Step 9 — Update Jira
// ---------------------------------------------------------------------------

async function updateJira(issueKey, passed, reportPath, testFiles, testStats) {
  info('JIRA', `Updating Jira issue ${issueKey}`);

  const commentBody = buildJiraComment(issueKey, passed, reportPath, testFiles);

  // Post comment
  const commentUrl = `https://api.atlassian.com/ex/jira/${cfg.atlassianCloudId}/rest/api/3/issue/${issueKey}/comment`;
  try {
    await withRetry('JIRA-COMMENT', () =>
      httpsRequest('POST', commentUrl, jiraAuth(), {
        body: {
          type:    'doc',
          version: 1,
          content: [{
            type:    'paragraph',
            content: [{ type: 'text', text: commentBody }],
          }],
        },
      })
    );
    info('JIRA', 'Comment posted');
  } catch (e) {
    warn('JIRA', `Comment failed: ${e.message}`);
  }

  // Transition — ONLY move to Done when ALL tests passed (failed == 0)
  // Refuse to transition if stats are missing — avoids phantom success where
  // the runner exited 0 but produced no parseable results JSON.
  if (!testStats) {
    throw new Error(
      `Missing test stats for ${issueKey} — refusing Jira transition to prevent phantom Done status. ` +
      'Ensure the test runner produced a parseable results JSON.'
    );
  }
  const failedCount  = testStats.failed;
  const canTransDone = passed && failedCount === 0;
  const transitionId = canTransDone ? cfg.jiraDoneId : cfg.jiraInQaId;
  const transTarget  = canTransDone ? 'Done' : 'In QA';

  if (!canTransDone && passed) {
    warn('JIRA',
      `passed=true but failedCount=${failedCount} — refusing to transition to Done. Will stay In QA.`);
  }

  const transUrl = `https://api.atlassian.com/ex/jira/${cfg.atlassianCloudId}/rest/api/3/issue/${issueKey}/transitions`;
  try {
    await withRetry('JIRA-TRANSITION', () =>
      httpsRequest('POST', transUrl, jiraAuth(), {
        transition: { id: transitionId },
      })
    );
    info('JIRA', `Transitioned to ${transTarget} (id=${transitionId}, failed=${failedCount})`);
  } catch (e) {
    error('JIRA', `Transition to ${transTarget} failed: ${e.message}`);
    throw new Error(`Jira transition to ${transTarget} failed: ${e.message}`);
  }
}

function buildJiraComment(issueKey, passed, reportPath, testFiles) {
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : 'local run';
  return [
    `QA Automation Pipeline — ${status}`,
    `Issue: ${issueKey}`,
    `Branch: auto/test-${issueKey.toLowerCase()}`,
    `Files: ${testFiles.length} test file(s) generated`,
    `Report: ${reportPath || 'see artifacts'}`,
    `Run: ${runUrl}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Step 10 — PR automation (branch + commit + PR)
// ---------------------------------------------------------------------------

async function createPR(issueKey, framework, summary, testFiles) {
  info('PR', `Creating branch and PR for ${issueKey}`);

  // Create branch via GitHub API
  const [refData] = await Promise.all([
    withRetry('PR-BRANCH', () =>
      httpsRequest('GET',
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/ref/heads/${cfg.baseBranch}`,
        Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth())
      )
    ),
  ]);

  const baseSha    = refData.data.object?.sha;
  if (!baseSha) throw new Error(`Could not resolve SHA for branch ${cfg.baseBranch}`);

  // Check if branch already exists — reuse it instead of creating
  const branchAlreadyExists = await branchExists(BRANCH_NAME);
  if (branchAlreadyExists) {
    info('PR', `Branch already exists — reusing: ${BRANCH_NAME}`);
  }

  if (!branchAlreadyExists) {
    await httpsRequest('POST',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/refs`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth()),
      { ref: `refs/heads/${BRANCH_NAME}`, sha: baseSha }
    );
    info('PR', `Branch created: ${BRANCH_NAME}`);
  }

  // Commit test files
  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) continue;
    await commitFile(filePath, issueKey);
  }

  // Commit state file
  if (fs.existsSync(STATE_FILE)) {
    await commitFile(STATE_FILE, issueKey);
  }

  // Verify branch was actually created / exists before committing
  try {
    await withRetry('PR-BRANCH-VERIFY', () =>
      httpsRequest('GET',
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/ref/heads/${BRANCH_NAME}`,
        Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth())
      )
    );
    info('PR', `Branch exists and is ready: ${BRANCH_NAME}`);
  } catch (e) {
    throw new Error(`Branch ${BRANCH_NAME} does not exist after creation attempt: ${e.message}`);
  }

  // Check for existing PR to prevent duplicates
  const prsResp = await withRetry('PR-CHECK', () =>
    httpsRequest('GET',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/pulls?head=${GH_OWNER}:${BRANCH_NAME}&base=${cfg.baseBranch}&state=open`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth())
    )
  );

  if (Array.isArray(prsResp.data) && prsResp.data.length > 0) {
    const prUrl = prsResp.data[0].html_url;
    info('PR', `PR already exists: ${prUrl}`);
    return prUrl;
  }

  // Create PR
  const prBody = [
    `## Automated QA Tests — ${issueKey}`,
    '',
    `**Story:** ${summary}`,
    `**Framework:** ${framework}`,
    `**Test files:** ${testFiles.length}`,
    '',
    '### Files',
    testFiles.map(f => `- \`${f}\``).join('\n'),
    '',
    '_Generated by QA Automation Orchestrator_',
  ].join('\n');

  const prResp = await withRetry('PR-CREATE', () =>
    httpsRequest('POST',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/pulls`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth()),
      {
        title: `[QA] ${issueKey} — Automated tests (${framework})`,
        body:  prBody,
        head:  BRANCH_NAME,
        base:  cfg.baseBranch,
        draft: false,
      }
    )
  );

  const prUrl = prResp.data.html_url;
  info('PR', `PR created: ${prUrl}`);
  return prUrl;
}

async function commitFile(filePath, issueKey) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const content      = fs.readFileSync(filePath);
  const b64          = content.toString('base64');

  // Get current SHA of file if it exists (needed for updates)
  let currentSha;
  try {
    const existing = await httpsRequest('GET',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${relativePath}?ref=${BRANCH_NAME}`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth())
    );
    currentSha = existing.data.sha;
  } catch {}

  await withRetry('COMMIT', () =>
    httpsRequest('PUT',
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${relativePath}`,
      Object.assign({ 'X-GitHub-Api-Version': '2022-11-28' }, githubAuth()),
      {
        message: `test(${issueKey}): add automated tests [orchestrator]`,
        content: b64,
        branch:  BRANCH_NAME,
        ...(currentSha ? { sha: currentSha } : {}),
      }
    )
  );
  info('COMMIT', `Committed: ${relativePath}`);
}

// ---------------------------------------------------------------------------
// LLM helper (OpenAI)
// ---------------------------------------------------------------------------

/**
 * callLLM — call OpenAI chat completions with per-step identity logging
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} [stepLabel]  Identifies the logical step (e.g. 'PLANNER', 'GENERATOR', 'HEALER').
 *                              Surfaced in timeout/error messages for fast diagnosis.
 */
async function callLLM(systemPrompt, userPrompt, stepLabel = 'LLM') {
  const url     = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model:       cfg.openaiModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  };

  info(stepLabel, `Calling LLM (model=${cfg.openaiModel}, prompt_chars=${userPrompt.length})`);
  const start = Date.now();

  let resp;
  try {
    resp = await httpsRequest('POST', url,
      { Authorization: `Bearer ${cfg.openaiKey}` },
      payload
    );
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (e.message.includes('timed out')) {
      error(stepLabel, `LLM call timed out after ${elapsed}s — step=${stepLabel} model=${cfg.openaiModel}`);
    } else {
      error(stepLabel, `LLM call failed after ${elapsed}s: ${e.message}`);
    }
    throw e;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const choice  = resp.data?.choices?.[0];
  if (!choice) {
    error(stepLabel, `LLM returned no choices after ${elapsed}s`);
    throw new Error('LLM returned no choices');
  }

  info(stepLabel, `LLM responded in ${elapsed}s (finish_reason=${choice.finish_reason})`);
  return choice.message?.content || '';
}

function extractJSON(text) {
  // Try to extract first JSON object / array from text
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    return null;
  }
}

function extractCode(text) {
  // Extract code block from markdown fences
  const match = text.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  info('ORCHESTRATOR', `Starting pipeline for ${cfg.issueKey}`);
  info('ORCHESTRATOR', `Branch: ${BRANCH_NAME} | Base: ${cfg.baseBranch}`);

  // ── Dual-pipeline guard ────────────────────────────────────────────────
  // If the primary Jira-triggered pipeline (jira-ready-for-qa.yml) has already
  // created the auto/test-* branch, the QA orchestrator path (qa-automation.yml)
  // must NOT run — it would produce duplicate Jira comments and conflicting transitions.
  if (await branchExists(BRANCH_NAME)) {
    info('SKIP', `Primary Jira pipeline already active — branch ${BRANCH_NAME} exists. Skipping orchestrator.`);
    process.exit(0);
  }
  info('ORCHESTRATOR', `Branch ${BRANCH_NAME} not found — proceeding with standalone pipeline`);

  // Load / init state
  let state = stateLoad();
  if (state) {
    info('STATE', `Resuming from existing state (created ${state.createdAt})`);
  }

  // ── Quality gate pre-flight (BLOCKING — outside try/catch, throws and stops execution) ──
  // Must run before any LLM calls or test execution. No try/catch wrapper — any
  // violation throws immediately, halting the pipeline with a non-zero exit code.
  runQualityGate();

  let jiraIssue, framework, testPlan, testFiles, testResult, reportFile, prUrl;

  try {
    // ── 1. Fetch Jira issue ────────────────────────────────────────────────
    jiraIssue  = await fetchJiraIssue();
    framework  = state?.framework || detectFramework(jiraIssue.labels);
    state      = stateSave({ framework, branch: BRANCH_NAME, issueTitle: jiraIssue.summary });

    // ── 3. Planner ─────────────────────────────────────────────────────────
    if (state.planGenerated) {
      info('PLANNER', 'Skipping planner — plan already generated (state cached)');
      const planFile = path.join('qa-framework', 'frameworks',
        framework === 'cypress' ? 'cypress' : 'playwright',
        'specs', `${cfg.issueKey.toLowerCase()}-test-plan.json`);
      testPlan = fs.existsSync(planFile)
        ? JSON.parse(fs.readFileSync(planFile, 'utf8'))
        : await runPlanner(framework, cfg.issueKey, jiraIssue.summary, jiraIssue.description);
    } else {
      testPlan = await runPlanner(framework, cfg.issueKey, jiraIssue.summary, jiraIssue.description);
      state    = stateSave({ planGenerated: true });
    }

    // ── 4. Generator ───────────────────────────────────────────────────────
    if (state.testsGenerated) {
      info('GENERATOR', 'Skipping generator — tests already generated (state cached)');
      testFiles = state.generatedTestFiles || [];
    } else {
      testFiles = await runGenerator(framework, cfg.issueKey, jiraIssue.summary, jiraIssue.description, testPlan);
      state     = stateSave({ testsGenerated: true, generatedTestFiles: testFiles });
    }

    // ── 4b. Post-generation quality gate (BLOCKING) ─────────────────────────
    // Re-run the quality gate AFTER generation so that newly created test files
    // are validated before execution. Files produced by runGenerator() bypassed
    // the pre-flight gate that ran before orchestrator.js started.
    info('GATE', 'Post-generation quality gate — validating newly generated test files');
    runQualityGate();

    // ── 5. Execute tests ───────────────────────────────────────────────────
    testResult = executeTests(framework, cfg.issueKey);
    info('TEST-RUN', `Tests ${testResult.passed ? 'PASSED' : 'FAILED'} (exit ${testResult.exitCode})`);
    state = stateSave({ testsPassed: testResult.passed, testExitCode: testResult.exitCode });

    // ── 6. Healer (up to HEALER_MAX_RETRIES attempts) ────────────────────────
    let healerAttempt = state.healerAttempts || 0;

    while (!testResult.passed && healerAttempt < cfg.healerMaxRetries) {
      healerAttempt++;
      info('HEALER', `Tests failed — invoking healer (attempt ${healerAttempt}/${cfg.healerMaxRetries})`);

      // Only heal files explicitly mentioned in failure output; fall back to all if none detected
      const failingFiles = extractFailingFiles(testResult.output || '', testFiles);
      if (failingFiles.length === 0) {
        warn('HEALER', 'No failing test files detected in output — skipping healer to avoid blindly patching passing tests');
        break;
      }
      info('HEALER', `Targeting ${failingFiles.length} failing file(s): ${failingFiles.map(f => path.basename(f)).join(', ')}`);
      await runHealer(framework, cfg.issueKey, failingFiles, testResult.output || '', healerAttempt);
      state = stateSave({ healerAttempts: healerAttempt, [`healerRanAt${healerAttempt}`]: new Date().toISOString() });

      // Re-run tests after healing
      testResult = executeTests(framework, cfg.issueKey);
      info('TEST-RUN', `Post-heal attempt ${healerAttempt}: tests ${testResult.passed ? 'PASSED' : 'FAILED'}`);
      state = stateSave({ testsPassed: testResult.passed, postHealExitCode: testResult.exitCode });

      if (testResult.passed) break;

      // Final attempt exhausted — move remaining broken files to notimplemented
      if (healerAttempt >= cfg.healerMaxRetries) {
        warn('HEALER',
          `Healer exhausted ${cfg.healerMaxRetries} attempt(s) — moving unrecoverable files to notimplemented/`);
        for (const filePath of testFiles) {
          if (fs.existsSync(filePath)) {
            moveToNotImplemented(
              filePath,
              cfg.issueKey,
              `Tests still failing after ${cfg.healerMaxRetries} heal attempt(s)`
            );
          }
        }
        state = stateSave({ healerExhausted: true });
      }
    }

    // ── 7. Generate report ─────────────────────────────────────────────────
    reportFile = generateReport(framework, cfg.issueKey, testResult.resultsJson);
    state      = stateSave({ reportGenerated: true, reportPath: reportFile });

    // ── 8. Update Jira ─────────────────────────────────────────────────────
    await updateJira(cfg.issueKey, testResult.passed, reportFile, testFiles, testResult.stats);
    state = stateSave({ jiraUpdated: true, jiraStatus: testResult.passed ? 'Done' : 'In QA' });

    // ── 9. PR automation — ONLY on full success ──────────────────────────────
    const failedCount = testResult.stats?.failed ?? (testResult.passed ? 0 : 1);
    if (testResult.passed === true && failedCount === 0) {
      if (!state.prUrl) {
        prUrl = await createPR(cfg.issueKey, framework, jiraIssue.summary, testFiles);
        state = stateSave({ prUrl });
      } else {
        prUrl = state.prUrl;
        info('PR', `PR already created: ${prUrl}`);
      }
    } else {
      warn('PR', `Skipping PR creation — tests failed (passed=${testResult.passed}, failed=${failedCount})`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    info('ORCHESTRATOR', `Pipeline complete in ${elapsed}s`);
    info('ORCHESTRATOR', `Result: ${testResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
    info('ORCHESTRATOR', `PR: ${prUrl || '(not created — tests failed)'}`);
    info('ORCHESTRATOR', `Report: ${reportFile}`);

    if (!testResult.passed) {
      error('ORCHESTRATOR', 'Tests failed after healing — pipeline exits 1');
      process.exit(1);
    }

  } catch (e) {
    error('ORCHESTRATOR', `Unhandled error: ${e.message}`);
    if (e.stack) console.error(e.stack);
    try {
      stateSave({ lastError: e.message, lastErrorAt: new Date().toISOString() });
    } catch {}
    process.exit(1);
  }
}

main();
