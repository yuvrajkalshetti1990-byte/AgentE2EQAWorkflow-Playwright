/**
 * GitHub REST API v3 client — used by pipeline scripts to create branches,
 * issues, and pull requests without a third-party SDK.
 *
 * Environment variables required:
 *   GITHUB_TOKEN  or  GH_PAT   - GitHub Classic PAT with `repo` scope
 *   GITHUB_REPOSITORY           - "owner/repo" (set automatically in Actions)
 */

import * as https from 'https';
import type { GitHubIssuePayload, GitHubPrPayload } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('github-client');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface GitHubClientConfig {
  token:  string;
  owner:  string;
  repo:   string;
}

function configFromEnv(): GitHubClientConfig {
  const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_PAT'];
  if (!token) throw new Error('GITHUB_TOKEN or GH_PAT environment variable is required');

  const repoEnv = process.env['GITHUB_REPOSITORY'];
  if (!repoEnv) throw new Error('GITHUB_REPOSITORY environment variable is required (format: owner/repo)');

  const [owner, repo] = repoEnv.split('/');
  if (!owner || !repo) throw new Error(`GITHUB_REPOSITORY must be in "owner/repo" format, got: ${repoEnv}`);

  return { token, owner, repo };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function request<T = unknown>(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        Authorization:  `token ${token}`,
        Accept:         'application/vnd.github.v3+json',
        'User-Agent':   'qa-pipeline-bot',
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c: string) => (raw += c));
      res.on('end', () => {
        let data: unknown = raw;
        try { data = JSON.parse(raw); } catch { /* not JSON */ }
        resolve({ status: res.statusCode ?? 0, data: data as T });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// GitHub Client
// ---------------------------------------------------------------------------

export class GitHubClient {
  private readonly token: string;
  private readonly base:  string;

  constructor(cfg: GitHubClientConfig = configFromEnv()) {
    this.token = cfg.token;
    this.base  = `/repos/${cfg.owner}/${cfg.repo}`;
  }

  // ---- Labels ----------------------------------------------------------------

  async ensureLabel(name: string, color: string, description: string): Promise<void> {
    log.debug('Ensuring label exists', { name });
    await request('POST', `${this.base}/labels`, this.token, { name, color, description });
    // 422 means it already exists — that is safe to ignore
  }

  // ---- Issues ----------------------------------------------------------------

  async createIssue(payload: GitHubIssuePayload): Promise<{ number: number; url: string }> {
    log.debug('GitHub API request', { method: 'POST', path: `${this.base}/issues`, title: payload.title });

    const { status, data } = await request<Record<string, unknown>>(
      'POST',
      `${this.base}/issues`,
      this.token,
      payload
    );

    log.debug('GitHub createIssue response', { httpStatus: status });

    if (status !== 201) {
      log.error('GitHub createIssue failed', { status, body: data });
      throw new Error(`GitHub POST /issues returned HTTP ${status}: ${JSON.stringify(data)}`);
    }

    const result = { number: data['number'] as number, url: data['html_url'] as string };
    log.info('GitHub issue created', { number: result.number, url: result.url });
    return result;
  }

  async assignCopilot(issueNumber: number): Promise<void> {
    log.info('Assigning Copilot to issue', { issue: issueNumber });
    // Assigning "Copilot" as a reviewer — 422 if not available is silently ignored
    await request('POST', `${this.base}/issues/${issueNumber}/assignees`, this.token, {
      assignees: ['Copilot'],
    });
  }

  // ---- Branches --------------------------------------------------------------

  async branchExists(branchName: string): Promise<boolean> {
    log.debug('GitHub API request', { method: 'GET', path: `${this.base}/git/refs/heads/${branchName}` });
    const { status } = await request(
      'GET',
      `${this.base}/git/refs/heads/${branchName}`,
      this.token
    );
    const exists = status === 200;
    log.debug('branchExists result', { branchName, exists, httpStatus: status });
    return exists;
  }

  async createBranch(branchName: string, fromRef: string): Promise<void> {
    log.info('Resolving base SHA', { ref: fromRef });

    // Resolve SHA of the base branch
    const { status: refStatus, data: refData } = await request<Record<string, unknown>>(
      'GET',
      `${this.base}/git/refs/heads/${fromRef}`,
      this.token
    );

    if (refStatus !== 200) {
      log.error('Could not resolve base ref', { fromRef, httpStatus: refStatus });
      throw new Error(`Could not resolve ref ${fromRef}: HTTP ${refStatus}`);
    }

    const sha = ((refData as Record<string, unknown>)['object'] as Record<string, string>)['sha'];
    log.info('Creating branch', { branchName, fromRef, sha });

    const { status } = await request('POST', `${this.base}/git/refs`, this.token, {
      ref: `refs/heads/${branchName}`,
      sha,
    });

    if (status !== 201) {
      log.error('createBranch failed', { branchName, httpStatus: status });
      throw new Error(`Could not create branch ${branchName}: HTTP ${status}`);
    }
    log.info('Branch created', { branchName, sha });
  }

  // ---- Pull Requests ---------------------------------------------------------

  async prExists(head: string, base: string): Promise<number | null> {
    const { data } = await request<unknown[]>(
      'GET',
      `${this.base}/pulls?head=${head}&base=${base}&state=open`,
      this.token
    );
    const prs = data as Array<Record<string, unknown>>;
    return prs.length > 0 ? (prs[0]['number'] as number) : null;
  }

  async createPr(payload: GitHubPrPayload): Promise<{ number: number; url: string }> {
    log.debug('GitHub API request', { method: 'POST', path: `${this.base}/pulls`, head: payload.head, base: payload.base });

    const { status, data } = await request<Record<string, unknown>>(
      'POST',
      `${this.base}/pulls`,
      this.token,
      {
        title:  payload.title,
        body:   payload.body,
        head:   payload.head,
        base:   payload.base,
        labels: payload.labels ?? [],
      }
    );

    log.debug('GitHub createPr response', { httpStatus: status });

    if (status !== 201) {
      log.error('GitHub createPr failed', { status, body: data });
      throw new Error(`GitHub POST /pulls returned HTTP ${status}: ${JSON.stringify(data)}`);
    }

    const result = { number: data['number'] as number, url: data['html_url'] as string };
    log.info('PR created', { number: result.number, url: result.url, head: payload.head, base: payload.base });
    return result;
  }

  // ---- Workflow Dispatch ------------------------------------------------------

  async dispatchWorkflow(workflowFile: string, ref: string, inputs?: Record<string, string>): Promise<void> {
    log.debug('GitHub API request', { method: 'POST', path: `${this.base}/actions/workflows/${workflowFile}/dispatches`, ref });

    const { status, data } = await request(
      'POST',
      `${this.base}/actions/workflows/${workflowFile}/dispatches`,
      this.token,
      { ref, inputs: inputs ?? {} }
    );

    if (status !== 204) {
      log.error('Workflow dispatch failed', { workflowFile, ref, httpStatus: status, body: data });
      throw new Error(
        `Workflow dispatch for ${workflowFile} returned HTTP ${status}: ${JSON.stringify(data)}`
      );
    }
    log.info('Workflow dispatched', { workflowFile, ref, httpStatus: status });
  }
}
