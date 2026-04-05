import { request } from '@playwright/test';

/**
 * Playwright Global Setup — Runtime Environment Validation              (R1)
 *
 * Runs ONCE before the entire test suite. Fires a real HTTP GET to the
 * resolved baseURL and asserts:
 *   1. The endpoint responds with a 2xx status (environment is reachable).
 *   2. The final URL host matches the expected baseURL host (no silent redirects
 *      to a different environment).
 *
 * Configured via playwright.config.ts: globalSetup: './global-setup.ts'
 *
 * Environment variable overrides:
 *   BASE_URL            → target under test (default: https://www.saucedemo.com)
 *   ENV_CHECK_SKIP=true → bypass this check (emergency escape hatch; CI should NOT set this)
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.ENV_CHECK_SKIP === 'true') {
    console.log('[global-setup] ENV_CHECK_SKIP=true — skipping runtime environment validation.');
    return;
  }

  const baseUrl      = process.env.BASE_URL ?? 'https://www.saucedemo.com';
  const expectedHost = new URL(baseUrl).host;

  console.log(`[global-setup] Validating runtime environment: ${baseUrl}`);

  const context = await request.newContext({ baseURL: baseUrl });
  let response;
  try {
    response = await context.get('/', { timeout: 15_000 });
  } catch (err: unknown) {
    await context.dispose();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[ENV VALIDATION] Cannot reach BASE_URL "${baseUrl}": ${msg}\n` +
      'Ensure the target environment is running and BASE_URL is correct before executing tests.'
    );
  }

  const status    = response.status();
  const actualUrl = response.url();

  await context.dispose();

  // ── 2xx check ─────────────────────────────────────────────────────────────
  if (status < 200 || status >= 400) {
    throw new Error(
      `[ENV VALIDATION] BASE_URL "${baseUrl}" returned HTTP ${status}.\n` +
      'The target environment is unhealthy or unreachable. Aborting test run.'
    );
  }

  // ── Host mismatch (silent redirect) check ─────────────────────────────────
  let actualHost: string;
  try {
    actualHost = new URL(actualUrl).host;
  } catch {
    actualHost = actualUrl;
  }

  if (actualHost !== expectedHost) {
    throw new Error(
      `[ENV MISMATCH] Tests would run on "${actualHost}" but BASE_URL targets "${expectedHost}".\n` +
      `The server at ${baseUrl} redirected to ${actualUrl}.\n` +
      'This may indicate routing to the wrong environment (staging → production). Aborting test run.'
    );
  }

  console.log(`[global-setup] Environment OK — ${baseUrl} (HTTP ${status})`);
}
