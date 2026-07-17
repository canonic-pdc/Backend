import { config } from '@config/index';

export interface ILogger {
  info(message: string, ...meta: any[]): void;
  error(message: string | Error, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  debug(message: string, ...meta: any[]): void;
}

class Logger implements ILogger {
  private level: string;

  constructor() {
    this.level = config.logging.level;
  }

  private shouldLog(level: string): boolean {
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.level] !== undefined ? levels[this.level] : 1;
    const messageLevel = levels[level] !== undefined ? levels[level] : 1;
    return messageLevel >= configLevel;
  }

  public info(message: string, ...meta: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...meta);
    }
  }

  public error(message: string | Error, ...meta: any[]): void {
    if (this.shouldLog('error')) {
      const errorMsg = message instanceof Error ? message.stack || message.message : message;
      console.error(`[ERROR] ${new Date().toISOString()}: ${errorMsg}`, ...meta);
    }
  }

  public warn(message: string, ...meta: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...meta);
    }
  }

  public debug(message: string, ...meta: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...meta);
    }
  }
}

export const logger: ILogger = new Logger();
export default logger;
