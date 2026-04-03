/**
 * Structured logger for the QA pipeline.
 * Writes to stdout with ISO timestamps and log levels.
 * Zero external dependencies — uses only Node.js built-ins.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

let minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function emit(level: LogLevel, component: string, message: string, meta?: unknown): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const entry: Record<string, unknown> = {
    ts:        new Date().toISOString(),
    level:     level.toUpperCase(),
    component,
    message,
  };

  if (meta !== undefined) {
    entry['meta'] = meta;
  }

  const line = JSON.stringify(entry);

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export function createLogger(component: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit('debug', component, msg, meta),
    info:  (msg: string, meta?: unknown) => emit('info',  component, msg, meta),
    warn:  (msg: string, meta?: unknown) => emit('warn',  component, msg, meta),
    error: (msg: string, meta?: unknown) => emit('error', component, msg, meta),
  };
}

/** Convenience root logger — use createLogger(name) for component-scoped instances */
export const logger = createLogger('pipeline');
