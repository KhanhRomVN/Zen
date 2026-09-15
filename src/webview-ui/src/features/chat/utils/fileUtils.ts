import { ALLOWED_FILE_EXTENSIONS } from "../constants/constants";

/** Returns true if the file extension is in the allowed list. */
export const isFileAllowed = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
};

/** Reads a File object as plain text. */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Builds the `accept` attribute string for a file input
 * based on the current model's upload capabilities.
 * Always includes text/* for text files.
 * Does NOT default to images — only adds image/* if is_image_upload is true.
 */
export const buildAcceptString = (model: any): string => {
  const parts: string[] = ["text/*"];

  if (model?.is_image_upload) {
    parts.push("image/*");
  }
  if (model?.is_video_upload) {
    parts.push("video/*");
  }
  if (model?.is_audio_upload) {
    parts.push("audio/*");
  }
  if (model?.is_file_upload) {
    parts.push("application/pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx");
  }

  return parts.join(",");
};
