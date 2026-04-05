/** Supported test frameworks in this pipeline */
export type TestFramework = 'playwright' | 'cypress';

/** AC review verdict produced by the AC scorer */
export type AcVerdict = 'AUTOMATE' | 'IMPROVE' | 'REWRITE' | 'MANUAL ONLY';

/** Jira workflow transition target status */
export type JiraTransition = 'In QA' | 'QA Passed' | 'QA Failed' | 'Done' | 'Reopened';

/** Persisted pipeline state for a single Jira issue */
export interface PipelineState {
  issueKey:            string;
  framework:           TestFramework;
  branch:              string;
  createdAt:           string;
  updatedAt:           string;

  // AC review
  acVerdict?:          AcVerdict;
  acScore?:            number;

  // Jira
  jiraStatus?:         string;

  // Test generation
  planGenerated?:      boolean;
  planPath?:           string;
  testsGenerated?:     boolean;
  generatedTestFiles?: string[];

  // CI execution
  testsPassed?:        boolean;
  postHealExitCode?:   number;
  healerExhausted?:    boolean;
  testRunSummary?:     {
    passed:   number;
    failed:   number;
    skipped:  number;
    duration: number;
  };

  // Reporting
  reportGenerated?:    boolean;
  reportPath?:         string;

  // Pull request
  prUrl?:              string;
  prHistory?:          string[];
}
