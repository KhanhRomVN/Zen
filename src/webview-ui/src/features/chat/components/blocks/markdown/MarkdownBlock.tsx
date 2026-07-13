import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import FileIcon from "@/icons/FileIcon";
import { extensionService } from "@/services/ExtensionService";
import { CodeBlock } from "../code/CodeBlock";

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

// Helper to extract filename from path
const getFilename = (path: string): string => {
  return path.split(/[/\\]/).pop() || path;
};

// Helper to shorten path for display: folder/.../file
const shortenPath = (fullPath: string, maxLength: number = 50): string => {
  if (fullPath.length <= maxLength) {
    return fullPath;
  }

  const parts = fullPath.split(/[/\\]/);
  if (parts.length <= 2) {
    return fullPath;
  }

  const filename = parts[parts.length - 1];
  const firstFolder = parts[0];

  // Calculate remaining space for middle part
  const fixedLength = firstFolder.length + filename.length + 5; // +5 for "/../"

  if (fixedLength >= maxLength) {
    // If first folder + file is already too long, just show folder/../file
    return `${firstFolder}/../${filename}`;
  }

  // Try to fit as many middle folders as possible
  let result = `${firstFolder}`;
  let remainingParts = parts.slice(1, -1);

  // Check if we can fit all middle parts
  const fullMiddle = remainingParts.join("/");
  if (result.length + fullMiddle.length + filename.length + 2 <= maxLength) {
    return fullPath;
  }

  // Otherwise, abbreviate
  return `${firstFolder}/../${filename}`;
};

// Helper to check if text looks like a file path
const isFilePath = (text: string): boolean => {
  // Check for path patterns: contains / or \, and has file extension
  return (
    (text.includes("/") || text.includes("\\")) &&
    /\.[a-zA-Z0-9]{1,10}$/.test(text)
  );
};

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

  // Handle <pre><code> blocks → use CodeBlock component
  if (tag === "pre") {
    const codeEl = el.querySelector("code");
    if (codeEl) {
      const codeText = codeEl.textContent || "";
      // Extract language from class (e.g., "language-javascript")
      const className = codeEl.className || "";
      const languageMatch = className.match(/language-(\w+)/);
      const language = languageMatch ? languageMatch[1] : "text";

      return (
        <CodeBlock
          key={key}
          code={codeText}
          language={language}
          enableWordWrap={false}
        />
      );
    }
  }

  // Handle table cells with file paths
  if (tag === "td") {
    const text = el.textContent?.trim() || "";

    // Check if this cell contains a file path
    if (isFilePath(text)) {
      const filename = getFilename(text);
      const shortenedPath = shortenPath(text);

      // Strip common prefixes that might be in the full path
      let cleanPath = text;
      const prefixesToStrip = ["src/renderer/src/", "src/renderer/", "src/"];

      for (const prefix of prefixesToStrip) {
        if (cleanPath.startsWith(prefix)) {
          cleanPath = cleanPath.substring(prefix.length);
          break;
        }
      }

      // Also handle paths starting with components/, features/, etc
      // These should be relative to src/renderer/src
      if (
        cleanPath.startsWith("components/") ||
        cleanPath.startsWith("features/") ||
        cleanPath.startsWith("pages/") ||
        cleanPath.startsWith("utils/")
      ) {
        cleanPath = `src/renderer/src/${cleanPath}`;
      }

      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      return (
        <td key={key} data-file-path="true">
          <span
            onClick={handleClick}
            className="file-link"
            title={`Click to open: ${text}`}
          >
            <FileIcon
              path={text}
              isFolder={false}
              style={{ width: "12px", height: "12px", flexShrink: 0 }}
            />
            <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {filename}
              <span
                style={{
                  opacity: 0.6,
                  fontSize: "0.9em",
                  marginLeft: "4px",
                }}
              >
                ({shortenedPath})
              </span>
            </span>
          </span>
        </td>
      );
    }
  }

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

  // <code> inside <pre> → already handled above by CodeBlock
  // Skip this section as pre blocks are now rendered by CodeBlock component

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
      const sanitized = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        FORBID_ATTR: [
          "onerror",
          "onload",
          "onclick",
          "onmouseover",
          "onfocus",
          "onblur",
          "onchange",
          "onsubmit",
        ],
        FORBID_TAGS: [
          "script",
          "style",
          "iframe",
          "object",
          "embed",
          "form",
          "input",
        ],
        ALLOW_DATA_ATTR: false,
      });

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

export { MarkdownBlock };
export default MarkdownBlock;
