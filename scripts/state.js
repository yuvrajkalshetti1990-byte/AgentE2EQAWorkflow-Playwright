'use strict';
/**
 * Pipeline State CLI — plain CommonJS, no transpilation or npm install required.
 *
 * State files live at: qa-framework/state/<issue-key-lower>.state.json
 * They are committed to the feature branch by jira-ready-for-qa.yml so that
 * re-runs can skip already-completed work (AC review caching, issue dedup, etc.)
 *
 * Commands:
 *   node scripts/state.js init  <issue-key> <framework> <branch>  — create state if not exists
 *   node scripts/state.js get   <issue-key>                        — print full state JSON
 *   node scripts/state.js set   <issue-key> <field> <value>        — set a field (persists to disk)
 *   node scripts/state.js check <issue-key> <field>                — exit 0 if field is set, 1 if not
 *   node scripts/state.js list                                     — list all active states
 */

const fs   = require('fs');
const path = require('path');

const STATE_DIR = path.resolve(process.cwd(), 'qa-framework', 'state');

function filePath(issueKey) {
  return path.join(STATE_DIR, issueKey.toLowerCase() + '.state.json');
}

function load(issueKey) {
  const f = filePath(issueKey);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error('State parse error for ' + issueKey + ':', e.message); return null; }
}

function write(issueKey, state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath(issueKey), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/** Coerce string values to their correct JS types before persisting. */
function coerce(value) {
  if (value === 'true')  return true;
  if (value === 'false') return false;
  const n = Number(value);
  if (!isNaN(n) && value.trim() !== '') return n;
  return value;
}

//---------------------------------------------------------------------------
// Sub-commands
//---------------------------------------------------------------------------

const [,, cmd, issueKey, ...rest] = process.argv;

switch (cmd) {

  case 'init': {
    if (!issueKey) { console.error('Usage: node scripts/state.js init <issue-key> [framework] [branch]'); process.exit(1); }
    const [framework, branch] = rest;
    let state = load(issueKey);
    if (state) {
      console.log('State already exists for ' + issueKey.toUpperCase() + ' — skipping init (idempotent)');
      console.log(JSON.stringify(state, null, 2));
    } else {
      const now = new Date().toISOString();
      state = {
        issueKey:  issueKey.toUpperCase(),
        framework: framework || 'playwright',
        branch:    branch    || '',
        createdAt: now,
        updatedAt: now,
      };
      write(issueKey, state);
      console.log('State initialized for ' + issueKey.toUpperCase());
      console.log(JSON.stringify(state, null, 2));
    }
    break;
  }

  case 'get': {
    if (!issueKey) { console.error('Usage: node scripts/state.js get <issue-key>'); process.exit(1); }
    const s = load(issueKey);
    console.log(s ? JSON.stringify(s, null, 2) : '{}');
    break;
  }

  case 'set': {
    if (!issueKey || rest.length < 2) {
      console.error('Usage: node scripts/state.js set <issue-key> <field> <value>');
      process.exit(1);
    }
    const [field, value] = rest;
    let state = load(issueKey);
    if (!state) {
      const now = new Date().toISOString();
      state = { issueKey: issueKey.toUpperCase(), createdAt: now };
    }
    state[field] = coerce(value);
    write(issueKey, state);
    console.log('State set: ' + issueKey.toUpperCase() + '.' + field + ' = ' + JSON.stringify(state[field]));
    break;
  }

  case 'check': {
    if (!issueKey || rest.length < 1) {
      console.error('Usage: node scripts/state.js check <issue-key> <field>');
      process.exit(1);
    }
    const [field] = rest;
    const s = load(issueKey);
    const val = s && s[field];
    if (val !== undefined && val !== null && val !== false && val !== '') {
      console.log('FIELD_SET: ' + field + ' = ' + JSON.stringify(val));
      process.exit(0);
    }
    console.log('FIELD_NOT_SET: ' + field + ' (issue=' + issueKey.toUpperCase() + ', stateExists=' + (s !== null) + ')');
    process.exit(1);
    break; // unreachable — satisfies linters
  }

  case 'list': {
    if (!fs.existsSync(STATE_DIR)) { console.log('No active pipeline states (state dir not found).'); break; }
    const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.state.json'));
    if (!files.length) { console.log('No active pipeline states.'); break; }
    files.forEach(f => {
      const s = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
      console.log(
        s.issueKey + '  fw=' + s.framework + '  branch=' + s.branch +
        '  acVerdict=' + (s.acVerdict || 'pending') +
        '  jiraStatus=' + (s.jiraStatus || 'unknown') +
        '  updated=' + s.updatedAt
      );
    });
    break;
  }

  default:
    console.error('Unknown command: ' + (cmd || '<none>'));
    console.error('Usage: node scripts/state.js <init|get|set|check|list> <issue-key> [args...]');
    process.exit(1);
}
