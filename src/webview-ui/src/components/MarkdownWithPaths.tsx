import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import FileIcon from "./common/FileIcon";
import { extensionService } from "../services/ExtensionService";

/**
 * Detect whether a string token looks like an absolute file/folder path.
 */
const ABSOLUTE_PATH_REGEX = /^(\/[^\s<>"'`]+|[A-Za-z]:\\[^\s<>"'`]+)/;

/**
 * Detect relative paths containing folders, e.g. "server/src/provider/zai.ts" or "resources/z_ai_auth.json"
 */
const RELATIVE_PATH_WITH_FOLDERS_REGEX = /^[^\s<>"'`|*?:]+[/\\][^\s<>"'`|*?:]+\.[a-zA-Z0-9]{1,10}$/;

/**
 * A basename-only filename with extension, e.g. "test.md".
 * No slashes allowed — those are handled by PATH_WITH_FOLDERS or ABSOLUTE_PATH.
 */
const FILENAME_REGEX = /^[^\s/\\<>"'`]+\.[a-zA-Z0-9]{1,10}$/;

/**
 * Check if a token is a folder path (ends with / or absolute with no extension on last segment)
 */
const isLikelyFolder = (token: string): boolean => {
  if (token.endsWith("/") || token.endsWith("\\")) return true;
  if (ABSOLUTE_PATH_REGEX.test(token)) {
    const lastSegment = token.replace(/[/\\]$/, "").split(/[/\\]/).pop() || "";
    return !lastSegment.includes(".");
  }
  return false;
};

interface PathChipProps {
  /** The display text shown on the chip */
  displayText: string;
  /** The actual path used for click action (may differ from displayText for resolved basenames) */
  resolvedPath: string;
}

/**
 * A small inline chip for file/folder paths — shows icon + text, clickable.
 */
const PathChip: React.FC<PathChipProps> = ({ displayText, resolvedPath }) => {
  const isFolder = isLikelyFolder(resolvedPath);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder) {
      extensionService.postMessage({ command: "openFolder", path: resolvedPath });
    } else {
      extensionService.postMessage({ command: "openFile", path: resolvedPath });
    }
  };

  return (
    <span
      onClick={handleClick}
      title={isFolder ? `Open folder: ${resolvedPath}` : `Open file: ${resolvedPath}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 4px",
        borderRadius: "3px",
        color: "var(--primary-text)",
        fontSize: "var(--font-size-sm)",
        fontFamily: "inherit",
        cursor: "pointer",
        verticalAlign: "middle",
        transition: "opacity 0.15s",
        userSelect: "none",
        textDecoration: "none",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.opacity = "0.75")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.opacity = "1")
      }
    >
      <FileIcon
        path={resolvedPath}
        isFolder={isFolder}
        style={{ width: "12px", height: "12px", flexShrink: 0 }}
      />
      {displayText}
    </span>
  );
};

type ReactChild = React.ReactNode;

/**
 * Convert a DOM Node into React nodes.
 *
 * Rules for inline <code> elements (backtick spans):
 *  - Absolute paths   → always PathChip
 *  - Basename-only    → PathChip ONLY if found in `knownFilePaths` map (resolved from prior toolcalls)
 *  - Everything else  → keep as original <code> element
 */
const domNodeToReact = (
  node: Node,
  key: string | number,
  knownFilePaths: Map<string, string>,
): ReactChild => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Inline <code> → path detection
  if (tag === "code" && !el.closest("pre")) {
    const text = el.textContent?.trim() || "";

    if (text.length >= 2) {
      // Case 1: absolute path → always a PathChip
      if (ABSOLUTE_PATH_REGEX.test(text)) {
        return <PathChip key={key} displayText={text} resolvedPath={text} />;
      }

      // Case 2: relative path containing folders → always a PathChip
      if (RELATIVE_PATH_WITH_FOLDERS_REGEX.test(text)) {
        return <PathChip key={key} displayText={text} resolvedPath={text} />;
      }

      // Case 3: basename-only with extension → only PathChip if found in history
      if (FILENAME_REGEX.test(text)) {
        const resolvedPath = knownFilePaths.get(text);
        if (resolvedPath) {
          return (
            <PathChip key={key} displayText={text} resolvedPath={resolvedPath} />
          );
        }
        // Not found in history → render as plain <code>
      }
    }
  }

  // <code> inside <pre> → strip VSCode-injected background
  if (tag === "code" && el.closest("pre")) {
    const children: ReactChild[] = Array.from(el.childNodes).map((child, i) =>
      domNodeToReact(child, `${key}-${i}`, knownFilePaths),
    );
    return (
      <code key={key} style={{ background: "none", padding: 0 }}>
        {children}
      </code>
    );
  }

  // Recursively convert children
  const children: ReactChild[] = Array.from(el.childNodes).map((child, i) =>
    domNodeToReact(child, `${key}-${i}`, knownFilePaths),
  );

  // Build props, copying relevant HTML attributes
  const props: any = { key };
  if (el.hasAttribute("href")) {
    props.href = el.getAttribute("href");
    props.target = "_blank";
    props.rel = "noopener noreferrer";
  }
  if (el.hasAttribute("src")) props.src = el.getAttribute("src");
  if (el.hasAttribute("alt")) props.alt = el.getAttribute("alt");
  if (el.hasAttribute("class")) props.className = el.getAttribute("class");

  return React.createElement(tag, props, ...children);
};

// ─────────────────────────────────────────────────────────────────────────────

export interface MarkdownWithPathsProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Map of basename → full path, built from previous toolcall history.
   * Used to resolve filenames like "z_ai_auth.json" to their full paths.
   */
  knownFilePaths?: Map<string, string>;
}

/**
 * Renders a markdown string with smart inline file/folder path detection.
 *
 * - Absolute paths in backticks → always clickable PathChip
 * - Basename-only filenames in backticks → PathChip only if found in `knownFilePaths`
 * - Everything else → normal markdown rendering
 */
const MarkdownWithPaths: React.FC<MarkdownWithPathsProps> = React.memo(({
  content,
  className,
  style,
  knownFilePaths,
}) => {
  const resolvedMap = knownFilePaths || new Map<string, string>();

  const reactNodes = React.useMemo(() => {
    // 1. Render markdown → sanitized HTML
    const rawHtml = marked.parse(content) as string;
    const sanitized = DOMPurify.sanitize(rawHtml);

    // 2. Parse into DOM
    const wrapper = document.createElement("div");
    wrapper.innerHTML = sanitized;

    // 3. Walk DOM → React tree with path substitution
    return Array.from(wrapper.childNodes).map((child, i) =>
      domNodeToReact(child, i, resolvedMap),
    );
  // Intentionally use content as the only dep for the expensive markdown→DOM parse.
  // knownFilePaths (the Map) changes reference on every render during streaming,
  // but its entries rarely change — we use a serialized size+keys snapshot as dep
  // so we only re-parse when the map actually gains new entries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, resolvedMap.size]);

  return (
    <div className={`markdown-content-inline ${className || ""}`} style={style}>
      {reactNodes}
    </div>
  );
}, (prev, next) => {
  // Custom comparison: skip re-render if content unchanged and map size unchanged
  return prev.content === next.content &&
    prev.className === next.className &&
    (prev.knownFilePaths?.size ?? 0) === (next.knownFilePaths?.size ?? 0);
});

export default MarkdownWithPaths;
