/**
 * ------------------------------------------------------------------
 * useHomeDraftManagement
 * ------------------------------------------------------------------
 * Custom hook quản lý draft message cho Home MessageInput.
 * Lưu draft riêng theo workspace folder path (hoặc global nếu không có workspace).

 * Main features:
 * - Restore draft khi mount hoặc khi folderPath thay đổi
 * - Debounce-save draft khi message thay đổi (500ms)
 * - Xóa draft khỏi storage khi message trống
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useRef, useEffect } from "react";

// ── Services ──
import { extensionService } from "../../../services/ExtensionService";

// ─── Hook ───────────────────────────────────────────────────────────────
export const useHomeDraftManagement = (folderPath: string | null) => {
  // ── State ──
  const [message, setMessage] = useState("");

  // ── Refs ──
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);

  // ── Derived ──
  const storage = extensionService.getStorage();

  // Generate unique draft key based on workspace folder
  const getDraftKey = () => {
    const key = folderPath ? `home-draft:${folderPath}` : "home-draft:global";
    return key;
  };

  // ── Effects ──
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

  // ── Handlers ──
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