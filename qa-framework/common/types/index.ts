/**
 * Shared TypeScript types used across the entire QA pipeline.
 * Framework-agnostic — imported by Jira helpers, GitHub helpers, result parsers, and agents.
 */

// ---------------------------------------------------------------------------
// Test Framework
// ---------------------------------------------------------------------------

export type TestFramework = 'playwright' | 'cypress';

export type JiraTransition =
  | 'todo'
  | 'in-progress'
  | 'in-review'
  | 'in-qa'
  | 'ready-for-qa'
  | 'done';

export const JIRA_TRANSITION_IDS: Record<JiraTransition, string> = {
  'todo':          '11',
  'in-progress':   '21',
  'in-review':     '31',
  'in-qa':         '41',
  'ready-for-qa':  '51',
  'done':          '52',
};

// ---------------------------------------------------------------------------
// Jira
// ---------------------------------------------------------------------------

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  status: string;
  labels: string[];
  acceptanceCriteria: string[];
}

export interface JiraComment {
  issueKey: string;
  body: JiraAdfDocument;
}

/** Minimal Atlassian Document Format (ADF) types for comment bodies */
export interface JiraAdfDocument {
  version: 1;
  type: 'doc';
  content: JiraAdfNode[];
}

export interface JiraAdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JiraAdfNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

// ---------------------------------------------------------------------------
// AC Review
// ---------------------------------------------------------------------------

export type AcVerdict = 'AUTOMATE' | 'IMPROVE' | 'REWRITE';

export interface AcDimension {
  specific: number;
  verifiable: number;
  scoped: number;
  dataIndependent: number;
  uiReachable: number;
}

export interface AcReview {
  acText: string;
  score: number;
  verdict: AcVerdict;
  dimensions: AcDimension;
  issues: string[];
  suggestions: string[];
  rewrite?: string;
}

export interface AcReviewReport {
  issueKey: string;
  overallScore: number;
  overallVerdict: AcVerdict;
  summary: string;
  reviews: AcReview[];
  canAutomate: boolean;
}

// ---------------------------------------------------------------------------
// Test Results
// ---------------------------------------------------------------------------

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface TestCaseResult {
  title: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
  retries?: number;
}

export interface TestSuiteResult {
  suiteName: string;
  tests: TestCaseResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
}

export interface TestRunSummary {
  framework: TestFramework;
  branch: string;
  commitSha: string;
  runUrl: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
  conclusion: 'success' | 'failure' | 'cancelled';
  suites: TestSuiteResult[];
}

// ---------------------------------------------------------------------------
// Pipeline State
// ---------------------------------------------------------------------------

export interface PipelineState {
  issueKey: string;
  framework: TestFramework;
  branch: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  acVerdict?: AcVerdict;
  acScore?: number;
  testPlanPath?: string;
  generatedTestFiles?: string[];
  testRunSummary?: TestRunSummary;
  jiraStatus?: JiraTransition;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// AC Intelligence / Enrichment
// ---------------------------------------------------------------------------

export type AssertionHintKind =
  | 'url-check'
  | 'text-visible'
  | 'element-visible'
  | 'element-hidden'
  | 'element-enabled'
  | 'element-disabled'
  | 'value-equals'
  | 'count-equals'
  | 'state-change'
  | 'calculation';

export interface AssertionHint {
  kind:        AssertionHintKind;
  description: string;
  /** Pseudo-code snippet to paste into the generator */
  snippet?:    string;
}

export type EdgeCaseKind =
  | 'empty-input'
  | 'invalid-input'
  | 'boundary-value'
  | 'special-characters'
  | 'max-length'
  | 'zero-quantity'
  | 'concurrent-action';

export interface EdgeCase {
  kind:        EdgeCaseKind;
  description: string;
  testInput?:  string;
  expectedOutcome: string;
}

/** A single AC enriched with structured, test-ready information. */
export interface EnrichedAc {
  /** Sequence number within the story (1-based) */
  acNumber:    number;
  /** Verbatim original AC text — NEVER modified */
  originalText: string;
  /** Verdict inherited from ac-scorer */
  verdict:     AcVerdict;
  /** Score inherited from ac-scorer */
  score:       number;
  /** Whether this AC can be automated as a browser test */
  automatable: boolean;
  /** Reason automation is impossible (only when automatable=false) */
  nonAutomatableReason?: string;
  /** Rewritten AC in Given/When/Then format (only for IMPROVE/REWRITE) */
  enhancedText?: string;
  /** Explicit expected outcomes broken out from the AC text */
  expectedOutcomes: string[];
  /** Validation conditions that must hold */
  validationConditions: string[];
  /** Concrete assertion hints for the test generator */
  assertionHints: AssertionHint[];
  /** Auto-expanded edge cases */
  edgeCases: EdgeCase[];
  /** Step-by-step breakdown (if AC was vague) */
  testableSteps?: string[];
  /** Suggested it()/test() title */
  suggestedTestTitle: string;
  notImplementedPath?: string;
}

/** Full enriched output for one Jira story — saved to qa-framework/intelligence/{key}-enhanced-ac.json */
export interface EnhancedAcDocument {
  storyKey:    string;
  enrichedAt:  string;
  framework:   TestFramework;
  overallCanAutomate: boolean;
  /** Pipeline gate recommendation */
  pipelineAction: 'proceed' | 'proceed-with-warnings' | 'block';
  originalAcs: string[];
  enriched:    EnrichedAc[];
}

// ---------------------------------------------------------------------------
// Unimplemented Test Stub
// ---------------------------------------------------------------------------

export interface UnimplementedStub {
  acText: string;
  reason: string;
  missingPieces: string[];
  framework: TestFramework;
  issueKey: string;
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
}

export interface GitHubPrPayload {
  base: string;
  head: string;
  title: string;
  body: string;
  labels?: string[];
}
