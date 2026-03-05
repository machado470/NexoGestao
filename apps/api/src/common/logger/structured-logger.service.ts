import { Injectable, LoggerService } from '@nestjs/common'

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose'

interface StructuredLog {
  timestamp: string
  level: LogLevel
  context?: string
  message: string
  meta?: Record<string, unknown>
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private formatLog(level: LogLevel, message: any, context?: string, meta?: Record<string, unknown>): string {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      meta,
    }
    return JSON.stringify(log)
  }

  log(message: any, context?: string): void {
    console.log(this.formatLog('log', message, context))
  }

  error(message: any, trace?: string, context?: string): void {
    console.error(this.formatLog('error', message, context, trace ? { trace } : undefined))
  }

  warn(message: any, context?: string): void {
    console.warn(this.formatLog('warn', message, context))
  }

  debug(message: any, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, context))
    }
  }

  verbose(message: any, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatLog('verbose', message, context))
    }
  }

  logWithMeta(level: LogLevel, message: string, meta: Record<string, unknown>, context?: string): void {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      meta,
    }
    const formatted = JSON.stringify(log)
    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      default:
        console.log(formatted)
    }
  }
}
