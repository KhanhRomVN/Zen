/**
 * Performance Logger với whitelist filtering
 * 
 * Usage:
 * 1. Trong localStorage set: zen_perf_log_whitelist = "useChatLLM,useMessageParsing,chat/index"
 * 2. Hoặc set: zen_perf_log_whitelist = "*" để log tất cả
 * 3. Import: import { perfLog } from '@/utils/logger'
 * 4. Sử dụng: perfLog('useChatLLM', 'Streaming chunk received', { size: chunk.length })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'perf';

interface LogConfig {
  whitelist: string[];
  enabled: boolean;
}

class PerformanceLogger {
  private config: LogConfig;
  private timers: Map<string, number> = new Map();

  constructor() {
    this.config = this.loadConfig();
    
    // Listen for config changes in localStorage
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'zen_perf_log_whitelist' || e.key === 'zen_perf_log_enabled') {
          this.config = this.loadConfig();
          console.log('[PerfLogger] Config reloaded:', this.config);
        }
      });
    }
  }

  private loadConfig(): LogConfig {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { whitelist: [], enabled: false };
    }

    const enabled = window.localStorage.getItem('zen_perf_log_enabled') !== 'false';
    const whitelistStr = window.localStorage.getItem('zen_perf_log_whitelist') || '';
    
    const whitelist = whitelistStr
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return { whitelist, enabled };
  }

  private isWhitelisted(context: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.whitelist.length === 0) return false;
    if (this.config.whitelist.includes('*')) return true;
    
    // Check if context matches any whitelist pattern
    return this.config.whitelist.some(pattern => {
      // Exact match
      if (context === pattern) return true;
      // Prefix match (e.g., "chat/" matches "chat/index", "chat/hooks/...")
      if (context.startsWith(pattern)) return true;
      // Contains match (e.g., "useChatLLM" matches "hooks/llm/useChatLLM")
      if (context.includes(pattern)) return true;
      return false;
    });
  }

  /**
   * Log thông tin performance
   */
  log(context: string, message: string, data?: any, level: LogLevel = 'info') {
    if (!this.isWhitelisted(context)) return;

    const timestamp = new Date().toISOString().split('T')[1];
    const prefix = `[Perf:${context}] ${timestamp}`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      case 'perf':
        console.log(`%c${prefix} ${message}`, 'color: #ff6b6b; font-weight: bold', data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  /**
   * Bắt đầu timer cho performance measurement
   */
  timeStart(context: string, label: string) {
    if (!this.isWhitelisted(context)) return;
    
    const key = `${context}:${label}`;
    this.timers.set(key, performance.now());
    this.log(context, `⏱️  Timer started: ${label}`, undefined, 'perf');
  }

  /**
   * Kết thúc timer và log thời gian
   */
  timeEnd(context: string, label: string, data?: any) {
    if (!this.isWhitelisted(context)) return;
    
    const key = `${context}:${label}`;
    const startTime = this.timers.get(key);
    
    if (startTime === undefined) {
      this.log(context, `⚠️  Timer not found: ${label}`, undefined, 'warn');
      return;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(key);
    
    // Color code based on duration
    const color = duration > 100 ? '#ff0000' : duration > 50 ? '#ff9800' : '#4caf50';
    console.log(
      `%c[Perf:${context}] ⏱️  ${label}: ${duration.toFixed(2)}ms`,
      `color: ${color}; font-weight: bold`,
      data
    );
  }

  /**
   * Log render count (để track re-render spam)
   */
  render(context: string, count: number, deps?: Record<string, any>) {
    if (!this.isWhitelisted(context)) return;
    
    const color = count > 10 ? '#ff0000' : count > 5 ? '#ff9800' : '#2196f3';
    console.log(
      `%c[Perf:${context}] 🔄 Render #${count}`,
      `color: ${color}; font-weight: bold`,
      deps
    );
  }

  /**
   * Log effect execution (để track effect spam)
   */
  effect(context: string, effectName: string, deps?: any[]) {
    if (!this.isWhitelisted(context)) return;
    
    this.log(context, `⚡ Effect: ${effectName}`, { deps }, 'perf');
  }

  /**
   * Log state update (để track state spam)
   */
  state(context: string, stateName: string, oldValue: any, newValue: any) {
    if (!this.isWhitelisted(context)) return;
    
    const isChanged = oldValue !== newValue;
    const prefix = isChanged ? '📝 State changed' : '⚠️  State update (no change)';
    
    this.log(context, `${prefix}: ${stateName}`, {
      old: oldValue,
      new: newValue,
    }, isChanged ? 'info' : 'warn');
  }
}

// Singleton instance
export const perfLogger = new PerformanceLogger();

// Convenience exports
export const perfLog = (context: string, message: string, data?: any) => 
  perfLogger.log(context, message, data, 'info');

export const perfWarn = (context: string, message: string, data?: any) => 
  perfLogger.log(context, message, data, 'warn');

export const perfError = (context: string, message: string, data?: any) => 
  perfLogger.log(context, message, data, 'error');

export const perfTime = {
  start: (context: string, label: string) => perfLogger.timeStart(context, label),
  end: (context: string, label: string, data?: any) => perfLogger.timeEnd(context, label, data),
};

export const perfRender = (context: string, count: number, deps?: Record<string, any>) => 
  perfLogger.render(context, count, deps);

export const perfEffect = (context: string, effectName: string, deps?: any[]) => 
  perfLogger.effect(context, effectName, deps);

export const perfState = (context: string, stateName: string, oldValue: any, newValue: any) => 
  perfLogger.state(context, stateName, oldValue, newValue);

/**
 * HOW TO USE:
 * 
 * 1. Enable logging in console:
 *    localStorage.setItem('zen_perf_log_enabled', 'true');
 *    localStorage.setItem('zen_perf_log_whitelist', '*'); // Log all
 *    // OR
 *    localStorage.setItem('zen_perf_log_whitelist', 'useChatLLM,useMessageParsing'); // Specific contexts
 * 
 * 2. In your code:
 *    import { perfLog, perfTime, perfRender } from '@/utils/logger';
 * 
 *    // Simple log
 *    perfLog('useChatLLM', 'Message sent', { messageId: 'msg-123' });
 * 
 *    // Time measurement
 *    perfTime.start('useMessageParsing', 'parse-messages');
 *    // ... do work ...
 *    perfTime.end('useMessageParsing', 'parse-messages', { count: 50 });
 * 
 *    // Track renders
 *    const renderCount = useRef(0);
 *    renderCount.current++;
 *    perfRender('ChatPanel', renderCount.current, { messagesLen, isProcessing });
 */
