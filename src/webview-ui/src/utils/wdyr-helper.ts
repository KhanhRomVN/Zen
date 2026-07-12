import React from 'react';

/**
 * Helper để đánh dấu components cần theo dõi với Why Did You Render
 * 
 * Cách dùng:
 * ```tsx
 * import { trackComponent } from '@/utils/wdyr-helper';
 * 
 * const MyComponent = () => { ... };
 * export default trackComponent(MyComponent, 'MyComponent');
 * ```
 */

export function trackComponent<T extends React.ComponentType<any>>(
  Component: T,
  displayName?: string
): T {
  (Component as any).whyDidYouRender = true;
  
  if (displayName) {
    Component.displayName = displayName;
  }
  
  return Component;
}

/**
 * Hook để track custom hooks
 * Wrap hook của bạn với useTrackedHook trong development
 * 
 * Cách dùng:
 * ```tsx
 * const useMyHook = () => {
 *   const value = useTrackedHook('useMyHook', () => {
 *     // hook logic
 *   });
 *   return value;
 * };
 * ```
 */
export function useTrackedHook<T>(
  hookName: string,
  hookFn: () => T
): T {
  console.log(`[Hook Trace] ${hookName} is being called`);
  return hookFn();
}

/**
 * Decorator để đánh dấu class components
 * 
 * Cách dùng:
 * ```tsx
 * @trackClassComponent
 * class MyComponent extends React.Component { ... }
 * ```
 */
export function trackClassComponent<T extends { new (...args: any[]): React.Component }>(
  constructor: T
): T {
  (constructor as any).whyDidYouRender = true;
  return constructor;
}

/**
 * HOC để wrap và track components
 * 
 * Cách dùng:
 * ```tsx
 * const TrackedComponent = withTracking(MyComponent, {
 *   name: 'MyComponent',
 *   trackProps: true,
 *   trackHooks: true
 * });
 * ```
 */
export function withTracking<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    name?: string;
    trackProps?: boolean;
    trackHooks?: boolean;
  }
): React.ComponentType<P> {
  const TrackedComponent: React.FC<P> = (props: P) => {
    if (options?.trackProps) {
      console.log(`[WDYR Helper] ${options.name || Component.displayName || Component.name} props:`, props);
    }
    return React.createElement(Component, props);
  };

  (TrackedComponent as any).whyDidYouRender = true;
  TrackedComponent.displayName = options?.name || Component.displayName || Component.name;

  return TrackedComponent;
}
