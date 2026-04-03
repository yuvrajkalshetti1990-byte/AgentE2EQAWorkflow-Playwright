import { defineConfig } from 'cypress';
import * as path from 'path';
import * as fs   from 'fs';

// ---------------------------------------------------------------------------
// Required environment variables with safe defaults for demo apps.
// These values are overridden by:
//   1. cypress.env.json  (committed, public defaults)
//   2. CYPRESS_* shell env vars  (CI secrets take precedence at runtime)
// ---------------------------------------------------------------------------
const ENV_DEFAULTS: Record<string, string> = {
  // SauceDemo
  username:       'standard_user',
  password:       'secret_sauce',
  SAUCE_PASSWORD: 'secret_sauce',
  // reqres.in — free-tier key; swap for a paid key via CYPRESS_REQRES_API_KEY secret
  REQRES_API_KEY: 'reqres-free-v1',
};

// Known external base URLs used across spec files.
// Each entry maps a key name to its URL so the pre-flight can warn (not fail)
// if connectivity fails.
const KNOWN_BASE_URLS: Record<string, string> = {
  saucedemo: 'https://www.saucedemo.com',
  reqres:    'https://reqres.in',
  demoqa:    'https://demoqa.com',
  herokuapp: 'https://the-internet.herokuapp.com',
};

// Required fixtures — created automatically if missing.
const REQUIRED_FIXTURES: Record<string, string | object> = {
  'users.json': [
    { username: 'standard_user',  password: 'secret_sauce', expectedStatus: 'success' },
    { username: 'locked_out_user', password: 'secret_sauce', expectedStatus: 'failure' },
    { username: 'problem_user',    password: 'secret_sauce', expectedStatus: 'success' },
  ],
  'test.txt':         'This is a sample text file used for the Cypress file upload assignment.\n',
  'checkout-user.json': {
    firstName: 'Test',
    lastName:  'User',
    zipCode:   '12345',
  },
};

export default defineConfig({
  e2e: {
    // Default base URL for the SCRUM-16 Cypress Learning assignments (SauceDemo).
    // Override with --env or cypress.env.json for other apps.
    baseUrl: 'https://www.saucedemo.com',

    // Exclude .notimplemented stubs from CI runs
    specPattern:        path.join(__dirname, 'cypress/e2e/**/*.cy.ts'),
    excludeSpecPattern: '**/*.notimplemented.cy.ts',

    // Use absolute path so supportFile resolves correctly regardless of CWD
    supportFile:       path.join(__dirname, 'cypress/support/e2e.ts'),
    videosFolder:      path.join(__dirname, 'cypress/videos'),
    screenshotsFolder: path.join(__dirname, 'cypress/screenshots'),

    // Default command timeout — increased from 4 s to 8 s to reduce flakiness on
    // slow CI runners and pages that animate before becoming interactive.
    defaultCommandTimeout: 8000,
    pageLoadTimeout:       30000,
    requestTimeout:        15000,
    responseTimeout:       15000,

    // Retry failed tests once in CI (run mode), zero retries locally.
    retries: { runMode: 1, openMode: 0 },

    // Safe defaults for env vars — overridden by cypress.env.json and CYPRESS_* secrets.
    env: ENV_DEFAULTS,

    // Mochawesome JSON reporter — consumed by post-results-to-jira.yml
    // Stats are written to Cypress/cypress/reports/mochawesome.json
    reporter: 'cypress-mochawesome-reporter',
    reporterOptions: {
      reportDir:    path.join(__dirname, 'cypress/reports'),
      reportFilename: 'mochawesome',
      overwrite:    true,
      html:         true,
      json:         true,
      embeddedScreenshots: false,
      inlineAssets: false,
    },

    setupNodeEvents(on, config) {
      // ── 1. Wire up Mochawesome reporter hooks ────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('cypress-mochawesome-reporter/plugin')(on);

      // ── 2. Merge ENV_DEFAULTS under runtime config (CYPRESS_* vars win) ─
      for (const [key, val] of Object.entries(ENV_DEFAULTS)) {
        if (!config.env[key]) {
          config.env[key] = val;
          console.log(`[preflight] env.${key} not set — using default`);
        }
      }

      // ── 3. Auto-create missing fixture files ─────────────────────────────
      const fixturesDir = path.join(__dirname, 'cypress', 'fixtures');
      fs.mkdirSync(fixturesDir, { recursive: true });
      for (const [filename, content] of Object.entries(REQUIRED_FIXTURES)) {
        const filePath = path.join(fixturesDir, filename);
        if (!fs.existsSync(filePath)) {
          const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          fs.writeFileSync(filePath, body, 'utf8');
          console.log(`[preflight] Created missing fixture: ${filename}`);
        }
      }

      // ── 4. Log base URL reachability warnings (non-blocking) ─────────────
      // We only warn — not block — because CI nodes may not have external access
      // during setup phase.  Tests that hit unreachable URLs are caught at runtime.
      console.log('[preflight] Known external URLs:');
      for (const [name, url] of Object.entries(KNOWN_BASE_URLS)) {
        console.log(`  ${name}: ${url}`);
      }

      // ── 5. Log resolved env key set (values redacted) ────────────────────
      const envKeys = Object.keys(config.env);
      console.log(`[preflight] Resolved env vars (${envKeys.length}): ${envKeys.join(', ')}`);

      // ── 6. Per-spec fixture task ──────────────────────────────────────────
      // Specs that declare  // @requiredFixtures: ['a.json', 'b.json']
      // get missing fixtures auto-created before the spec runs.
      // Called from e2e.ts before() hook via cy.task('ensureFixtures', ...).
      on('task', {
        ensureFixtures({ specFile }: { specFile: string }): null {
          const absSpec = path.isAbsolute(specFile)
            ? specFile
            : path.join(__dirname, specFile);
          if (!fs.existsSync(absSpec)) return null;

          const specContent = fs.readFileSync(absSpec, 'utf-8');
          const match = specContent.match(/@requiredFixtures:\s*(\[[^\]]+\])/);
          if (!match) return null;

          let fixtures: string[];
          try {
            fixtures = JSON.parse(match[1]) as string[];
          } catch {
            return null;
          }

          const fixtureDir = path.join(__dirname, 'cypress', 'fixtures');
          for (const name of fixtures) {
            const fp = path.join(fixtureDir, name);
            if (fs.existsSync(fp)) continue;
            fs.mkdirSync(path.dirname(fp), { recursive: true });
            const knownDefault = REQUIRED_FIXTURES[name];
            if (knownDefault !== undefined) {
              const body = typeof knownDefault === 'string'
                ? knownDefault
                : JSON.stringify(knownDefault, null, 2);
              fs.writeFileSync(fp, body, 'utf8');
            } else if (name.endsWith('.json')) {
              fs.writeFileSync(fp, '{}', 'utf8');
            } else {
              fs.writeFileSync(fp, '', 'utf8');
            }
            console.log(`[ensureFixtures] Created missing fixture: ${name}`);
          }
          return null;
        },
      });

      return config;
    },
  },
});
