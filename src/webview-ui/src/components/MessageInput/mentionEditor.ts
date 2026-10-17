/**
 * ------------------------------------------------------------------
 * Mention Editor
 * ------------------------------------------------------------------
 * Tiện ích cho ô nhập contenteditable của MessageInput: badge file/folder
 * hiển thị inline và được lưu trong message dưới dạng token.
 *
 * Main functions:
 * - serializeEditor()       : DOM của editor → chuỗi message (badge → token)
 * - renderMessageToEditor() : Chuỗi message → DOM (token → badge)
 * - getMentionContext()     : Tìm "@query" ngay trước con trỏ
 * - insertBadgeAt()         : Thay "@query" bằng badge
 * - resolveMentionTokens()  : Token → relative/system path khi gửi
 * ------------------------------------------------------------------
 */

import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";

export interface MentionItem {
  path: string;
  type: "file" | "folder";
}

export interface MentionContext {
  node: Text;
  start: number;
  end: number;
  query: string;
}

const TOKEN_START = "\uE000";
const TOKEN_END = "\uE001";
const BADGE_PATH_ATTR = "data-mention-path";
const BADGE_TYPE_ATTR = "data-mention-type";
const MENTION_TRIGGER_REGEX = /(^|\s)@([^\s@]*)$/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const ABSOLUTE_PATH_REGEX = /^([a-zA-Z]:)?[\\/]/;
const BLOCK_TAGS = new Set(["DIV", "P"]);

const BADGE_STYLE = [
  "display:inline-flex",
  "align-items:center",
  "gap:4px",
  "padding:1px 6px",
  "margin:0 1px",
  "border-radius:var(--border-radius)",
  "font-size:11px",
  "font-weight:600",
  "white-space:nowrap",
  "user-select:all",
  "position:relative",
  "top:1px",
  "color:var(--secondary-text)",
  "background-color:color-mix(in srgb, var(--secondary-text) 12%, transparent)",
].join(";");

const createTokenRegex = () => /\uE000(file|folder):([^\uE001]*)\uE001/g;

export const buildMatcher = (query: string): RegExp => {
  try {
    return new RegExp(query, "i");
  } catch {
    return new RegExp(query.replace(REGEX_SPECIAL, "\\$&"), "i");
  }
};

export const formatMentionPath = (itemPath: string): string => {
  const isOutsideWorkspace =
    ABSOLUTE_PATH_REGEX.test(itemPath) || itemPath.startsWith("../");
  return isOutsideWorkspace ? itemPath : itemPath.replace(/^\.\//, "");
};

export const resolveMentionTokens = (text: string): string =>
  text.replace(createTokenRegex(), (_match, _type, itemPath) =>
    formatMentionPath(itemPath),
  );

const buildToken = (item: MentionItem): string =>
  `${TOKEN_START}${item.type}:${item.path}${TOKEN_END}`;

const getBaseName = (itemPath: string): string =>
  itemPath.slice(itemPath.lastIndexOf("/") + 1);

const createBadgeElement = (item: MentionItem): HTMLSpanElement => {
  const name = getBaseName(item.path);
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute(BADGE_PATH_ATTR, item.path);
  badge.setAttribute(BADGE_TYPE_ATTR, item.type);
  badge.title = item.path;
  badge.style.cssText = BADGE_STYLE;
  if (item.type === "file") badge.style.cursor = "pointer";

  const icon = document.createElement("img");
  icon.src =
    item.type === "folder" ? getFolderIconPath(name) : getFileIconPath(name);
  icon.alt = "";
  icon.width = 13;
  icon.height = 13;
  icon.draggable = false;

  const label = document.createElement("span");
  label.textContent = name;

  badge.append(icon, label);
  return badge;
};

export const getFileBadgePath = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const badge = target.closest(`[${BADGE_TYPE_ATTR}="file"]`);
  const badgePath = badge?.getAttribute(BADGE_PATH_ATTR);
  return badgePath ? formatMentionPath(badgePath) : null;
};

const serializeNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.nodeName === "BR") return "\n";
  const badgePath = node.getAttribute(BADGE_PATH_ATTR);
  if (badgePath !== null) {
    const type = node.getAttribute(BADGE_TYPE_ATTR) === "folder" ? "folder" : "file";
    return buildToken({ type, path: badgePath });
  }
  return serializeChildren(node);
};

const serializeChildren = (parent: Node): string =>
  Array.from(parent.childNodes)
    .map((child, index) => {
      const text = serializeNode(child);
      return BLOCK_TAGS.has(child.nodeName) && index > 0 ? `\n${text}` : text;
    })
    .join("");

export const serializeEditor = (root: HTMLElement): string => {
  const text = serializeChildren(root);
  // <br> cuối cùng chỉ là placeholder để trình duyệt vẽ dòng trống, không phải ký tự người dùng gõ
  return root.lastChild?.nodeName === "BR" ? text.slice(0, -1) : text;
};

export const renderMessageToEditor = (
  root: HTMLElement,
  message: string,
): void => {
  root.textContent = "";

  const appendText = (text: string) => {
    text.split("\n").forEach((line, index) => {
      if (index > 0) root.appendChild(document.createElement("br"));
      if (line) root.appendChild(document.createTextNode(line));
    });
  };

  let last = 0;
  for (const match of message.matchAll(createTokenRegex())) {
    const index = match.index ?? 0;
    appendText(message.slice(last, index));
    root.appendChild(
      createBadgeElement({
        type: match[1] === "folder" ? "folder" : "file",
        path: match[2],
      }),
    );
    last = index + match[0].length;
  }
  appendText(message.slice(last));

  if (message.endsWith("\n")) root.appendChild(document.createElement("br"));
};

export const placeCaretAtEnd = (root: HTMLElement): void => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export const getMentionContext = (root: HTMLElement): MentionContext | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }
  const node = selection.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) {
    return null;
  }
  if (node.parentElement?.closest(`[${BADGE_PATH_ATTR}]`)) return null;

  const end = selection.anchorOffset;
  const match = MENTION_TRIGGER_REGEX.exec((node as Text).data.slice(0, end));
  if (!match) return null;

  return {
    node: node as Text,
    start: end - match[2].length - 1,
    end,
    query: match[2],
  };
};

export const insertBadgeAt = (
  context: MentionContext,
  item: MentionItem,
): void => {
  const { node, start, end } = context;
  const parent = node.parentNode;
  if (!parent) return;

  const after = node.splitText(end);
  node.data = node.data.slice(0, start);

  const space = document.createTextNode(" ");
  parent.insertBefore(createBadgeElement(item), after);
  parent.insertBefore(space, after);

  const range = document.createRange();
  range.setStart(space, 1);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};