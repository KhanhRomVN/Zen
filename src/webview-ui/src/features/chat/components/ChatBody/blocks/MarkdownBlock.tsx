import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import FileIcon from "../../common/FileIcon";
import { extensionService } from "../../../../../services/ExtensionService";

const ABSOLUTE_PATH_REGEX = /^(\/[^\s<>"'`]+|[A-Za-z]:\\[^\s<>"'`]+)/;
const RELATIVE_PATH_WITH_FOLDERS_REGEX =
  /^[^\s<>"'`|*?:]+[/\\][^\s<>"'`|*?:]+\.[a-zA-Z0-9]{1,10}$/;
const FILENAME_REGEX = /^[^\s/\\<>"'`]+\.[a-zA-Z0-9]{1,10}$/;
const isLikelyFolder = (token: string): boolean => {
  if (token.endsWith("/") || token.endsWith("\\")) return true;
  if (ABSOLUTE_PATH_REGEX.test(token)) {
    const lastSegment =
      token
        .replace(/[/\\]$/, "")
        .split(/[/\\]/)
        .pop() || "";
    return !lastSegment.includes(".");
  }
  return false;
};

interface PathChipProps {
  displayText: string;
  resolvedPath: string;
}

const PathChip: React.FC<PathChipProps> = ({ displayText, resolvedPath }) => {
  const isFolder = isLikelyFolder(resolvedPath);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder) {
      extensionService.postMessage({
        command: "openFolder",
        path: resolvedPath,
      });
    } else {
      extensionService.postMessage({ command: "openFile", path: resolvedPath });
    }
  };

  return (
    <span
      onClick={handleClick}
      title={
        isFolder ? `Open folder: ${resolvedPath}` : `Open file: ${resolvedPath}`
      }
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
            <PathChip
              key={key}
              displayText={text}
              resolvedPath={resolvedPath}
            />
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

export interface MarkdownBlockProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  knownFilePaths?: Map<string, string>;
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = React.memo(
  ({ content, className, style, knownFilePaths }) => {
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
    }, [content, resolvedMap.size]);

    return (
      <div
        className={`markdown-content-inline ${className || ""}`}
        style={style}
      >
        {reactNodes}
      </div>
    );
  },
  (prev, next) => {
    // Custom comparison: skip re-render if content unchanged and map size unchanged
    return (
      prev.content === next.content &&
      prev.className === next.className &&
      (prev.knownFilePaths?.size ?? 0) === (next.knownFilePaths?.size ?? 0)
    );
  },
);

export default MarkdownBlock;
