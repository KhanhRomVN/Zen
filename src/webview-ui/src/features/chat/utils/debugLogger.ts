/**
 * Debug Logger Utility
 * Centralized logging for debugging re-render and performance issues
 */

export type LogCategory =
  | 'ChatPanel'
  | 'ChatBody'
  | 'MessageBox'
  | 'ResponseParser'
  | 'useScrollBehavior'
  | 'useToolActions'
  | 'useChatLLM'
  | 'ConversationCache'
  | 'Performance';

interface DebugConfig {
  enabled: boolean;
  categories: Set<LogCategory>;
  logPerformance: boolean;
  logRenders: boolean;
}

class DebugLogger {
  private config: DebugConfig = {
    enabled: false,
    categories: new Set(),
    logPerformance: true,
    logRenders: true,
  };

  constructor() {
    // Load config from localStorage
    this.loadConfig();
  }

  private loadConfig() {
    if (typeof window === 'undefined') return;

    try {
      const enabled = localStorage.getItem('zen_debug_enabled') === 'true';
      const categoriesStr = localStorage.getItem('zen_debug_categories');
      const categories = categoriesStr
        ? new Set(JSON.parse(categoriesStr) as LogCategory[])
        : new Set<LogCategory>(['ChatPanel', 'ChatBody', 'ResponseParser', 'Performance']);

      this.config = {
        enabled,
        categories,
        logPerformance: localStorage.getItem('zen_debug_performance') !== 'false',
        logRenders: localStorage.getItem('zen_debug_renders') !== 'false',
      };
    } catch (e) {
      console.error('[DebugLogger] Failed to load config:', e);
    }
  }

  private saveConfig() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('zen_debug_enabled', String(this.config.enabled));
      localStorage.setItem(
        'zen_debug_categories',
        JSON.stringify(Array.from(this.config.categories))
      );
      localStorage.setItem('zen_debug_performance', String(this.config.logPerformance));
      localStorage.setItem('zen_debug_renders', String(this.config.logRenders));
    } catch (e) {
      console.error('[DebugLogger] Failed to save config:', e);
    }
  }

  /**
   * Enable debug logging
   */
  enable(categories?: LogCategory[]) {
    this.config.enabled = true;
    if (categories) {
      this.config.categories = new Set(categories);
    }
    this.saveConfig();
    console.log('[DebugLogger] Debug logging enabled for:', Array.from(this.config.categories));
  }

  /**
   * Disable debug logging
   */
  disable() {
    this.config.enabled = false;
    this.saveConfig();
    console.log('[DebugLogger] Debug logging disabled');
  }

  /**
   * Check if logging is enabled for a category
   */
  isEnabled(category: LogCategory): boolean {
    return this.config.enabled && this.config.categories.has(category);
  }

  /**
   * Log a message
   */
  log(category: LogCategory, message: string, data?: any) {
    if (!this.isEnabled(category)) return;

    const prefix = `[Zen][${category}]`;
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  /**
   * Log a warning
   */
  warn(category: LogCategory, message: string, data?: any) {
    if (!this.isEnabled(category)) return;

    const prefix = `[Zen][${category}]`;
    if (data !== undefined) {
      console.warn(prefix, message, data);
    } else {
      console.warn(prefix, message);
    }
  }

  /**
   * Log performance timing
   */
  time(category: LogCategory, label: string) {
    if (!this.isEnabled(category) || !this.config.logPerformance) return;
    console.time(`[Zen][${category}] ${label}`);
  }

  timeEnd(category: LogCategory, label: string) {
    if (!this.isEnabled(category) || !this.config.logPerformance) return;
    console.timeEnd(`[Zen][${category}] ${label}`);
  }

  /**
   * Log component render
   */
  render(category: LogCategory, componentName: string, props?: any) {
    if (!this.isEnabled(category) || !this.config.logRenders) return;

    const prefix = `[Zen][${category}][Render]`;
    if (props !== undefined) {
      console.log(prefix, componentName, props);
    } else {
      console.log(prefix, componentName);
    }
  }

  /**
   * Get current config
   */
  getConfig(): Readonly<DebugConfig> {
    return { ...this.config };
  }

  /**
   * Enable all categories
   */
  enableAll() {
    this.config.enabled = true;
    this.config.categories = new Set([
      'ChatPanel',
      'ChatBody',
      'MessageBox',
      'ResponseParser',
      'useScrollBehavior',
      'useToolActions',
      'useChatLLM',
      'ConversationCache',
      'Performance',
    ]);
    this.saveConfig();
    console.log('[DebugLogger] All categories enabled');
  }

  /**
   * Show help message
   */
  help() {
    console.log(`
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Zen Debug Logger Help
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available Commands (run in browser console):

  🟢 Enable logging:
     window.zenDebug.enable()              // Enable with default categories
     window.zenDebug.enable(['ChatPanel']) // Enable specific categories
     window.zenDebug.enableAll()           // Enable all categories

  🔴 Disable logging:
     window.zenDebug.disable()

  📋 Available categories:
     - ChatPanel          : Main chat panel component
     - ChatBody           : Chat body and message list
     - MessageBox         : Individual message rendering
     - ResponseParser     : AI response parsing
     - useScrollBehavior  : Auto-scroll behavior
     - useToolActions     : Tool execution logic
     - useChatLLM         : LLM communication
     - ConversationCache  : Conversation caching
     - Performance        : Performance metrics

  ⚙️ Current config:
     window.zenDebug.getConfig()

  ❓ Show this help:
     window.zenDebug.help()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, 'color: #00ff00; font-family: monospace;');
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();

// Expose to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).zenDebug = debugLogger;
}

// Show help on first load if debug is enabled
if (debugLogger.getConfig().enabled) {
  console.log(
    '%c[Zen Debug] Logging is enabled. Type window.zenDebug.help() for commands.',
    'color: #00ff00; font-weight: bold;'
  );
}
