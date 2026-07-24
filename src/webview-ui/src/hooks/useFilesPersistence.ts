import { useState, useEffect, useRef } from "react";
import { extensionService } from "../services/ExtensionService";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  file_id?: string;
  isUploading?: boolean;
  error?: string;
}

interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "external" | "text-snippet";
  content?: string;
  lineCount?: number;
}

interface PersistedState {
  uploadedFiles: UploadedFile[];
  attachedItems: AttachedItem[];
}

/**
 * Manages persistence for uploaded files and attached items
 * Similar to draft management but for files/attachments
 */
export const useFilesPersistence = (
  conversationId: string,
  folderPath: string | null,
) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);
  const storage = extensionService.getStorage();
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoredRef = useRef(false);

  // Generate unique key based on conversation ID and folder path
  const getStorageKey = () => {
    if (conversationId && conversationId !== "new") {
      return `files:${conversationId}`;
    }
    return folderPath ? `files:draft:${folderPath}` : "files:draft:global";
  };

  // Restore files on mount or when conversationId/folderPath changes
  useEffect(() => {
    isRestoredRef.current = false;
    const storageKey = getStorageKey();

    storage
      .get(storageKey)
      .then((res: any) => {
        if (res?.value && !isRestoredRef.current) {
          const parsed: PersistedState = JSON.parse(res.value);
          setUploadedFiles(parsed.uploadedFiles || []);
          setAttachedItems(parsed.attachedItems || []);
        }
        isRestoredRef.current = true;
      })
      .catch((err: unknown) => {
        console.error("[useFilesPersistence] ❌ Error restoring:", err);
        isRestoredRef.current = true;
      });
  }, [conversationId, folderPath]);

  // Debounce-save files on change
  useEffect(() => {
    if (!isRestoredRef.current) {
      return;
    }

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(() => {
      const storageKey = getStorageKey();

      if (uploadedFiles.length > 0 || attachedItems.length > 0) {
        const state: PersistedState = {
          uploadedFiles,
          attachedItems,
        };
        storage
          .set(storageKey, JSON.stringify(state))
          .then(() => {})
          .catch((err: unknown) => {
            console.error("[useFilesPersistence] ❌ Error saving:", err);
          });
      } else {
        storage
          .delete(storageKey)
          .then(() => {})
          .catch((err: unknown) => {
            console.error("[useFilesPersistence] ❌ Error deleting:", err);
          });
      }
    }, 500); // Debounce 500ms

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [uploadedFiles, attachedItems, conversationId, folderPath]);

  const clearFiles = () => {
    const storageKey = getStorageKey();
    storage
      .delete(storageKey)
      .then(() => {})
      .catch((err: unknown) => {
        console.error("[useFilesPersistence] ❌ Error clearing:", err);
      });
  };

  return {
    uploadedFiles,
    setUploadedFiles,
    attachedItems,
    setAttachedItems,
    clearFiles,
  };
};
