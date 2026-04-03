/**
 * SCRUM-8: E2E Automation — Authentication
 * Valid Login, Invalid Credentials, and Session Handling
 *
 * Jira: https://yuvrajkalshetti1990.atlassian.net/browse/SCRUM-8
 *
 * NOTE: These tests run with storageState (pre-authenticated session) loaded
 * by the config, EXCEPT the tests in the 'no-auth' group which need a fresh
 * unauthenticated context. Those are split into a separate describe block and
 * use a fresh page without storageState.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://opensource-demo.orangehrmlive.com';
const LOGIN_URL = `${BASE_URL}/web/index.php/auth/login`;
const DASHBOARD_URL = `${BASE_URL}/web/index.php/dashboard/index`;

const USERNAME = process.env.ORANGEHRM_USERNAME ?? 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD ?? 'admin123';

// ---------------------------------------------------------------------------
// AC-1: Valid login navigates to dashboard
// These tests use a FRESH context (no storageState) to test login directly
// ---------------------------------------------------------------------------
test.describe('Authentication - Valid Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[AC-1] valid credentials navigate to dashboard', async ({ page }) => {
    await page.goto(LOGIN_URL);

    await page.locator('[name="username"]').fill(USERNAME);
    await page.locator('[name="password"]').fill(PASSWORD);
    await page.locator('[type="submit"]').click();

    await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-2, AC-3, AC-4: Invalid credential permutations
// ---------------------------------------------------------------------------
test.describe('Authentication - Invalid Credentials', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[AC-2] invalid password shows "Invalid credentials" error', async ({ page }) => {
    await page.goto(LOGIN_URL);

    await page.locator('[name="username"]').fill(USERNAME);
    await page.locator('[name="password"]').fill('wrongpassword');
    await page.locator('[type="submit"]').click();

    // Error alert uses .oxd-alert-content-text; allow extra time for demo site latency
    await expect(
      page.locator('.oxd-alert-content-text, .oxd-alert-content p')
    ).toContainText('Invalid credentials', { timeout: 15000 });
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('[AC-3] empty username shows required validation error', async ({ page }) => {
    await page.goto(LOGIN_URL);

    await page.locator('[name="username"]').fill('');
    await page.locator('[name="password"]').fill(PASSWORD);
    await page.locator('[type="submit"]').click();

    const usernameError = page.locator('.oxd-input-group').filter({ hasText: 'Username' }).locator('.oxd-text--span');
    await expect(usernameError).toContainText('Required');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('[AC-4] both fields empty shows two Required errors', async ({ page }) => {
    await page.goto(LOGIN_URL);

    await page.locator('[name="username"]').fill('');
    await page.locator('[name="password"]').fill('');
    await page.locator('[type="submit"]').click();

    const requiredErrors = page.locator('.oxd-text--span').filter({ hasText: 'Required' });
    await expect(requiredErrors).toHaveCount(2);
    await expect(page).toHaveURL(/auth\/login/);
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// AC-5: Cookie clearing redirects to login
// Isolated in its own describe to avoid CSRF state pollution in the serial block
// on Firefox/WebKit. The project storageState provides an authenticated session.
// ---------------------------------------------------------------------------
test.describe('Authentication - Cookie Clearing', () => {
  test('[AC-5] clearing auth cookie redirects to login page', async ({ page, context }) => {
    // Navigate to dashboard; storageState may not apply to all browsers (seed creates Chromium session)
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

    // Login if not authenticated (Firefox/WebKit don't inherit the Chromium storageState)
    if (page.url().includes('auth/login')) {
      await page.locator('[name="username"]').fill(USERNAME);
      await page.locator('[name="password"]').fill(PASSWORD);
      await page.locator('[type="submit"]').click();
      await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });
    }

    // Clear all cookies to simulate session expiry
    await context.clearCookies();

    // Navigate to about:blank first to flush cached state (prevents Firefox from serving
    // a stale cached dashboard before the server-redirect resolves)
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });

    // Navigate to protected page — server must redirect to login
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/auth\/login/, { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// AC-6, AC-7, AC-8: Session Handling (serial)
// Run serially so AC-6 (logout) always executes last and doesn't invalidate
// the shared server session used by AC-7, AC-8
// ---------------------------------------------------------------------------
test.describe.serial('Authentication - Session Handling', () => {
  // Start with an empty context so Chromium-generated storageState cookies don't
  // cause CSRF mismatch when Firefox/WebKit attempts re-login in beforeEach
  test.use({ storageState: { cookies: [], origins: [] } });

  // Self-login before each test — ensures Firefox/WebKit have an active session
  // regardless of whether storageState was applied by the config
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('auth/login')) {
      await page.locator('[name="username"]').fill(USERNAME);
      await page.locator('[name="password"]').fill(PASSWORD);
      await page.locator('[type="submit"]').click();
      await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });
    }
  });

  test('[AC-7] hard refresh preserves authenticated session', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/dashboard\/index/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('[AC-6] after logout navigating to protected page redirects to login', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await expect(page).toHaveURL(/dashboard\/index/, { timeout: 15000 });

    // Logout via dropdown
    await page.locator('.oxd-userdropdown-tab').click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/auth\/(login|logout)/, { timeout: 10000 });

    // After logout navigate directly to the protected page — must redirect to login
    await page.goto(DASHBOARD_URL);
    await expect(page).toHaveURL(/auth\/(login|logout)/, { timeout: 10000 });
  });

  test('[AC-8] session cookie is present after login', async ({ context }) => {
    const cookies = await context.cookies(BASE_URL);
    const sessionCookie = cookies.find(c => c.name === 'orangehrm' || c.httpOnly);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  });
});
