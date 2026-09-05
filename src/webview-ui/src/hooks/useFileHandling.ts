import { useState, useRef, useEffect } from "react";
import {
  UploadedFile,
  ExternalFile,
  AttachedItem,
} from "../types/file-uploader";
import {
  isFileAllowed,
  readFileAsText,
} from "../features/chat/utils/fileUtils";
import { ALLOWED_FILE_EXTENSIONS } from "../features/chat/constants/constants";
import { useSettings } from "../context/SettingsContext";
import { countTokens } from "../utils/tokenizer";

interface UseFileHandlingProps {
  accountId?: string;
  modelId?: string;
  onAddAttachedItem: (item: AttachedItem) => void;
  folderPath: string | null;
}

// Storage keys
const STORAGE_KEYS = {
  uploadedFiles: (folderPath: string | null) =>
    `zen-uploaded-files:${folderPath || "global"}`,
  attachedItems: (folderPath: string | null) =>
    `zen-attached-items:${folderPath || "global"}`,
};

export const useFileHandling = ({
  accountId,
  modelId,
  onAddAttachedItem,
  folderPath,
}: UseFileHandlingProps) => {
  const { apiUrl } = useSettings();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);
  const [invalidExternalFiles, setInvalidExternalFiles] = useState<
    { name: string; path: string; reason: string }[]
  >([]);
  const [attachedItemsCache, setAttachedItemsCache] = useState<AttachedItem[]>(
    [],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const externalFileInputRef = useRef<HTMLInputElement>(null);
  const isRestoringRef = useRef(false);
  
  // 🔧 FIX: Store latest callback in ref to avoid stale closure
  const onAddAttachedItemRef = useRef(onAddAttachedItem);
  useEffect(() => {
    console.log('[useFileHandling] 🔄 Updating onAddAttachedItemRef with new callback');
    console.log('[useFileHandling] New callback type:', typeof onAddAttachedItem);
    console.log('[useFileHandling] New callback:', onAddAttachedItem.toString().substring(0, 200));
    onAddAttachedItemRef.current = onAddAttachedItem;
  }, [onAddAttachedItem]);

  // ============================================================================
  // RESTORE: Load attachedItems từ localStorage khi mount (chỉ attachedItems)
  // uploadedFiles sẽ KHÔNG được persist - chỉ tồn tại trong memory
  // ============================================================================
  useEffect(() => {
    isRestoringRef.current = true;

    try {
      // Restore attachedItems (external files vẫn được persist)
      const savedAttachedItems = localStorage.getItem(
        STORAGE_KEYS.attachedItems(folderPath),
      );
      if (savedAttachedItems) {
        const parsed = JSON.parse(savedAttachedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAttachedItemsCache(parsed);
          // Restore each attached item - use ref to get latest callback
          parsed.forEach((item: AttachedItem) => {
            onAddAttachedItemRef.current(item);
          });
        }
      }
    } catch (error) {
      console.error(
        "[useFileHandling] Failed to restore from localStorage:",
        error,
      );
    }

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
  }, [folderPath]); // Only run when folderPath changes

  // ============================================================================
  // AUTO-CLEAR: Clear uploadedFiles khi model hoặc account thay đổi
  // ============================================================================
  useEffect(() => {
    // Clear uploaded files when model or account changes
    console.log(`[useFileHandling] Model/Account changed - clearing uploadedFiles | modelId=${modelId} | accountId=${accountId}`);
    setUploadedFiles([]);
  }, [modelId, accountId]);

  // ============================================================================
  // Track attachedItems changes through cache
  // ============================================================================
  const addAttachedItemWithCache = (item: AttachedItem) => {
    console.log(`[useFileHandling] ========== addAttachedItemWithCache START ==========`);
    console.log(`[useFileHandling] Adding item:`, {
      id: item.id,
      type: item.type,
      path: item.path,
      hasContent: !!(item as any).content,
      contentLength: (item as any).content?.length || 0,
    });
    
    setAttachedItemsCache((prev) => {
      console.log(`[useFileHandling] Current cache size: ${prev.length}`);
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        console.log(`[useFileHandling] Item already exists in cache, skipping`);
        return prev;
      }
      const updated = [...prev, item];
      console.log(`[useFileHandling] Updated cache size: ${updated.length}`);
      console.log(`[useFileHandling] Updated cache:`, updated.map(i => ({ id: i.id, type: i.type })));

      // Save to localStorage
      try {
        localStorage.setItem(
          STORAGE_KEYS.attachedItems(folderPath),
          JSON.stringify(updated),
        );
        console.log(`[useFileHandling] Saved to localStorage successfully`);
      } catch (error) {
        console.error("[useFileHandling] Failed to save attachedItems:", error);
      }

      return updated;
    });

    console.log(`[useFileHandling] Calling onAddAttachedItem callback via ref...`);
    console.log(`[useFileHandling] Ref type:`, typeof onAddAttachedItemRef.current);
    console.log(`[useFileHandling] Ref is null?:`, onAddAttachedItemRef.current === null);
    console.log(`[useFileHandling] About to call ref with item:`, { id: item.id, type: item.type });
    
    try {
      // 🔧 FIX: Use ref to call latest version of callback
      onAddAttachedItemRef.current(item);
      console.log(`[useFileHandling] ✅ onAddAttachedItem callback executed successfully`);
    } catch (error) {
      console.error(`[useFileHandling] ❌ Error calling onAddAttachedItem:`, error);
    }
    
    console.log(`[useFileHandling] onAddAttachedItem callback completed`);
    console.log(`[useFileHandling] ========== addAttachedItemWithCache END ==========`);
  };

  const removeAttachedItemFromCache = (itemId: string) => {
    setAttachedItemsCache((prev) => {
      const updated = prev.filter((i) => i.id !== itemId);

      // Update localStorage
      try {
        if (updated.length > 0) {
          localStorage.setItem(
            STORAGE_KEYS.attachedItems(folderPath),
            JSON.stringify(updated),
          );
        } else {
          localStorage.removeItem(STORAGE_KEYS.attachedItems(folderPath));
        }
      } catch (error) {
        console.error(
          "[useFileHandling] Failed to update attachedItems:",
          error,
        );
      }

      return updated;
    });
  };

  const uploadFileToServer = async (file: UploadedFile) => {
    console.log(`[Zen] ========== uploadFileToServer START ==========`);
    console.log(`[Zen] uploadFileToServer | file.id=${file.id} | file.name=${file.name} | file.size=${file.size}`);
    console.log(`[Zen] uploadFileToServer | apiUrl=${apiUrl} | accountId=${accountId}`);
    
    if (!apiUrl || !accountId) {
      console.error(`[Zen] uploadFileToServer | ABORT - missing config | apiUrl=${apiUrl} | accountId=${accountId}`);
      return;
    }

    // Set status to uploading
    console.log(`[Zen] uploadFileToServer | Setting file to uploading state`);
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, isUploading: true } : f)),
    );

    try {
      console.log(`[Zen] uploadFileToServer | Creating blob | contentType=${file.content.startsWith('data:') ? 'data URL' : 'plain text'}`);
      
      let blob: Blob;
      if (file.content.startsWith("data:")) {
        console.log(`[Zen] uploadFileToServer | Converting data URL to blob`);
        const arr = file.content.split(",");
        const mime =
          arr[0].match(/:(.*?);/)?.[1] ||
          file.type ||
          "application/octet-stream";
        console.log(`[Zen] uploadFileToServer | Detected MIME type: ${mime}`);
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
        console.log(`[Zen] uploadFileToServer | Blob created from data URL | size=${blob.size}`);
      } else {
        console.log(`[Zen] uploadFileToServer | Creating blob from text content`);
        blob = new Blob([file.content], { type: file.type || "text/plain" });
        console.log(`[Zen] uploadFileToServer | Blob created from text | size=${blob.size}`);
      }

      const formData = new FormData();
      formData.append("file", blob, file.name);
      console.log(`[Zen] uploadFileToServer | FormData created`);

      const uploadUrl = `${apiUrl}/v1/uploads/accounts/${accountId}/uploads`;
      console.log(`[Zen] uploadFileToServer | Sending POST request | url=${uploadUrl}`);

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      console.log(`[Zen] uploadFileToServer | Response received | status=${uploadRes.status} | ok=${uploadRes.ok}`);

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error(`[Zen] uploadFileToServer | Upload failed | status=${uploadRes.status} | error=${errorText}`);
        throw new Error(`Upload API returned status ${uploadRes.status}: ${errorText}`);
      }

      const uploadData = await uploadRes.json();
      console.log(`[Zen] uploadFileToServer | Response parsed | success=${uploadData.success}`);
      console.log(`[Zen] uploadFileToServer | Response data:`, uploadData);

      if (uploadData.success && uploadData.data?.file_id) {
        console.log(`[Zen] uploadFileToServer | Upload successful | file_id=${uploadData.data.file_id}`);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, file_id: uploadData.data.file_id, isUploading: false }
              : f,
          ),
        );
        console.log(`[Zen] uploadFileToServer | File state updated with file_id`);
      } else {
        const error = uploadData.error || "Unknown upload error";
        console.error(`[Zen] uploadFileToServer | Invalid response | error=${error}`);
        throw new Error(error);
      }
    } catch (err: any) {
      console.error(`[Zen] uploadFileToServer | Exception caught:`, err);
      console.error(`[Zen] uploadFileToServer | Error message: ${err.message || String(err)}`);
      console.error(`[Zen] uploadFileToServer | Error stack:`, err.stack);
      
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, isUploading: false, error: err.message || String(err) }
            : f,
        ),
      );
      console.log(`[Zen] uploadFileToServer | File state updated with error`);
    }
    
    console.log(`[Zen] ========== uploadFileToServer END ==========`);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    console.log(`[Zen] ========================================`);
    console.log(`[Zen] handlePaste triggered`);
    console.log(`[Zen] clipboardData:`, e.clipboardData);
    console.log(`[Zen] clipboardData.items.length:`, e.clipboardData.items.length);
    
    const items = e.clipboardData.items;
    let hasImage = false;

    // Log all clipboard items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[Zen] Item ${i} | kind=${item.kind} | type=${item.type}`);
    }

    // 🚀 Check for large text paste - use token count instead of character count
    const pastedText = e.clipboardData.getData("text/plain");
    console.log(`[Zen] Pasted text length: ${pastedText?.length || 0} chars`);
    
    const LARGE_TEXT_TOKEN_THRESHOLD = 3000; // 3k tokens threshold

    if (pastedText && pastedText.length > 0) {
      const tokenCount = countTokens(pastedText);
      console.log(`[Zen] Pasted text token count: ${tokenCount} tokens`);

      if (tokenCount > LARGE_TEXT_TOKEN_THRESHOLD) {
        console.log(`[Zen] Large text detected (${tokenCount} tokens > ${LARGE_TEXT_TOKEN_THRESHOLD}), creating snippet`);
        e.preventDefault(); // Prevent default paste

        // Create text snippet attachment
        const lineCount = pastedText.split("\n").length;
        const snippet: AttachedItem = {
          id: `snippet-${Date.now()}-${Math.random()}`,
          path: `Pasted Text (${lineCount} lines, ${tokenCount} tokens)`,
          type: "text-snippet" as any,
          content: pastedText,
          lineCount,
        };

        console.log(`[Zen] ========== SNIPPET CREATION DEBUG ==========`);
        console.log(`[Zen] Creating snippet | id=${snippet.id}`);
        console.log(`[Zen] Snippet properties:`, {
          id: snippet.id,
          type: snippet.type,
          lineCount: snippet.lineCount,
          tokenCount: tokenCount,
          contentLength: pastedText.length,
          path: snippet.path
        });
        console.log(`[Zen] Calling addAttachedItemWithCache...`);
        
        addAttachedItemWithCache(snippet);
        
        console.log(`[Zen] addAttachedItemWithCache completed`);
        console.log(`[Zen] Checking attachedItemsCache state...`);
        console.log(`[Zen] ================================================`);
        console.log(`[Zen] ========================================`);
        return; // Stop processing
      } else {
        console.log(`[Zen] Text is small enough (${tokenCount} tokens <= ${LARGE_TEXT_TOKEN_THRESHOLD}), allowing normal paste`);
      }
    }

    // Original image handling
    console.log(`[Zen] Processing clipboard items for images...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[Zen] Processing item ${i} | kind=${item.kind} | type=${item.type}`);
      
      if (item.kind === "file" && item.type.startsWith("image/")) {
        console.log(`[Zen] Image detected | type=${item.type}`);
        
        const file = item.getAsFile();
        console.log(`[Zen] getAsFile result | hasFile=${!!file} | fileName=${file?.name} | fileSize=${file?.size}`);
        
        if (file) {
          hasImage = true;
          console.log(`[Zen] Reading image file | name=${file.name} | size=${file.size} | type=${file.type}`);
          
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            console.log(`[Zen] FileReader onload | contentLength=${content?.length}`);
            
            const newFile: UploadedFile = {
              id: `file-${Date.now()}-${Math.random()}`,
              name: file.name,
              size: file.size,
              type: file.type,
              content: content,
            };
            
            console.log(`[Zen] Creating uploaded file | id=${newFile.id} | name=${newFile.name} | size=${newFile.size}`);
            
            setUploadedFiles((prev) => {
              console.log(`[Zen] Adding to uploadedFiles | currentCount=${prev.length} | newTotal=${prev.length + 1}`);
              return [...prev, newFile];
            });
            
            console.log(`[Zen] Calling uploadFileToServer | accountId=${accountId} | apiUrl=${apiUrl}`);
            uploadFileToServer(newFile);
          };
          
          reader.onerror = (error) => {
            console.error(`[Zen] FileReader error:`, error);
          };
          
          console.log(`[Zen] Starting FileReader.readAsDataURL...`);
          reader.readAsDataURL(file);
        } else {
          console.warn(`[Zen] getAsFile returned null for item ${i}`);
        }
      }
    }

    if (hasImage) {
      console.log(`[Zen] Image(s) found, preventing default paste behavior`);
      e.preventDefault();
    } else {
      console.log(`[Zen] No images found in clipboard`);
    }
    
    console.log(`[Zen] ========================================`);
  };

  const handleFileSelect = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files) return;

    // Check if textOnly mode is set on the input element
    const textOnly = (e.target as any).dataset?.textOnly === "true";

    const newFiles: UploadedFile[] = [];
    const invalidFiles: { name: string; reason: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // If textOnly mode, filter out image files
      if (textOnly && file.type.startsWith("image/")) {
        invalidFiles.push({
          name: file.name,
          reason: "Image files are not allowed when upload is disabled",
        });
        continue;
      }

      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = () => {
          const content = reader.result as string;
          const newFile: UploadedFile = {
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            size: file.size,
            type: file.type,
            content: content,
          };
          newFiles.push(newFile);
          resolve();
        };

        if (file.type.startsWith("image/")) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    if (invalidFiles.length > 0) {
      const vscodeApi = (window as any).vscodeApi;
      const message = `Cannot add file(s):\n${invalidFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}`;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "showWarning",
          message: message,
        });
      } else {
        alert(message);
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => uploadFileToServer(file));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      // Clean up the dataset flag
      delete (fileInputRef.current as any).dataset.textOnly;
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleExternalFileSelect = () => {
    if (externalFileInputRef.current) {
      externalFileInputRef.current.click();
    }
  };

  const handleExternalFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files) return;

    const newInvalidFiles: { name: string; path: string; reason: string }[] =
      [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file extension
      if (!isFileAllowed(file.name)) {
        newInvalidFiles.push({
          name: file.name,
          path: (file as any).path || file.webkitRelativePath || file.name,
          reason: `File type "${file.name.substring(file.name.lastIndexOf("."))}" is not supported. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(", ")}`,
        });
        continue;
      }

      try {
        // Read file content - if this fails, file is not readable as text
        const content = await readFileAsText(file);

        // Get full path (webkitRelativePath or name)
        const fullPath =
          (file as any).path || file.webkitRelativePath || file.name;

        const externalFile: ExternalFile = {
          id: `external-${Date.now()}-${i}`,
          name: file.name,
          path: fullPath,
          content: content,
          size: file.size,
        };

        setExternalFiles((prev) => [...prev, externalFile]);

        // Add to attached items using cache wrapper
        const attachedItem: AttachedItem = {
          id: externalFile.id,
          path: fullPath,
          type: "external",
        };
        addAttachedItemWithCache(attachedItem);
      } catch (error) {
        // File is not readable as text
        newInvalidFiles.push({
          name: file.name,
          path: (file as any).path || file.webkitRelativePath || file.name,
          reason: `Cannot read "${file.name}" as text. The file may be binary, corrupted, or too large.`,
        });
      }
    }

    if (newInvalidFiles.length > 0) {
      setInvalidExternalFiles((prev) => [...prev, ...newInvalidFiles]);
      // Show warning to user
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "showWarning",
          message: `${newInvalidFiles.length} file(s) could not be added:\n${newInvalidFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}`,
        });
      } else {
        alert(
          `Cannot add file(s):\n${newInvalidFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}`,
        );
      }
    }

    // Reset input
    if (externalFileInputRef.current) {
      externalFileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!isFileAllowed(file.name)) {
        continue;
      }

      try {
        const content = await readFileAsText(file);
        const fullPath =
          (file as any).path || file.webkitRelativePath || file.name;

        const externalFile: ExternalFile = {
          id: `external-${Date.now()}-${i}`,
          name: file.name,
          path: fullPath,
          content: content,
          size: file.size,
        };

        setExternalFiles((prev) => [...prev, externalFile]);

        const attachedItem: AttachedItem = {
          id: externalFile.id,
          path: fullPath,
          type: "external",
        };
        addAttachedItemWithCache(attachedItem);
      } catch (error) {}
    }
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setExternalFiles([]);
    setInvalidExternalFiles([]);
    setAttachedItemsCache([]);

    // Clear localStorage - chỉ clear attachedItems (uploadedFiles không còn được persist)
    try {
      localStorage.removeItem(STORAGE_KEYS.attachedItems(folderPath));
    } catch (error) {
      console.error("[useFileHandling] Failed to clear localStorage:", error);
    }
  };

  const clearInvalidExternalFiles = () => {
    setInvalidExternalFiles([]);
  };

  return {
    uploadedFiles,
    externalFiles,
    invalidExternalFiles,
    fileInputRef,
    externalFileInputRef,
    handlePaste,
    handleFileSelect,
    handleFileInputChange,
    removeFile,
    handleExternalFileSelect,
    handleExternalFileInputChange,
    handleDragOver,
    handleDrop,
    clearFiles,
    clearInvalidExternalFiles,
    addAttachedItemWithCache,
    removeAttachedItemFromCache,
  };
};
