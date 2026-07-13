/**
 * Performance Logger Utility
 * 
 * Lightweight logging system để track:
 * - Function calls và execution time
 * - Re-renders và render count
 * - State updates và dependencies
 * - Performance bottlenecks
 * 
 * Usage:
 * ```ts
 * const log = createLogger('ComponentName');
 * log.render('functionName', { metadata });
 * log.effect('effectName', { deps });
 * log.perf('operationName', startTime, { metadata });
 * ```
 */

interface LogMetadata {
  [key: string]: any;
}

interface PerformanceLogConfig {
  enabled: boolean;
  minDuration: number; // Only log operations slower than this (ms)
  categories: {
    render: boolean;
    effect: boolean;
    perf: boolean;
    state: boolean;
    cache: boolean;
  };
}

// Global config - can be toggled via localStorage
const getConfig = (): PerformanceLogConfig => {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      minDuration: 5,
      categories: {
        render: false,
        effect: false,
        perf: false,
        state: false,
        cache: false,
      },
    };
  }

  const enabled = localStorage.getItem('zen_perf_log') === 'true';
  const minDuration = parseInt(localStorage.getItem('zen_perf_log_min_duration') || '5', 10);

  return {
    enabled,
    minDuration,
    categories: {
      render: localStorage.getItem('zen_perf_log_render') !== 'false',
      effect: localStorage.getItem('zen_perf_log_effect') !== 'false',
      perf: localStorage.getItem('zen_perf_log_perf') !== 'false',
      state: localStorage.getItem('zen_perf_log_state') !== 'false',
      cache: localStorage.getItem('zen_perf_log_cache') !== 'false',
    },
  };
};

// Color codes for different log types
const COLORS = {
  render: '#9333ea', // purple
  effect: '#0ea5e9', // sky blue
  perf: '#f59e0b',   // amber
  state: '#10b981',  // emerald
  cache: '#8b5cf6',  // violet
  warn: '#ef4444',   // red
};

const formatMetadata = (meta?: LogMetadata): string => {
  if (!meta || Object.keys(meta).length === 0) return '';
  
  const pairs = Object.entries(meta)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join(' ');
  
  return ` | ${pairs}`;
};

export class PerformanceLogger {
  private fileName: string;
  private renderCount: number = 0;
  private effectCounts: Map<string, number> = new Map();

  constructor(fileName: string) {
    this.fileName = fileName;
  }

  /**
   * Log component render
   */
  render(functionName: string, meta?: LogMetadata) {
    const config = getConfig();
    if (!config.enabled || !config.categories.render) return;

    this.renderCount++;
    const metaStr = formatMetadata({ ...meta, renderCount: this.renderCount });

    console.log(
      `%c[RENDER] ${this.fileName}.${functionName}${metaStr}`,
      `color: ${COLORS.render}; font-weight: bold;`
    );
  }

  /**
   * Log useEffect execution
   */
  effect(effectName: string, meta?: LogMetadata) {
    const config = getConfig();
    if (!config.enabled || !config.categories.effect) return;

    const count = (this.effectCounts.get(effectName) || 0) + 1;
    this.effectCounts.set(effectName, count);

    const metaStr = formatMetadata({ ...meta, effectCount: count });

    console.log(
      `%c[EFFECT] ${this.fileName}.${effectName}${metaStr}`,
      `color: ${COLORS.effect}; font-weight: bold;`
    );
  }

  /**
   * Log performance timing
   */
  perf(operationName: string, startTime: number, meta?: LogMetadata) {
    const config = getConfig();
    if (!config.enabled || !config.categories.perf) return;

    const duration = performance.now() - startTime;
    
    // Skip if below threshold
    if (duration < config.minDuration) return;

    const metaStr = formatMetadata({ ...meta, duration: `${duration.toFixed(2)}ms` });
    const isWarning = duration > 16; // Frame drop threshold

    console.log(
      `%c[PERF] ${this.fileName}.${operationName}${metaStr}${isWarning ? ' ⚠️ SLOW' : ''}`,
      `color: ${isWarning ? COLORS.warn : COLORS.perf}; font-weight: bold;`
    );
  }

  /**
   * Log state update
   */
  state(stateName: string, meta?: LogMetadata) {
    const config = getConfig();
    if (!config.enabled || !config.categories.state) return;

    const metaStr = formatMetadata(meta);

    console.log(
      `%c[STATE] ${this.fileName}.${stateName}${metaStr}`,
      `color: ${COLORS.state}; font-weight: bold;`
    );
  }

  /**
   * Log cache hit/miss
   */
  cache(operation: string, hit: boolean, meta?: LogMetadata) {
    const config = getConfig();
    if (!config.enabled || !config.categories.cache) return;

    const metaStr = formatMetadata({ ...meta, hit });

    console.log(
      `%c[CACHE] ${this.fileName}.${operation}${metaStr}`,
      `color: ${COLORS.cache}; font-weight: bold;`
    );
  }

  /**
   * Create a performance measurement that returns duration
   */
  measure<T>(operationName: string, fn: () => T, meta?: LogMetadata): T {
    const startTime = performance.now();
    const result = fn();
    this.perf(operationName, startTime, meta);
    return result;
  }

  /**
   * Create an async performance measurement
   */
  async measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    meta?: LogMetadata
  ): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    this.perf(operationName, startTime, meta);
    return result;
  }
}

/**
 * Factory function to create a logger for a specific file
 */
export const createLogger = (fileName: string): PerformanceLogger => {
  return new PerformanceLogger(fileName);
};

/**
 * Helper to enable/disable performance logging
 * Usage in console:
 * ```js
 * localStorage.setItem('zen_perf_log', 'true');
 * localStorage.setItem('zen_perf_log_min_duration', '5'); // Only log ops > 5ms
 * window.location.reload();
 * ```
 */
export const enablePerformanceLogging = (enabled: boolean = true) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('zen_perf_log', enabled ? 'true' : 'false');
    console.log(`Performance logging ${enabled ? 'enabled' : 'disabled'}. Reload to apply.`);
  }
};

/**
 * Helper to configure specific log categories
 */
export const configurePerformanceLogging = (config: Partial<PerformanceLogConfig['categories']>) => {
  if (typeof window !== 'undefined') {
    Object.entries(config).forEach(([key, value]) => {
      localStorage.setItem(`zen_perf_log_${key}`, value ? 'true' : 'false');
    });
    console.log('Performance logging configuration updated. Reload to apply.');
  }
};
