import { Message } from "@/features/chat/types/message";
import { FileNode } from "../types/renderer-types";

/**
 * Get display path with smart truncation to avoid conflicts
 */
export const getDisplayPath = (
  fullPath: string,
  allPaths: string[],
): string => {
  const sep = /[/\\]/;
  const parts = fullPath.split(sep).filter(Boolean);
  if (parts.length === 0) return fullPath;

  for (let depth = 1; depth <= parts.length; depth++) {
    const candidate = parts.slice(-depth).join("/");
    const conflicts = allPaths.filter((p) => {
      const ps = p.split(sep).filter(Boolean);
      return ps.slice(-depth).join("/") === candidate && p !== fullPath;
    });
    if (conflicts.length === 0) return candidate;
  }
  return parts.join("/");
};

/**
 * Collects all file paths referenced by file-type tool actions across all messages.
 */
export const collectConvFilePaths = (allMessages: Message[]): string[] => {
  const paths: string[] = [];
  const filePathRegex = /<file_path>([\s\S]*?)<\/file_path>/g;
  for (const msg of allMessages) {
    if (msg.role !== "assistant") continue;
    let m: RegExpExecArray | null;
    while ((m = filePathRegex.exec(msg.content)) !== null) {
      if (m[1].trim()) paths.push(m[1].trim());
    }
    filePathRegex.lastIndex = 0;
  }
  return paths;
};

/**
 * Build tree structure from flat list of paths
 */
export const buildTreeFromPaths = (paths: string[]): FileNode[] => {
  const root: FileNode = {
    name: "",
    type: "folder",
    path: "",
    children: [],
  };

  for (const fullPath of paths) {
    const segments = fullPath.split("/").filter(Boolean);
    let currentNode = root;

    segments.forEach((segment, index) => {
      const isLastSegment = index === segments.length - 1;
      const hasExtension = segment.includes(".");
      const isFile = isLastSegment && hasExtension;

      if (!currentNode.children) {
        currentNode.children = [];
      }

      let childNode = currentNode.children.find(
        (child) => child.name === segment,
      );

      if (!childNode) {
        const pathSoFar = segments.slice(0, index + 1).join("/");
        childNode = {
          name: segment,
          type: isFile ? "file" : "folder",
          path: pathSoFar,
          children: isFile ? undefined : [],
        };
        currentNode.children.push(childNode);
      }

      if (!isFile) {
        currentNode = childNode;
      }
    });
  }

  return root.children || [];
};

/**
 * Get the next user message after current assistant message
 */
export const getNextUserMessage = (
  allMessages: Message[],
  messageId: string,
): Message | undefined => {
  if (!allMessages) return undefined;
  return allMessages
    .slice(allMessages.findIndex((m) => m.id === messageId) + 1)
    .find((m) => m.role === "user");
};
