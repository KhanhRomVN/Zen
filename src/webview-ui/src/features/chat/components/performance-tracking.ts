/**
 * Performance Tracking for Chat Components
 * 
 * This file enables Why Did You Render tracking for all chat-related components
 * that are suspected to cause performance issues.
 * 
 * Import this file in your main entry point (index.tsx) to enable tracking:
 * import './features/chat/components/performance-tracking';
 */

console.log('%c[Performance Tracking] Enabling WDYR for chat components...', 'color: #FFA500; font-weight: bold');

// Track which components have been marked
const trackedComponents: string[] = [];

/**
 * Helper to track a component with error handling
 */
const trackComponent = async (
  importFn: () => Promise<any>,
  componentName: string,
  exportName: string = 'default'
) => {
  try {
    const module = await importFn();
    const component = exportName === 'default' ? module.default : module[exportName];
    
    if (component) {
      (component as any).whyDidYouRender = true;
      if (!component.displayName) {
        component.displayName = componentName;
      }
      trackedComponents.push(componentName);
    }
  } catch (error) {
    console.warn(`[Performance Tracking] Failed to track ${componentName}:`, error);
  }
};

// Priority 1: Message Components (HIGHEST IMPACT)
Promise.all([
  trackComponent(
    () => import('./messages/MessageBox'),
    'MessageBox'
  ),
  trackComponent(
    () => import('./messages/AIMessageBox'),
    'AIMessageBox',
    'default'
  ),
  trackComponent(
    () => import('./messages/UserMessageBox'),
    'UserMessageBox'
  ),
  trackComponent(
    () => import('./messages/ProcessingIndicator'),
    'ProcessingIndicator'
  ),
]).then(() => {
  console.log('%c[Performance Tracking] Message components tracked:', 'color: #89d185', trackedComponents.filter(c => c.includes('Message') || c.includes('Processing')));
});

// Priority 2: Block Components (HIGH IMPACT)
Promise.all([
  trackComponent(
    () => import('./blocks/markdown/MarkdownBlock'),
    'MarkdownBlock',
    'MarkdownBlock'
  ),
  trackComponent(
    () => import('./blocks/code/CodeBlock'),
    'CodeBlock',
    'CodeBlock'
  ),
  trackComponent(
    () => import('./blocks/thinking/ThinkingBlock'),
    'ThinkingRenderer',
    'ThinkingRenderer'
  ),
  trackComponent(
    () => import('./blocks/question/QuestionBlock'),
    'QuestionBlock',
    'QuestionBlock'
  ),
]).then(() => {
  console.log('%c[Performance Tracking] Block components tracked:', 'color: #89d185', trackedComponents.filter(c => c.includes('Block') || c.includes('Renderer')));
});

// Priority 3: Chat Container Components
Promise.all([
  trackComponent(
    () => import('./ChatBody'),
    'ChatBody'
  ),
  trackComponent(
    () => import('./ChatHeader'),
    'ChatHeader'
  ),
  trackComponent(
    () => import('./ChatFooter'),
    'ChatFooter'
  ),
]).then(() => {
  console.log('%c[Performance Tracking] Container components tracked:', 'color: #89d185', trackedComponents.filter(c => c.includes('Chat')));
});

// Priority 4: Tool Components (MEDIUM IMPACT)
Promise.all([
  trackComponent(
    () => import('./tools/ToolRouter'),
    'ToolRouter',
    'default'
  ),
  trackComponent(
    () => import('./tools/index'),
    'ToolActionsList',
    'default'
  ),
  trackComponent(
    () => import('./tools/ToolHeader'),
    'ToolHeader',
    'ToolHeader'
  ),
]).then(() => {
  console.log('%c[Performance Tracking] Tool components tracked:', 'color: #89d185', trackedComponents.filter(c => c.includes('Tool')));
});

// Log summary after all imports
setTimeout(() => {
  console.log(`%c[Performance Tracking] ✅ Total ${trackedComponents.length} components tracked`, 'color: #51CF66; font-weight: bold; font-size: 12px');
  console.log('%cOpen console and interact with chat to see WDYR logs', 'color: #FFA500');
}, 1000);

export {};
