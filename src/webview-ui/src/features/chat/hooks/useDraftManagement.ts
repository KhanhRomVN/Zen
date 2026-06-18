import { useState, useRef, useEffect } from "react";
import { extensionService } from "../../../services/ExtensionService";

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
  const [message, setMessage] = useState("");
  const storage = extensionService.getStorage();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const undoIndexRef = useRef<number>(-1);
  const isUndoingRef = useRef(false);

  // Restore draft on conversation change
  useEffect(() => {
    if (!conversationId) return;
    isDraftRestoredRef.current = false;
    storage
      .get(`draft:${conversationId}`)
      .then((res: any) => {
        if (res?.value && !isDraftRestoredRef.current && !revertInput?.value) {
          setMessage(res.value);
          undoStackRef.current = [res.value];
          undoIndexRef.current = 0;
        }
        isDraftRestoredRef.current = true;
      })
      .catch(() => {
        isDraftRestoredRef.current = true;
      });
  }, [conversationId]);

  // Debounce-save draft on message change
  useEffect(() => {
    if (!conversationId || !isDraftRestoredRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (message.trim()) {
        storage.set(`draft:${conversationId}`, message).catch(() => {});
      } else {
        storage.delete(`draft:${conversationId}`).catch(() => {});
      }
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [message, conversationId]);

  // Apply revert input (when user reverts a conversation)
  useEffect(() => {
    if (revertInput?.value !== undefined) {
      setMessage(revertInput.value || "");
      undoStackRef.current = revertInput.value ? [revertInput.value] : [];
      undoIndexRef.current = revertInput.value ? 0 : -1;
    }
  }, [revertInput?.value, revertInput?.nonce]);

  const clearDraft = () => {
    if (conversationId) {
      storage.delete(`draft:${conversationId}`).catch(() => {});
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
    }
    setMessage(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, checkMentions: (v: string) => void) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
    const isRedo =
      ((e.ctrlKey || e.metaKey) && e.key === "y") ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z");

    if (isUndo) {
      e.preventDefault();
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
