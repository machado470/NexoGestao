export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, any>;
}

class ClientLogger {
  private module: string;
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor(module: string) {
    this.module = module;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, module, message, data } = entry;
    const parts = [
      `[${timestamp}]`,
      `[${level.toUpperCase()}]`,
      `[${module}]`,
      message,
    ];

    let output = parts.join(' ');
    if (data && Object.keys(data).length > 0) {
      output += '\n' + JSON.stringify(data, null, 2);
    }

    return output;
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      data,
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

    // Send to backend for centralized logging
    if (level === 'error' || level === 'warn') {
      this.sendToBackend(entry);
    }
  }

  private sendToBackend(entry: LogEntry) {
    // Send to backend logging endpoint
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Silently fail if backend is unavailable
    });
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

  error(message: string, data?: Record<string, any>) {
    this.log('error', message, data);
  }
}

export const logger = {
  auth: new ClientLogger('Auth'),
  api: new ClientLogger('API'),
  ui: new ClientLogger('UI'),
  form: new ClientLogger('Form'),
  navigation: new ClientLogger('Navigation'),
  storage: new ClientLogger('Storage'),
};
