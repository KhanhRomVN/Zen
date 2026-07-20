export interface LogEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error';
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: Set<() => void> = new Set();

  private addLog(level: LogEntry['level'], message: string, ...args: any[]) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: String(message),
      data: args.length > 0 ? args : undefined,
      stack: level === 'error' ? new Error().stack : undefined,
    };

    this.logs.push(entry);
    
    // Giới hạn số lượng logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => listener());

    // Log ra console gốc
    const originalConsole = (window as any).__originalConsole || console;
    const consoleArgs = args.length > 0 ? [message, ...args] : [message];
    originalConsole[level](...consoleArgs);
  }

  log(message: string, ...args: any[]) {
    this.addLog('log', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.addLog('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.addLog('error', message, ...args);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const logger = new Logger();

// Backup console gốc
if (!(window as any).__originalConsole) {
  (window as any).__originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
}

// Override console methods
console.log = logger.log.bind(logger);
console.warn = logger.warn.bind(logger);
console.error = logger.error.bind(logger);
