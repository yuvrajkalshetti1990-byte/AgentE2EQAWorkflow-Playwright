/**
 * Pipeline State Manager
 *
 * Persists and retrieves pipeline state as a JSON file on disk (committed to the branch).
 * This ensures that re-runs don't duplicate work and that each workflow step can read
 * what previous steps produced.
 *
 * State file location: `qa-framework/state/{issue-key}.state.json`
 *
 * Usage in TypeScript:
 *   import { PipelineStateManager } from './qa-framework/common/pipeline-state/state-manager';
 *   const mgr = new PipelineStateManager('SCRUM-8');
 *   await mgr.set({ acVerdict: 'AUTOMATE', acScore: 4.2 });
 */

import * as fs   from 'fs';
import * as path from 'path';
import type { PipelineState, TestFramework, AcVerdict } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('state-manager');

const STATE_DIR = path.resolve(process.cwd(), 'qa-framework', 'state');

export class PipelineStateManager {
  private readonly filePath: string;
  private readonly issueKey: string;

  constructor(issueKey: string) {
    this.issueKey = issueKey.toUpperCase();
    this.filePath = path.join(STATE_DIR, `${this.issueKey.toLowerCase()}.state.json`);
  }

  // ---------------------------------------------------------------------------
  // Load / create
  // ---------------------------------------------------------------------------

  loadOrCreate(defaults: { framework: TestFramework; branch: string }): PipelineState {
    if (fs.existsSync(this.filePath)) {
      const raw   = fs.readFileSync(this.filePath, 'utf8');
      const state = JSON.parse(raw) as PipelineState;
      log.info('Loaded existing pipeline state', {
        path:           this.filePath,
        framework:      state.framework,
        branch:         state.branch,
        acVerdict:      state.acVerdict ?? 'pending',
        jiraStatus:     state.jiraStatus ?? 'unknown',
        testsGenerated: state.generatedTestFiles?.length ?? 0,
        prUrl:          state.prUrl ?? 'none',
        updatedAt:      state.updatedAt,
      });
      return state;
    }

    const now: string  = new Date().toISOString();
    const state: PipelineState = {
      issueKey:  this.issueKey,
      framework: defaults.framework,
      branch:    defaults.branch,
      createdAt: now,
      updatedAt: now,
    };

    log.info('Creating new pipeline state', {
      issueKey:  this.issueKey,
      framework: defaults.framework,
      branch:    defaults.branch,
      path:      this.filePath,
    });
    this.write(state);
    return state;
  }

  set(update: Partial<Omit<PipelineState, 'issueKey' | 'createdAt'>>): PipelineState {
    const current = this.read();
    const next: PipelineState = {
      ...current,
      ...update,
      issueKey:  this.issueKey,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.write(next);
    log.info('Pipeline state updated', {
      issueKey:      this.issueKey,
      updatedFields: Object.keys(update),
    });
    return next;
  }

  read(): PipelineState {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`No pipeline state found for ${this.issueKey}. Call loadOrCreate() first.`);
    }
    return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as PipelineState;
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  delete(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
      log.info('Pipeline state deleted', { path: this.filePath });
    }
  }

  // ---------------------------------------------------------------------------
  // Idempotency helpers
  // ---------------------------------------------------------------------------

  acReviewDone(): boolean {
    return this.exists() && this.read().acVerdict !== undefined;
  }

  testGenerationDone(): boolean {
    return this.exists() && (this.read().generatedTestFiles?.length ?? 0) > 0;
  }

  testRunDone(): boolean {
    return this.exists() && this.read().testRunSummary !== undefined;
  }

  prCreated(): boolean {
    return this.exists() && this.read().prUrl !== undefined;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private write(state: PipelineState): void {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  }
}

// ---------------------------------------------------------------------------
// List all active pipeline states
// ---------------------------------------------------------------------------

export function listAllStates(): PipelineState[] {
  if (!fs.existsSync(STATE_DIR)) return [];
  return fs
    .readdirSync(STATE_DIR)
    .filter((f) => f.endsWith('.state.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8')) as PipelineState);
}

// ---------------------------------------------------------------------------
// CLI: node state-manager.js list
// ---------------------------------------------------------------------------

if (process.argv[2] === 'list') {
  const states = listAllStates();
  if (states.length === 0) {
    process.stdout.write('No active pipeline states.\n');
  } else {
    for (const s of states) {
      process.stdout.write(
        `${s.issueKey}  framework=${s.framework}  branch=${s.branch}  ` +
        `acVerdict=${(s.acVerdict as AcVerdict | undefined) ?? 'pending'}  ` +
        `jira=${s.jiraStatus ?? 'unknown'}  updated=${s.updatedAt}\n`
      );
    }
  }
}
