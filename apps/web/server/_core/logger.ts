export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
  requestId?: string;
  userId?: number;
  duration?: number; // ms
}

class Logger {
  private service: string;
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor(service: string) {
    this.service = service;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, service, message, data, error, requestId, userId, duration } = entry;
    const parts = [
      `[${timestamp}]`,
      `[${level.toUpperCase()}]`,
      `[${service}]`,
      message,
    ];

    if (requestId) parts.push(`(req: ${requestId})`);
    if (userId) parts.push(`(user: ${userId})`);
    if (duration) parts.push(`(${duration}ms)`);

    let output = parts.join(' ');

    if (data && Object.keys(data).length > 0) {
      output += '\n' + JSON.stringify(data, null, 2);
    }

    if (error) {
      output += '\n' + error.message;
      if (error.stack && this.isDevelopment) {
        output += '\n' + error.stack;
      }
    }

    return output;
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, error?: Error, requestId?: string, userId?: number, duration?: number) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      data,
      error: error ? { message: error.message, stack: error.stack } : undefined,
      requestId,
      userId,
      duration,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case 'debug':
        if (this.isDevelopment) console.debug(formatted);
        break;
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }

    // TODO: Send to logging service (Sentry, DataDog, etc)
  }

  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, any>) {
    this.log('error', message, data, error);
  }

  // Specialized logging methods
  logRequest(method: string, path: string, statusCode: number, duration: number, requestId?: string, userId?: number) {
    this.log('info', `${method} ${path} ${statusCode}`, undefined, undefined, requestId, userId, duration);
  }

  logDatabaseQuery(query: string, duration: number, data?: Record<string, any>) {
    this.log('debug', `Database query executed in ${duration}ms`, { query, ...data });
  }

  logAudit(action: string, entity: string, entityId: number, userId: number, changes?: Record<string, any>) {
    this.log('info', `[AUDIT] ${action} ${entity} #${entityId} by user ${userId}`, changes);
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: Record<string, any>) {
    this.log('warn', `[SECURITY] ${event} (${severity})`, data);
  }
}

// Create logger instances for different services
export const createLogger = (service: string) => new Logger(service);

export const logger = {
  auth: createLogger('Auth'),
  database: createLogger('Database'),
  api: createLogger('API'),
  security: createLogger('Security'),
  audit: createLogger('Audit'),
  payment: createLogger('Payment'),
  email: createLogger('Email'),
  whatsapp: createLogger('WhatsApp'),
  governance: createLogger('Governance'),
};
