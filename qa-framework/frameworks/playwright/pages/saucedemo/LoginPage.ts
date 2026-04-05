import { Page, expect } from '@playwright/test';

/**
 * SauceDemo Login Page Object
 *
 * Covers: https://www.saucedemo.com (login screen)
 * Selectors sourced from data-test attributes — stable and selector-change-proof.
 */
export class LoginPage {
  readonly usernameInput = '[data-test="username"]';
  readonly passwordInput = '[data-test="password"]';
  readonly loginButton   = '[data-test="login-button"]';
  readonly errorMessage  = '[data-test="error"]';

  constructor(private readonly page: Page) {}

  /** Navigate to the root (uses baseURL from playwright.config.ts). */
  async goto(): Promise<void> {
    await this.page.goto('/');
    console.log('[NAV] url=%s title=%s', this.page.url(), await this.page.title());
  }

  /** Fill credentials and click login — does NOT assert the outcome. */
  async login(username: string, password: string): Promise<void> {
    console.log('[STEP] Logging in as %s', username);
    await this.page.locator(this.usernameInput).fill(username);
    await this.page.locator(this.passwordInput).fill(password);
    await this.page.locator(this.loginButton).click();
  }

  /**
   * Full login flow using env-var credentials with safe fallbacks.
   * Navigates to root → fills credentials → asserts inventory page loaded.
   * Use this in beforeEach for all tests that require an authenticated session.
   */
  async loginWithDefaults(): Promise<void> {
    const username = process.env.SAUCE_USERNAME ?? 'standard_user';
    const password = process.env.SAUCE_PASSWORD ?? 'secret_sauce';
    await this.goto();
    await this.login(username, password);
    console.log('[ASSERT] Expected URL to contain /inventory.html, got: %s', this.page.url());
    await expect(this.page).toHaveURL(/inventory\.html/);
  }
}
