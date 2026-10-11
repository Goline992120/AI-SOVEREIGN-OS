/**
 * ============================================================================
 * STRUCTURED LOGGING UTILITY
 * JSON logs for production monitoring
 * ============================================================================
 */

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  constructor(private module: string) {}

  private log(level: string, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      ...(context && { context }),
    };

    if (process.env.JSON_LOGS === 'true') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${level}] [${this.module}] ${message}`, context || '');
    }
  }

  info(message: string, context?: LogContext) {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('WARN', message, context);
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    this.log('ERROR', message, {
      error: error?.message || String(error),
      stack: error?.stack,
      ...context,
    });
  }

  debug(message: string, context?: LogContext) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('DEBUG', message, context);
    }
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}
