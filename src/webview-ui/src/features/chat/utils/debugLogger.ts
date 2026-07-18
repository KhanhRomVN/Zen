/**
 * Debug Logger Utility
 * 
 * Centralized debug logging for performance monitoring.
 * Enable/disable via localStorage:
 * 
 * localStorage.setItem('zen_debug_chat', 'true')  // Enable all chat debug logs
 * localStorage.setItem('zen_debug_parser', 'true') // Enable parser logs only
 * localStorage.setItem('zen_debug_scroll', 'true') // Enable scroll logs only
 * localStorage.setItem('zen_debug_render', 'true') // Enable render logs only
 */

type LogLevel = 'log' | 'warn' | 'error';
type DebugCategory = 'chat' | 'parser' | 'scroll' | 'render' | 'all';

const DEBUG_FLAGS = {
  chat: typeof window !== 'undefined' && window.localStorage?.getItem('zen_debug_chat') === 'true',
  parser: typeof window !== 'undefined' && window.localStorage?.getItem('zen_debug_parser') === 'true',
  scroll: typeof window !== 'undefined' && window.localStorage?.getItem('zen_debug_scroll') === 'true',
  render: typeof window !== 'undefined' && window.localStorage?.getItem('zen_debug_render') === 'true',
  all: typeof window !== 'undefined' && window.localStorage?.getItem('zen_debug_all') === 'true',
};

export const debugLog = (
  category: DebugCategory,
  level: LogLevel,
  component: string,
  message: string,
  data?: any
) => {
  // Check if this category is enabled
  if (!DEBUG_FLAGS[category] && !DEBUG_FLAGS.all) {
    return;
  }

  const prefix = `[DEBUG][${category}][${component}]`;
  const fullMessage = `${prefix} ${message}`;

  if (data !== undefined) {
    console[level](fullMessage, data);
  } else {
    console[level](fullMessage);
  }
};

// Convenience wrappers
export const chatLog = (component: string, message: string, data?: any) => 
  debugLog('chat', 'log', component, message, data);

export const parserLog = (component: string, message: string, data?: any) => 
  debugLog('parser', 'log', component, message, data);

export const scrollLog = (component: string, message: string, data?: any) => 
  debugLog('scroll', 'log', component, message, data);

export const renderLog = (component: string, message: string, data?: any) => 
  debugLog('render', 'log', component, message, data);

// Warning helpers
export const chatWarn = (component: string, message: string, data?: any) => 
  debugLog('chat', 'warn', component, message, data);

export const parserWarn = (component: string, message: string, data?: any) => 
  debugLog('parser', 'warn', component, message, data);

/**
 * Print current debug flags status
 */
export const printDebugStatus = () => {
  console.log('[DEBUG] Current debug flags:', DEBUG_FLAGS);
  console.log('[DEBUG] To enable debug logs, use:');
  console.log('  localStorage.setItem("zen_debug_chat", "true")');
  console.log('  localStorage.setItem("zen_debug_parser", "true")');
  console.log('  localStorage.setItem("zen_debug_scroll", "true")');
  console.log('  localStorage.setItem("zen_debug_render", "true")');
  console.log('  localStorage.setItem("zen_debug_all", "true")  // Enable all');
};

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).zenDebug = {
    enable: (category: DebugCategory) => {
      if (category === 'all') {
        localStorage.setItem('zen_debug_all', 'true');
      } else {
        localStorage.setItem(`zen_debug_${category}`, 'true');
      }
      console.log(`[DEBUG] Enabled ${category} logs. Reload the page to take effect.`);
    },
    disable: (category: DebugCategory) => {
      if (category === 'all') {
        localStorage.removeItem('zen_debug_all');
      } else {
        localStorage.removeItem(`zen_debug_${category}`);
      }
      console.log(`[DEBUG] Disabled ${category} logs. Reload the page to take effect.`);
    },
    status: printDebugStatus,
  };
}
