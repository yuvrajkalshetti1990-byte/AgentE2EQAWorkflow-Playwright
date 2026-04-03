/**
 * Jira REST API v3 client.
 *
 * All credentials are consumed from environment variables:
 *   ATLASSIAN_EMAIL     - Jira account email
 *   ATLASSIAN_TOKEN     - Atlassian API token (not a PAT — generated at id.atlassian.com)
 *   ATLASSIAN_CLOUD_ID  - Cloud instance ID (from Atlassian admin)
 *
 * No third-party dependencies — uses Node.js built-in `https`.
 */

import * as https from 'https';
import type { JiraIssue, JiraAdfDocument, JiraTransition, JIRA_TRANSITION_IDS } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('jira-client');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface JiraClientConfig {
  cloudId:   string;
  email:     string;
  token:     string;
  /** Optional override base URL (defaults to api.atlassian.com/ex/jira/{cloudId}) */
  baseUrl?:  string;
}

function configFromEnv(): JiraClientConfig {
  const cloudId = process.env['ATLASSIAN_CLOUD_ID'];
  const email   = process.env['ATLASSIAN_EMAIL'];
  const token   = process.env['ATLASSIAN_TOKEN'];

  if (!cloudId) throw new Error('ATLASSIAN_CLOUD_ID environment variable is required');
  if (!email)   throw new Error('ATLASSIAN_EMAIL environment variable is required');
  if (!token)   throw new Error('ATLASSIAN_TOKEN environment variable is required');

  return { cloudId, email, token };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function basicAuth(email: string, token: string): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

function request(
  method: 'GET' | 'POST',
  url: string,
  auth: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        Authorization:  auth,
        Accept:         'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c: string) => (raw += c));
      res.on('end', () => {
        let data: unknown = raw;
        try { data = JSON.parse(raw); } catch { /* not JSON */ }
        resolve({ status: res.statusCode ?? 0, data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Jira Client
// ---------------------------------------------------------------------------

export class JiraClient {
  private readonly auth:    string;
  private readonly apiBase: string;

  constructor(cfg: JiraClientConfig = configFromEnv()) {
    this.auth    = basicAuth(cfg.email, cfg.token);
    this.apiBase = cfg.baseUrl
      ?? `https://api.atlassian.com/ex/jira/${cfg.cloudId}/rest/api/3`;
  }

  // ---- Issues ----------------------------------------------------------------

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const url = `${this.apiBase}/issue/${issueKey}?fields=summary,description,status,labels`;
    log.debug('Jira API request', { method: 'GET', url: url.replace(/https:\/\/[^/]+/, '<host>') });

    const { status, data } = await request('GET', url, this.auth);

    log.debug('Jira API response', {
      issueKey,
      httpStatus: status,
      summary:    (data as Record<string, unknown>)?.['fields'] ? ((data as Record<string,unknown>)['fields'] as Record<string,unknown>)['summary'] : undefined,
    });

    if (status !== 200) {
      log.error('Jira getIssue failed', { issueKey, status, body: data });
      throw new Error(`Jira GET /issue/${issueKey} returned HTTP ${status}: ${JSON.stringify(data)}`);
    }

    log.info('Fetched Jira issue', { issueKey, status });

    const d = data as Record<string, unknown>;
    const fields = d['fields'] as Record<string, unknown>;

    const description = extractAdfText(fields['description'] as AdfNodeish | null);
    const acs         = extractAcceptanceCriteria(description);

    return {
      key:                 issueKey,
      summary:             (fields['summary'] as string) ?? '',
      description,
      status:              ((fields['status'] as Record<string, unknown>)?.['name'] as string) ?? '',
      labels:              (fields['labels'] as string[]) ?? [],
      acceptanceCriteria:  acs,
    };
  }

  // ---- Comments --------------------------------------------------------------

  async addComment(issueKey: string, document: JiraAdfDocument): Promise<void> {
    log.debug('Jira API request', { method: 'POST', path: `/issue/${issueKey}/comment` });

    const { status, data } = await request(
      'POST',
      `${this.apiBase}/issue/${issueKey}/comment`,
      this.auth,
      { body: document }
    );

    log.debug('Jira addComment response', { issueKey, httpStatus: status });

    if (status !== 201) {
      log.error('Jira addComment failed', { issueKey, status, body: data });
      throw new Error(`Jira POST comment on ${issueKey} returned HTTP ${status}: ${JSON.stringify(data)}`);
    }
    log.info('Jira comment posted', { issueKey });
  }

  async addTextComment(issueKey: string, text: string): Promise<void> {
    await this.addComment(issueKey, buildTextDocument(text));
  }

  // ---- Transitions -----------------------------------------------------------

  /**
   * Transition a Jira issue to a new status.
   * @param issueKey  e.g. "SCRUM-8"
   * @param transitionId  Numeric transition ID string (see JIRA_TRANSITION_IDS in types)
   */
  async transition(issueKey: string, transitionId: string): Promise<void> {
    log.debug('Jira API request', { method: 'POST', path: `/issue/${issueKey}/transitions`, transitionId });

    const { status, data } = await request(
      'POST',
      `${this.apiBase}/issue/${issueKey}/transitions`,
      this.auth,
      { transition: { id: transitionId } }
    );

    if (status === 204) {
      log.info('Jira transition successful', { issueKey, transitionId, httpStatus: status });
    } else if (status === 400 || status === 409) {
      log.warn('Jira transition skipped — issue already in target state', { issueKey, transitionId, httpStatus: status, body: data });
    } else {
      log.warn('Jira transition returned unexpected status', { issueKey, transitionId, httpStatus: status, body: data });
    }
  }
}

// ---------------------------------------------------------------------------
// ADF helpers
// ---------------------------------------------------------------------------

type AdfNodeish = { type?: string; text?: string; content?: AdfNodeish[] } | null;

function extractAdfText(node: AdfNodeish): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text ?? '';
  if (Array.isArray(node.content)) {
    return node.content.map(extractAdfText).join('');
  }
  return '';
}

function extractAcceptanceCriteria(description: string): string[] {
  const lines = description.split('\n');
  const acs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match patterns: "AC-1:", "AC1:", "Given/When/Then", "- AC", numbered list items
    if (
      /^ac[- ]?\d+:/i.test(trimmed) ||
      /^(given|when|then)\b/i.test(trimmed) ||
      /^\d+\.\s/.test(trimmed) ||
      /^[-*]\s/.test(trimmed)
    ) {
      acs.push(trimmed.replace(/^[-*]\s/, '').trim());
    }
  }

  // Fall back to entire description if no structured ACs found
  return acs.length > 0 ? acs : [description.trim()];
}

export function buildTextDocument(text: string): JiraAdfDocument {
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

export function buildHeadingDocument(
  heading: string,
  paragraphs: string[]
): JiraAdfDocument {
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: heading }],
      },
      ...paragraphs.map((p) => ({
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text: p }],
      })),
    ],
  };
}

export function buildResultDocument(params: {
  icon:       string;
  workflow:   string;
  resultText: string;
  countLine:  string;
  branch:     string;
  commitSha:  string;
  runUrl:     string;
}): JiraAdfDocument {
  const { icon, workflow, resultText, countLine, branch, commitSha, runUrl } = params;

  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `CI Test Result: ${icon}  |  ${workflow}`,
            marks: [{ type: 'strong' }],
          },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: resultText }] },
      { type: 'paragraph', content: [{ type: 'text', text: countLine  }] },
      {
        type: 'bulletList',
        content: [
          bullet(`Branch: ${branch}`),
          bullet(`Commit: ${commitSha.slice(0, 7)}`),
          bullet(`Run: ${runUrl}`),
        ],
      },
    ],
  };
}

function bullet(text: string) {
  return {
    type: 'listItem',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text }] },
    ],
  };
}
