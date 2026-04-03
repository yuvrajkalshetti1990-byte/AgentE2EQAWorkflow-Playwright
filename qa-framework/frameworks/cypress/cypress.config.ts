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
// Add new fixture defaults here when the generator creates specs that use them.
const REQUIRED_FIXTURES: Record<string, string | object> = {
  'users.json': [
    { username: 'standard_user',         password: 'secret_sauce', expectedStatus: 'success' },
    { username: 'locked_out_user',        password: 'secret_sauce', expectedStatus: 'failure' },
    { username: 'problem_user',           password: 'secret_sauce', expectedStatus: 'success' },
    { username: 'performance_glitch_user',password: 'secret_sauce', expectedStatus: 'success' },
  ],
  'test.txt': 'This is a sample text file used for the Cypress file upload assignment.\n',
  'checkout-user.json': {
    firstName:  'Test',
    lastName:   'User',
    postalCode: '12345',
  },
  'example.json': { example: true },
};

export default defineConfig({
  e2e: {
    // Default base URL for the SCRUM-16 Cypress Learning assignments (SauceDemo).
    // Override with --env or cypress.env.json for other apps.
    baseUrl: 'https://www.saucedemo.com',

    // Exclude .notimplemented stubs from CI runs
    specPattern:        path.join(__dirname, 'tests/**/*.cy.ts'),
    excludeSpecPattern: '**/*.notimplemented.cy.ts',

    // Use absolute path so supportFile resolves correctly regardless of CWD
    supportFile:       path.join(__dirname, 'support/e2e.ts'),
    videosFolder:      path.join(__dirname, 'videos'),
    screenshotsFolder: path.join(__dirname, 'screenshots'),

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

    // Built-in Mocha JSON reporter — no extra package needed.
    // Outputs Cypress/cypress/reports/results.json which post-results-to-jira.yml
    // Mochawesome reporter — outputs both results.json (consumed by
    // post-results-to-jira.yml via stats.passes/failures/pending) and
    // results.html (human-readable report uploaded as a CI artifact).
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir:           path.join(__dirname, 'reports'),
      reportFilename:      'results',
      overwrite:           true,
      html:                true,
      json:                true,
      charts:              true,
      embeddedScreenshots: true,
      inlineAssets:        true,
    },

    setupNodeEvents(on, config) {
      // ── 1. Ensure reports and fixtures directories exist ─────────────────
      fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
      const fixturesDir = path.join(__dirname, 'fixtures');
      fs.mkdirSync(fixturesDir, { recursive: true });

      // ── 2. Merge ENV_DEFAULTS under runtime config (CYPRESS_* vars win) ─
      for (const [key, val] of Object.entries(ENV_DEFAULTS)) {
        if (!config.env[key]) {
          config.env[key] = val;
        }
      }

      // ── 3. Global upfront fixture creation ───────────────────────────────
      // Phase A: always create the known REQUIRED_FIXTURES defaults.
      for (const [filename, content] of Object.entries(REQUIRED_FIXTURES)) {
        const fp = path.join(fixturesDir, filename);
        if (!fs.existsSync(fp)) {
          const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          fs.writeFileSync(fp, body, 'utf8');
          console.log(`[preflight] Created missing fixture: ${filename}`);
        }
      }

      // Phase B: scan ALL spec files for @requiredFixtures metadata and
      //          create anything declared there that wasn't in REQUIRED_FIXTURES.
      function scanSpecsForFixtures(dir: string): void {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanSpecsForFixtures(full); continue; }
          if (!entry.name.endsWith('.ts')) continue;
          const content = fs.readFileSync(full, 'utf-8');
          const m = content.match(/@requiredFixtures:\s*(\[[^\]]+\])/);
          if (!m) continue;
          let names: string[];
          try { names = JSON.parse(m[1]) as string[]; } catch { continue; }
          for (const name of names) {
            const fp2 = path.join(fixturesDir, name);
            if (fs.existsSync(fp2)) continue;
            fs.mkdirSync(path.dirname(fp2), { recursive: true });
            const def = REQUIRED_FIXTURES[name];
            if (def !== undefined) {
              fs.writeFileSync(fp2, typeof def === 'string' ? def : JSON.stringify(def, null, 2), 'utf8');
            } else if (name.endsWith('.json')) {
              fs.writeFileSync(fp2, '{}', 'utf8');
            } else {
              fs.writeFileSync(fp2, '', 'utf8');
            }
            console.log(`[preflight] Created @requiredFixtures fixture: ${name} (from ${entry.name})`);
          }
        }
      }
      scanSpecsForFixtures(path.join(__dirname, 'tests'));

      // ── 4. Log resolved env key set ──────────────────────────────────────
      const envKeys = Object.keys(config.env);
      console.log(`[preflight] Resolved env vars (${envKeys.length}): ${envKeys.join(', ')}`);
      console.log(`[preflight] Fixtures dir: ${fixturesDir}`);
      console.log(`[preflight] Fixture files: ${fs.readdirSync(fixturesDir).join(', ')}`);

      // ── 5. Per-spec fixture task ──────────────────────────────────────────
      // Secondary safety net: called by e2e.ts before() for each spec so
      // fixtures declared in @requiredFixtures are guaranteed to exist even
      // if the global scan somehow missed them (e.g. dynamic imports).
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
          try { fixtures = JSON.parse(match[1]) as string[]; } catch { return null; }

          for (const name of fixtures) {
            const fp = path.join(fixturesDir, name);
            if (fs.existsSync(fp)) continue;
            fs.mkdirSync(path.dirname(fp), { recursive: true });
            const def = REQUIRED_FIXTURES[name];
            if (def !== undefined) {
              fs.writeFileSync(fp, typeof def === 'string' ? def : JSON.stringify(def, null, 2), 'utf8');
            } else if (name.endsWith('.json')) {
              fs.writeFileSync(fp, '{}', 'utf8');
            } else {
              fs.writeFileSync(fp, '', 'utf8');
            }
            console.log(`[ensureFixtures] Created: ${name}`);
          }
          return null;
        },
      });

      return config;
    },
  },
});
