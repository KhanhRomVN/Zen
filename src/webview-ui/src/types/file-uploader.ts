/** An item attached to the chat input (file, folder, external, text-snippet, or rule). */
export interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "external" | "text-snippet" | "skill";
  content?: string; // For text-snippet type
  lineCount?: number; // For text-snippet type
  /** Slug skill đã cài (type = "skill") — path chứa tên hiển thị. */
  skillSlug?: string;
}

/** A file uploaded by the user (local or already uploaded to backend). */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Base64 or plain text content. */
  content: string;
  file_id?: string;
  url?: string;
  isUploading?: boolean;
  error?: string;
}

/** A file loaded from an external path (outside the workspace). */
export interface ExternalFile {
  id: string;
  name: string;
  /** Full absolute path. */
  path: string;
  content: string;
  size: number;
}
