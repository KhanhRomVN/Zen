/**
 * Icon components for the application.
 * All icons are defined as inline React components with a `size` prop.
 * 
 * Usage:
 *   import { FileIcon, PlusIcon, SendIcon } from "@/icons";
 *   <FileIcon size={16} />
 */

import React from "react";

// Props for icon components
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

// Helper to create an icon component from SVG path data
function createIcon(
  paths: React.ReactNode,
  defaultSize: number = 14,
  viewBox: string = "0 0 24 24"
): React.FunctionComponent<IconProps> {
  return function IconWrapper({ size = defaultSize, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

// ─── File Icon ────────────────────────────────────────────────────────────────
const FilePaths = (
  <>
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </>
);
export const FileIcon = createIcon(FilePaths);

// ─── Folder Icon ──────────────────────────────────────────────────────────────
const FolderPaths = (
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
);
export const FolderIcon = createIcon(FolderPaths);

// ─── Folder Open Icon ─────────────────────────────────────────────────────────
const FolderOpenPaths = (
  <>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <path d="M2 14h20" />
  </>
);
export const FolderOpenIcon = createIcon(FolderOpenPaths);

// ─── Law Icon ────────────────────────────────────────────────────────────────
const LawPaths = (
  <>
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </>
);
export const LawIcon = createIcon(LawPaths);

// ─── Message Icon ─────────────────────────────────────────────────────────────
const MessagePaths = (
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);
export const MessageIcon = createIcon(MessagePaths);

// ─── At Icon ──────────────────────────────────────────────────────────────────
const AtPaths = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </>
);
export const AtIcon = createIcon(AtPaths);

// ─── Plus Icon ────────────────────────────────────────────────────────────────
const PlusPaths = (
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
);
export const PlusIcon = createIcon(PlusPaths);

// ─── Settings Icon ────────────────────────────────────────────────────────────
const SettingsPaths = (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6m-9-9h6m6 0h6" />
    <path d="m16.24 7.76 4.24-4.24m-12.96 0 4.24 4.24m0 8.48-4.24 4.24m12.96 0-4.24-4.24" />
  </>
);
export const SettingsIcon = createIcon(SettingsPaths);

// ─── Send Icon ────────────────────────────────────────────────────────────────
const SendPaths = (
  <>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </>
);
export const SendIcon = createIcon(SendPaths);

// ─── Project Structure Icon ──────────────────────────────────────────────────
const ProjectStructurePaths = (
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
);
export const ProjectStructureIcon = createIcon(ProjectStructurePaths, 14);

// ─── Workflow Icon ────────────────────────────────────────────────────────────
const WorkflowPaths = (
  <>
    <rect width="8" height="8" x="3" y="3" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect width="8" height="8" x="13" y="13" rx="2" />
  </>
);
export const WorkflowIcon = createIcon(WorkflowPaths, 16);

// ─── Changes Tree Icon ──────────────────────────────────────────────────────
const ChangesTreePaths = (
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M8 7v7" />
    <path d="M12 7v4" />
    <path d="M16 7v9" />
  </>
);
export const ChangesTreeIcon = createIcon(ChangesTreePaths, 16);

// ─── Git Commit Icon ─────────────────────────────────────────────────────────
const GitCommitPaths = (
  <>
    <path d="M12 3v6" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 15v6" />
  </>
);
export const GitCommitIcon = createIcon(GitCommitPaths, 18);

// ─── Close Icon ──────────────────────────────────────────────────────────────
const ClosePaths = (
  <>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </>
);
export const CloseIcon = createIcon(ClosePaths);

// ─── CodeSandbox Icon ────────────────────────────────────────────────────────
const CodeSandboxPaths = (
  <>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
    <polyline points="7.5 19.79 7.5 14.6 3 12" />
    <polyline points="21 12 16.5 14.6 16.5 19.79" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" x2="12" y1="22.08" y2="12" />
  </>
);
export const CodeSandboxIcon = createIcon(CodeSandboxPaths, 24);

// ─── Shield Icon ─────────────────────────────────────────────────────────────
const ShieldPaths = (
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M9 12h6" />
    <path d="M12 9v6" />
  </>
);
export const ShieldIcon = createIcon(ShieldPaths, 24);

// ─── Chevron Down Icon ───────────────────────────────────────────────────────
const ChevronDownPaths = (
  <polyline points="6 9 12 15 18 9" />
);
export const ChevronDownIcon = createIcon(ChevronDownPaths);

// ─── Square Terminal Icon ────────────────────────────────────────────────────
const SquareTerminalPaths = (
  <>
    <path d="m7 11 2-2-2-2" />
    <path d="M11 13h4" />
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  </>
);
export const SquareTerminalIcon = createIcon(SquareTerminalPaths, 16);

// Default export for convenience
export default {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  LawIcon,
  MessageIcon,
  AtIcon,
  PlusIcon,
  SettingsIcon,
  SendIcon,
  ProjectStructureIcon,
  WorkflowIcon,
  ChangesTreeIcon,
  GitCommitIcon,
  CloseIcon,
  CodeSandboxIcon,
  ShieldIcon,
  ChevronDownIcon,
  SquareTerminalIcon,
};