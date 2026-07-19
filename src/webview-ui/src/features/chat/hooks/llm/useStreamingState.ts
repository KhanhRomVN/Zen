import { useReducer, useRef, useCallback } from "react";

// Streaming state combined into single object to reduce re-renders
export interface StreamingState {
  isProcessing: boolean;
  isStreaming: boolean;
  isContinuing: boolean;
}

type StreamingAction =
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_CONTINUING"; payload: boolean }
  | { type: "RESET_STREAMING" }
  | { type: "STOP_ALL" };

const streamingReducer = (
  state: StreamingState,
  action: StreamingAction,
): StreamingState => {
  switch (action.type) {
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "SET_STREAMING":
      return { ...state, isStreaming: action.payload };
    case "SET_CONTINUING":
      return { ...state, isContinuing: action.payload };
    case "RESET_STREAMING":
      return {
        ...state,
        isStreaming: false,
        isContinuing: false,
      };
    case "STOP_ALL":
      return {
        isProcessing: false,
        isStreaming: false,
        isContinuing: false,
      };
    default:
      return state;
  }
};

export const useStreamingState = () => {
  const [streamingState, dispatchStreaming] = useReducer(streamingReducer, {
    isProcessing: false,
    isStreaming: false,
    isContinuing: false,
  });

  const isProcessingRef = useRef(false);
  const isContinuingRef = useRef(false);

  const setIsProcessingSync = useCallback((val: boolean) => {
    isProcessingRef.current = val;
    dispatchStreaming({ type: "SET_PROCESSING", payload: val });
  }, []);

  const setIsContinuingSync = useCallback((val: boolean) => {
    isContinuingRef.current = val;
    dispatchStreaming({ type: "SET_CONTINUING", payload: val });
  }, []);

  return {
    streamingState,
    dispatchStreaming,
    isProcessingRef,
    isContinuingRef,
    setIsProcessingSync,
    setIsContinuingSync,
  };
};
