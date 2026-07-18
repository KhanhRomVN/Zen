/**
 * Performance Check Script
 * 
 * Paste this into the browser console (Webview DevTools) to analyze
 * render performance in real-time
 */

(function() {
  console.log('%c🔍 Performance Monitor Started', 'color: #4CAF50; font-weight: bold; font-size: 14px');
  
  let renderCount = 0;
  let lastRenderTime = Date.now();
  let renderIntervals = [];
  let memoCheckCount = 0;
  
  // Override console.log to track specific patterns
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args[0];
    
    if (typeof message === 'string') {
      // Track ChatPanel renders
      if (message.includes('[DEBUG][ChatPanel] Render')) {
        renderCount++;
        const now = Date.now();
        const interval = now - lastRenderTime;
        lastRenderTime = now;
        renderIntervals.push(interval);
        
        // Keep only last 20 intervals
        if (renderIntervals.length > 20) {
          renderIntervals.shift();
        }
      }
      
      // Track memo checks
      if (message.includes('[DEBUG][MessageBox.memo]')) {
        memoCheckCount++;
      }
    }
    
    originalLog.apply(console, args);
  };
  
  // Report every 10 seconds
  setInterval(() => {
    if (renderCount > 0) {
      const avgInterval = renderIntervals.length > 0 
        ? renderIntervals.reduce((a, b) => a + b, 0) / renderIntervals.length 
        : 0;
      
      const rendersPerMinute = 60000 / avgInterval;
      const memoChecksPerRender = renderCount > 0 ? memoCheckCount / renderCount : 0;
      
      console.log(
        '%c📊 Performance Report',
        'color: #2196F3; font-weight: bold; font-size: 12px',
        '\n' +
        `  Renders: ${renderCount}\n` +
        `  Avg Interval: ${avgInterval.toFixed(0)}ms\n` +
        `  Renders/min: ${rendersPerMinute.toFixed(1)}\n` +
        `  Memo checks/render: ${memoChecksPerRender.toFixed(0)}\n` +
        `  Status: ${rendersPerMinute > 6 ? '⚠️ HIGH (>6/min)' : '✅ GOOD'}`
      );
      
      // Reset counters
      renderCount = 0;
      memoCheckCount = 0;
      renderIntervals = [];
    }
  }, 10000);
  
  console.log('%cMonitoring... Check back in 10 seconds for report', 'color: #9E9E9E');
})();
