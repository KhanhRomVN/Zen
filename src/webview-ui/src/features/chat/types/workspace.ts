/** A file or folder in the workspace. */
export interface WorkspaceItem {
  path: string;
  type: "file" | "folder";
  lastModified?: number;
  size?: number;
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
