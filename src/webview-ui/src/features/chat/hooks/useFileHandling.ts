import { useState, useRef } from "react";
import { UploadedFile, ExternalFile, AttachedItem } from "../types";
import { isFileAllowed, readFileAsText } from "../utils/utils";
import { useSettings } from "../../../context/SettingsContext";

interface UseFileHandlingProps {
  accountId?: string;
  onAddAttachedItem: (item: AttachedItem) => void;
}

export const useFileHandling = ({
  accountId,
  onAddAttachedItem,
}: UseFileHandlingProps) => {
  const { apiUrl } = useSettings();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const externalFileInputRef = useRef<HTMLInputElement>(null);

  const uploadFileToServer = async (file: UploadedFile) => {
    if (!apiUrl || !accountId) {
      return;
    }

    // Set status to uploading
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, isUploading: true } : f)),
    );

    try {
      let blob: Blob;
      if (file.content.startsWith("data:")) {
        const arr = file.content.split(",");
        const mime =
          arr[0].match(/:(.*?);/)?.[1] ||
          file.type ||
          "application/octet-stream";
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        blob = new Blob([file.content], { type: file.type || "text/plain" });
      }

      const formData = new FormData();
      formData.append("file", blob, file.name);

      const uploadRes = await fetch(
        `${apiUrl}/v1/chat/accounts/${accountId}/uploads`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!uploadRes.ok) {
        throw new Error(`Upload API returned status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();
      if (uploadData.success && uploadData.data?.file_id) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, file_id: uploadData.data.file_id, isUploading: false }
              : f,
          ),
        );
      } else {
        throw new Error(uploadData.error || "Unknown upload error");
      }
    } catch (err: any) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, isUploading: false, error: err.message || String(err) }
            : f,
        ),
      );
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          hasImage = true;
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            const newFile: UploadedFile = {
              id: `file-${Date.now()}-${Math.random()}`,
              name: file.name,
              size: file.size,
              type: file.type,
              content: content,
            };
            setUploadedFiles((prev) => [...prev, newFile]);
            uploadFileToServer(newFile);
          };
          reader.readAsDataURL(file);
        }
      }
    }

    if (hasImage) {
      e.preventDefault();
    }
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

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => uploadFileToServer(file));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file extension
      if (!isFileAllowed(file.name)) {
        continue;
      }

      try {
        // Read file content
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

        // Add to attached items
        const attachedItem: AttachedItem = {
          id: externalFile.id,
          path: fullPath,
          type: "external",
        };
        onAddAttachedItem(attachedItem);
      } catch (error) {}
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
        onAddAttachedItem(attachedItem);
      } catch (error) {}
    }
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setExternalFiles([]);
  };

  return {
    uploadedFiles,
    externalFiles,
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
  };
};
