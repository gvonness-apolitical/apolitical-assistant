/**
 * Centralized Logging Utility
 *
 * Provides structured logging with levels, named loggers, and quiet/verbose support.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(name: string): Logger;
  setLevel(level: LogLevel): void;
}

export interface LoggerOptions {
  /** Minimum log level to output (default: 'info') */
  level?: LogLevel;
  /** Suppress all output (sets level to 'silent') */
  quiet?: boolean;
  /** Enable debug output (sets level to 'debug') */
  verbose?: boolean;
  /** Disable colors in output */
  noColor?: boolean;
  /** Custom output function (default: console methods) */
  output?: {
    log: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

/**
 * Default global log level, can be changed via setDefaultLevel()
 */
let defaultLevel: LogLevel = 'info';

/**
 * Set the default log level for all new loggers
 */
export function setDefaultLevel(level: LogLevel): void {
  defaultLevel = level;
}

/**
 * Get the current default log level
 */
export function getDefaultLevel(): LogLevel {
  return defaultLevel;
}

/**
 * Create a named logger instance
 */
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  let level: LogLevel = options.quiet
    ? 'silent'
    : options.verbose
      ? 'debug'
      : options.level ?? defaultLevel;

  const useColor = !options.noColor && process.stdout.isTTY;
  const output = options.output ?? {
    log: (msg: string) => console.log(msg),
    warn: (msg: string) => console.warn(msg),
    error: (msg: string) => console.error(msg),
  };

  const formatMessage = (
    msgLevel: LogLevel,
    message: string,
    args: unknown[]
  ): string => {
    const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? '';
    const levelStr = msgLevel.toUpperCase().padEnd(5);

    let prefix: string;
    if (useColor) {
      const levelColor =
        msgLevel === 'error'
          ? COLORS.red
          : msgLevel === 'warn'
            ? COLORS.yellow
            : msgLevel === 'debug'
              ? COLORS.gray
              : COLORS.cyan;
      prefix = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}${levelStr}${COLORS.reset} ${COLORS.blue}[${name}]${COLORS.reset}`;
    } else {
      prefix = `${timestamp} ${levelStr} [${name}]`;
    }

    const formattedArgs = args.length > 0 ? ' ' + args.map(formatArg).join(' ') : '';
    return `${prefix} ${message}${formattedArgs}`;
  };

  const formatArg = (arg: unknown): string => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  const shouldLog = (msgLevel: LogLevel): boolean => {
    return LOG_LEVELS[msgLevel] >= LOG_LEVELS[level];
  };

  const logger: Logger = {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog('debug')) {
        output.log(formatMessage('debug', message, args));
      }
    },

    info(message: string, ...args: unknown[]) {
      if (shouldLog('info')) {
        output.log(formatMessage('info', message, args));
      }
    },

    warn(message: string, ...args: unknown[]) {
      if (shouldLog('warn')) {
        output.warn(formatMessage('warn', message, args));
      }
    },

    error(message: string, ...args: unknown[]) {
      if (shouldLog('error')) {
        output.error(formatMessage('error', message, args));
      }
    },

    child(childName: string): Logger {
      return createLogger(`${name}:${childName}`, { ...options, level });
    },

    setLevel(newLevel: LogLevel) {
      level = newLevel;
    },
  };

  return logger;
}

/**
 * Simple log functions for quick usage without creating a logger instance.
 * These respect the default log level.
 */
export const log = {
  debug(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.debug >= LOG_LEVELS[defaultLevel]) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.info >= LOG_LEVELS[defaultLevel]) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.warn >= LOG_LEVELS[defaultLevel]) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.error >= LOG_LEVELS[defaultLevel]) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};
