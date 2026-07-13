import { useCallback, useRef } from "react";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useTextareaHandlers');

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

  log.render('useTextareaHandlers', {
    renderCount: renderCountRef.current
  });

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const changeStartTime = performance.now();
      changeCountRef.current += 1;
      
      const value = e.target.value;
      
      log.state('textarea_change', {
        changeCount: changeCountRef.current,
        valueLength: value.length
      });
      
      setMessage(value);
      checkMentions(value);
      
      log.perf('handleTextareaChange', changeStartTime, {
        changeCount: changeCountRef.current
      });
    },
    [setMessage, checkMentions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      keyDownCountRef.current += 1;
      
      log.state('textarea_keydown', {
        keyDownCount: keyDownCountRef.current,
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
      
      handleDraftKeyDown(e, checkMentions);
    },
    [handleDraftKeyDown, checkMentions],
  );

  const handleOpenImage = useCallback((file: any) => {
    log.state('open_image', {
      fileName: file.name,
      contentLength: file.content?.length
    });
    
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openTempImage",
        content: file.content,
        filename: file.name,
      });
    } else {
      log.state('open_image_no_api', {});
    }
  }, []);

  return {
    handleTextareaChange,
    handleKeyDown,
    handleOpenImage,
  };
};
