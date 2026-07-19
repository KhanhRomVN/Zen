import { useCallback, useRef, useEffect } from "react";

interface UseTextareaHandlersProps {
  setMessage: (value: string) => void;
  checkMentions: (value: string) => void;
  handleDraftKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    checkMentions: (value: string) => void,
  ) => void;
}

export const useTextareaHandlers = ({
  setMessage,
  checkMentions,
  handleDraftKeyDown,
}: UseTextareaHandlersProps) => {
  const renderCountRef = useRef(0);
  const changeCountRef = useRef(0);
  const keyDownCountRef = useRef(0);

  // 🚀 PERF FIX: Debounce checkMentions to avoid expensive regex on every keystroke
  const checkMentionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 🚀 NEW: Debounce state updates for very large text
  const setMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 🚀 PERF FIX #2: Store callback dependencies in refs to stabilize useCallback
  const checkMentionsRef = useRef(checkMentions);
  const handleDraftKeyDownRef = useRef(handleDraftKeyDown);
  const setMessageRef = useRef(setMessage);

  // Sync refs when props change
  useEffect(() => {
    checkMentionsRef.current = checkMentions;
    handleDraftKeyDownRef.current = handleDraftKeyDown;
    setMessageRef.current = setMessage;
  }, [checkMentions, handleDraftKeyDown, setMessage]);

  renderCountRef.current += 1;

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const changeStart = performance.now();
      changeCountRef.current += 1;
      const value = e.target.value;
      const hasAtSymbol = value.includes("@");
      const isVeryLargeText = value.length > 50000;

      // 🚀 OPTIMIZATION: For very large text, use debounced state update
      // but still update immediately for textarea responsiveness
      if (isVeryLargeText) {
        // Clear any pending state update
        if (setMessageTimeoutRef.current) {
          clearTimeout(setMessageTimeoutRef.current);
        }

        // Debounce React state update to avoid expensive re-renders
        // Textarea will still update immediately (browser-native)
        setMessageTimeoutRef.current = setTimeout(() => {
          setMessageRef.current(value);
        }, 150);
      } else {
        // Update message state immediately for responsive UI (normal text)
        setMessageRef.current(value);
      }

      // Debounce expensive checkMentions operation
      if (checkMentionsTimeoutRef.current) {
        clearTimeout(checkMentionsTimeoutRef.current);
      }

      // Only run checkMentions if user is actually typing "@" symbol
      // Skip for very large text to avoid performance issues
      if (hasAtSymbol && !isVeryLargeText) {
        checkMentionsTimeoutRef.current = setTimeout(() => {
          checkMentionsRef.current(value);
        }, 150); // 150ms debounce - responsive but not laggy
      }
    },
    [], // 🚀 Empty deps - stable reference, reads latest callbacks from refs
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      keyDownCountRef.current += 1;
      handleDraftKeyDownRef.current(e, checkMentionsRef.current);
    },
    [], // 🚀 Empty deps - stable reference, reads latest callbacks from refs
  );

  const handleOpenImage = useCallback((file: any) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openTempImage",
        content: file.content,
        filename: file.name,
      });
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (checkMentionsTimeoutRef.current) {
        clearTimeout(checkMentionsTimeoutRef.current);
      }
      if (setMessageTimeoutRef.current) {
        clearTimeout(setMessageTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleTextareaChange,
    handleKeyDown,
    handleOpenImage,
  };
};
