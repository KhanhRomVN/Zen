/** A file or folder in the workspace. */
export interface WorkspaceItem {
  path: string;
  type: "file" | "folder";
  lastModified?: number;
  size?: number;
}

/** An item attached to the chat input (file, folder, or external). */
export interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "folder" | "external";
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

/** A user-defined rule injected into the system prompt. */
export interface Rule {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
