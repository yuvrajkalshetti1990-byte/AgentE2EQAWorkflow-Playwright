import * as util from 'util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg:  string, meta?: Record<string, unknown>): void;
  warn(msg:  string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function write(level: LogLevel, namespace: string, msg: string, meta?: Record<string, unknown>): void {
  const ts     = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${namespace}]`;
  const line   = meta ? `${prefix} ${msg} ${util.inspect(meta, { depth: 3, colors: false })}` : `${prefix} ${msg}`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export function createLogger(namespace: string): Logger {
  return {
    debug: (msg, meta) => write('debug', namespace, msg, meta),
    info:  (msg, meta) => write('info',  namespace, msg, meta),
    warn:  (msg, meta) => write('warn',  namespace, msg, meta),
    error: (msg, meta) => write('error', namespace, msg, meta),
  };
}
