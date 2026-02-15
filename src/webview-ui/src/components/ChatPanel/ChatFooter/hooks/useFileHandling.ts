import { useState, useRef } from "react";
import { UploadedFile, ExternalFile, AttachedItem } from "../types";
import { isFileAllowed, readFileAsText } from "../utils";

interface UseFileHandlingProps {
  onAddAttachedItem: (item: AttachedItem) => void;
}

export const useFileHandling = ({
  onAddAttachedItem,
}: UseFileHandlingProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const externalFileInputRef = useRef<HTMLInputElement>(null);

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
            setUploadedFiles((prev) => [
              ...prev,
              {
                id: `file-${Date.now()}-${Math.random()}`,
                name: file.name,
                size: file.size,
                type: file.type,
                content: content,
              },
            ]);
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
    e: React.ChangeEvent<HTMLInputElement>
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
          newFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            size: file.size,
            type: file.type,
            content: content,
          });
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
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file extension
      if (!isFileAllowed(file.name)) {
        console.warn(`File ${file.name} not allowed (not in whitelist)`);
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
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error);
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
        console.warn(`File ${file.name} not allowed (not in whitelist)`);
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
      } catch (error) {
        console.error(`Error reading dropped file ${file.name}:`, error);
      }
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
