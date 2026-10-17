/**
 * ------------------------------------------------------------------
 * Mention Popup
 * ------------------------------------------------------------------
 * Popup gợi ý khi gõ @ trong MessageInput (lọc theo regex, chọn bằng
 * chuột trái).
 *
 * Main components:
 * - MentionPopup : Danh sách file/folder khớp regex
 * ------------------------------------------------------------------
 */

import * as React from "react";
import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";
import { buildMatcher } from "./mentionEditor";
import type { MentionItem } from "./mentionEditor";

const highlightMatches = (
  text: string,
  matcher: RegExp | null,
): React.ReactNode => {
  if (!matcher) return text;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(matcher)) {
    if (!match[0]) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span
        key={start}
        style={{
          color: "var(--vscode-textLink-foreground, #3794ff)",
          fontWeight: 600,
        }}
      >
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
};

const splitPath = (fullPath: string) => {
  const index = fullPath.lastIndexOf("/");
  return index === -1
    ? { name: fullPath, dir: "" }
    : { name: fullPath.slice(index + 1), dir: fullPath.slice(0, index) };
};

const ItemIcon: React.FC<{
  type: "file" | "folder";
  name: string;
  size: number;
}> = ({ type, name, size }) => (
  <img
    src={type === "folder" ? getFolderIconPath(name) : getFileIconPath(name)}
    alt=""
    width={size}
    height={size}
    style={{ flexShrink: 0 }}
  />
);

interface MentionPopupProps {
  items: MentionItem[];
  query: string;
  onSelect: (item: MentionItem) => void;
}

export const MentionPopup: React.FC<MentionPopupProps> = ({
  items,
  query,
  onSelect,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const matcher = React.useMemo(
    () => (query ? new RegExp(buildMatcher(query).source, "gi") : null),
    [query],
  );
  const [maxHeight, setMaxHeight] = React.useState(240);

  React.useLayoutEffect(() => {
    const parentHeight = ref.current?.parentElement?.offsetHeight;
    if (parentHeight) setMaxHeight(parentHeight * 2);
  }, []);

  return (
    <div
      ref={ref}
      className="custom-scrollbar"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "absolute",
        bottom: "calc(100% + 1px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "95%",
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        boxSizing: "border-box",
        zIndex: 20,
        backgroundColor: "var(--input-bg)",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderBottom: "none",
        borderTopLeftRadius: "6px",
        borderTopRightRadius: "6px",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
      {items.length === 0 ? (
        <div
          style={{
            padding: "8px 10px",
            fontSize: "12px",
            color: "var(--vscode-descriptionForeground, #888)",
          }}
        >
          Không có kết quả
        </div>
      ) : (
        items.map((item) => {
          const { name, dir } = splitPath(item.path);
          return (
            <div
              key={`${item.type}:${item.path}`}
              onClick={() => onSelect(item)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <ItemIcon type={item.type} name={name} size={14} />
              <span
                style={{
                  fontWeight: 600,

                }}
              >
                {highlightMatches(name, matcher)}
              </span>
              {dir && (
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: "11px",
                    color: "var(--vscode-descriptionForeground, #888)",
                  }}
                >
                  {highlightMatches(dir, matcher)}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

