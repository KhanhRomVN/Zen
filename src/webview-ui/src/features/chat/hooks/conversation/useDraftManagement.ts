import { useState, useRef, useEffect } from "react";
import { extensionService } from "../../../../services/ExtensionService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useDraftManagement');

/**
 * Manages the draft message state for the chat footer, including:
 * - Persistent draft save/restore per conversation
 * - Undo/redo stack for the textarea
 * - Revert input (restoring content when reverting a conversation)
 */
export const useDraftManagement = (
  conversationId: string,
  revertInput: { value: string; nonce: number } | null,
) => {
  const renderCountRef = useRef(0);
  const saveCountRef = useRef(0);
  const restoreCountRef = useRef(0);
  const undoCountRef = useRef(0);
  const redoCountRef = useRef(0);
  
  renderCountRef.current += 1;

  const [message, setMessage] = useState("");
  const storage = extensionService.getStorage();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const undoIndexRef = useRef<number>(-1);
  const isUndoingRef = useRef(false);

  log.render('useDraftManagement', {
    renderCount: renderCountRef.current,
    messageLength: message.length,
    conversationId,
    undoStackSize: undoStackRef.current.length,
    undoIndex: undoIndexRef.current
  });

  // Restore draft on conversation change
  useEffect(() => {
    const effectStartTime = performance.now();
    
    if (!conversationId) {
      log.state('draft_restore_skip', { reason: 'no_conversation' });
      return;
    }
    
    log.state('draft_restore_start', { conversationId });
    
    isDraftRestoredRef.current = false;
    const draftKey = `draft:${conversationId}`;
    storage
      .get(draftKey)
      .then((res: any) => {
        restoreCountRef.current += 1;
        
        if (res?.value && !isDraftRestoredRef.current && !revertInput?.value) {
          log.state('draft_restored', {
            restoreCount: restoreCountRef.current,
            draftLength: res.value.length
          });
          setMessage(res.value);
          undoStackRef.current = [res.value];
          undoIndexRef.current = 0;
        } else {
          log.state('draft_restore_skip', {
            reason: res?.value ? 'already_restored_or_revert' : 'no_draft'
          });
        }
        isDraftRestoredRef.current = true;
        
        log.perf('draft_restore_complete', effectStartTime, {
          restoreCount: restoreCountRef.current
        });
      })
      .catch((err: unknown) => {
        console.error("[useDraftManagement] ❌ Error restoring draft:", err);
        log.state('draft_restore_error', { error: String(err) });
        isDraftRestoredRef.current = true;
      });
  }, [conversationId]);

  // Debounce-save draft on message change
  useEffect(() => {
    if (!conversationId) {
      return;
    }
    if (!isDraftRestoredRef.current) {
      return;
    }

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    draftTimerRef.current = setTimeout(() => {
      const saveStartTime = performance.now();
      saveCountRef.current += 1;
      
      const draftKey = `draft:${conversationId}`;
      if (message.trim()) {
        log.state('draft_save_start', {
          saveCount: saveCountRef.current,
          messageLength: message.length
        });
        
        storage
          .set(draftKey, message)
          .then(() => {
            log.perf('draft_save_complete', saveStartTime, {
              saveCount: saveCountRef.current
            });
          })
          .catch((err: unknown) => {
            console.error("[useDraftManagement] ❌ Error saving draft:", err);
            log.state('draft_save_error', { error: String(err) });
          });
      } else {
        log.state('draft_delete', { saveCount: saveCountRef.current });
        
        storage
          .delete(draftKey)
          .then(() => {
            log.perf('draft_delete_complete', saveStartTime, {});
          })
          .catch((err: unknown) => {
            console.error("[useDraftManagement] ❌ Error deleting draft:", err);
            log.state('draft_delete_error', { error: String(err) });
          });
      }
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [message, conversationId]);

  // Apply revert input (when user reverts a conversation)
  useEffect(() => {
    if (revertInput?.value !== undefined) {
      log.state('draft_revert_input', {
        valueLength: revertInput.value.length,
        nonce: revertInput.nonce
      });
      
      setMessage(revertInput.value || "");
      undoStackRef.current = revertInput.value ? [revertInput.value] : [];
      undoIndexRef.current = revertInput.value ? 0 : -1;
    }
  }, [revertInput?.value, revertInput?.nonce]);

  const clearDraft = () => {
    log.state('draft_clear', { conversationId });
    
    if (conversationId) {
      const draftKey = `draft:${conversationId}`;
      storage
        .delete(draftKey)
        .then(() => {
          log.state('draft_clear_complete', {});
        })
        .catch((err: unknown) => {
          console.error("[useDraftManagement] ❌ Error clearing draft:", err);
          log.state('draft_clear_error', { error: String(err) });
        });
    }
    undoStackRef.current = [];
    undoIndexRef.current = -1;
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (!isUndoingRef.current) {
      const newStack = undoStackRef.current.slice(0, undoIndexRef.current + 1);
      newStack.push(value);
      undoStackRef.current = newStack;
      undoIndexRef.current = newStack.length - 1;
      
      log.state('draft_textarea_change', {
        valueLength: value.length,
        undoStackSize: undoStackRef.current.length,
        undoIndex: undoIndexRef.current
      });
    }
    setMessage(value);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    checkMentions: (v: string) => void,
  ) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
    const isRedo =
      ((e.ctrlKey || e.metaKey) && e.key === "y") ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z");

    if (isUndo) {
      e.preventDefault();
      undoCountRef.current += 1;
      
      log.state('draft_undo', {
        undoCount: undoCountRef.current,
        currentIndex: undoIndexRef.current,
        stackSize: undoStackRef.current.length
      });
      
      if (undoIndexRef.current > 0) {
        isUndoingRef.current = true;
        undoIndexRef.current -= 1;
        const prev = undoStackRef.current[undoIndexRef.current];
        setMessage(prev);
        checkMentions(prev);
        isUndoingRef.current = false;
      } else if (undoIndexRef.current === 0) {
        isUndoingRef.current = true;
        undoIndexRef.current = -1;
        setMessage("");
        checkMentions("");
        isUndoingRef.current = false;
      }
      return;
    }

    if (isRedo) {
      e.preventDefault();
      redoCountRef.current += 1;
      
      log.state('draft_redo', {
        redoCount: redoCountRef.current,
        currentIndex: undoIndexRef.current,
        stackSize: undoStackRef.current.length
      });
      
      if (undoIndexRef.current < undoStackRef.current.length - 1) {
        isUndoingRef.current = true;
        undoIndexRef.current += 1;
        const next = undoStackRef.current[undoIndexRef.current];
        setMessage(next);
        checkMentions(next);
        isUndoingRef.current = false;
      }
    }
  };

  return {
    message,
    setMessage,
    storage,
    clearDraft,
    handleTextareaChange,
    handleKeyDown,
    undoStackRef,
    undoIndexRef,
  };
};
