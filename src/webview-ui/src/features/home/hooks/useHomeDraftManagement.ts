import { useState, useRef, useEffect } from "react";
import { extensionService } from "../../../services/ExtensionService";

/**
 * Manages the draft message state for the Home MessageInput.
 * Persists draft per workspace folder path (or global if no workspace).
 */
export const useHomeDraftManagement = (folderPath: string | null) => {
  const [message, setMessage] = useState("");
  const storage = extensionService.getStorage();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);

  // Generate unique draft key based on workspace folder
  const getDraftKey = () => {
    const key = folderPath ? `home-draft:${folderPath}` : "home-draft:global";
    return key;
  };

  // Restore draft on mount or when folderPath changes
  useEffect(() => {
    isDraftRestoredRef.current = false;
    const draftKey = getDraftKey();

    storage
      .get(draftKey)
      .then((res: any) => {
        if (res?.value && !isDraftRestoredRef.current) {
          setMessage(res.value);
        } else {
        }
        isDraftRestoredRef.current = true;
      })
      .catch((err: unknown) => {
        console.error(
          "[useHomeDraftManagement] ❌ Error restoring draft:",
          err,
        );
        isDraftRestoredRef.current = true;
      });
  }, [folderPath]);

  // Debounce-save draft on message change
  useEffect(() => {
    if (!isDraftRestoredRef.current) {
      return;
    }

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    draftTimerRef.current = setTimeout(() => {
      const draftKey = getDraftKey();

      if (message.trim()) {
        storage
          .set(draftKey, message)
          .then(() => {})
          .catch((err: unknown) => {
            console.error(
              "[useHomeDraftManagement] ❌ Error saving draft:",
              err,
            );
          });
      } else {
        storage
          .delete(draftKey)
          .then(() => {})
          .catch((err: unknown) => {
            console.error(
              "[useHomeDraftManagement] ❌ Error deleting draft:",
              err,
            );
          });
      }
    }, 500);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [message, folderPath]);

  const clearDraft = () => {
    const draftKey = getDraftKey();
    storage
      .delete(draftKey)
      .then(() => {})
      .catch((err: unknown) => {
        console.error("[useHomeDraftManagement] ❌ Error clearing draft:", err);
      });
  };

  return {
    message,
    setMessage,
    clearDraft,
  };
};
