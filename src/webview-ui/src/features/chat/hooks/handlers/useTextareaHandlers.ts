import { useCallback, useRef } from "react";

interface UseTextareaHandlersProps {
  setMessage: (value: string) => void;
  checkMentions: (value: string) => void;
  handleDraftKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    checkMentions: (value: string) => void,
  ) => void;
}

/**
 * Hook to manage textarea interaction handlers
 */
export const useTextareaHandlers = ({
  setMessage,
  checkMentions,
  handleDraftKeyDown,
}: UseTextareaHandlersProps) => {
  const renderCountRef = useRef(0);
  const changeCountRef = useRef(0);
  const keyDownCountRef = useRef(0);

  renderCountRef.current += 1;

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const changeStartTime = performance.now();
      changeCountRef.current += 1;

      const value = e.target.value;

      setMessage(value);
      checkMentions(value);
    },
    [setMessage, checkMentions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      keyDownCountRef.current += 1;
      handleDraftKeyDown(e, checkMentions);
    },
    [handleDraftKeyDown, checkMentions],
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

  return {
    handleTextareaChange,
    handleKeyDown,
    handleOpenImage,
  };
};
