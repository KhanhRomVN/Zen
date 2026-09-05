import { create } from 'zustand';

/**
 * Store for streaming preview - bypasses React render cascade
 * Following performance guidelines from react-prop-drilling-render-cascade.md
 * 
 * This store is updated directly from SSE events (high-frequency updates)
 * without triggering re-renders in parent components.
 */

interface StreamingPreviewStore {
  /** Current streaming content */
  content: string;
  
  /** Whether currently streaming */
  isStreaming: boolean;
  
  /** Start time for timer */
  startTime: number | null;
  
  /** Update streaming content (called from SSE event handler) */
  setContent: (content: string) => void;
  
  /** Start streaming session */
  startStreaming: () => void;
  
  /** Stop streaming and reset */
  stopStreaming: () => void;
}

export const useStreamingPreviewStore = create<StreamingPreviewStore>((set) => ({
  content: '',
  isStreaming: false,
  startTime: null,
  
  setContent: (content) => set({ content }),
  
  startStreaming: () => set({ 
    isStreaming: true, 
    startTime: Date.now(),
    content: '',
  }),
  
  stopStreaming: () => set({ 
    isStreaming: false, 
    startTime: null,
    content: '',
  }),
}));

/**
 * Non-reactive API for external updates (from SSE handler)
 * This doesn't trigger subscribers - use for high-frequency updates
 */
export const streamingPreviewStore = {
  setContent: (content: string) => {
    useStreamingPreviewStore.setState({ content });
  },
  
  startStreaming: () => {
    useStreamingPreviewStore.setState({ 
      isStreaming: true,
      startTime: Date.now(),
      content: '',
    });
  },
  
  stopStreaming: () => {
    useStreamingPreviewStore.setState({ 
      isStreaming: false,
      startTime: null,
      content: '',
    });
  },
};
