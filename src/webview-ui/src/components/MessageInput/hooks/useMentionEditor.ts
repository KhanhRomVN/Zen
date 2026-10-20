import * as React from "react";
import { useWorkspaceData } from "@/features/chat/hooks/workspace/useWorkspaceData";
import {
  buildMatcher,
  getMentionContext,
  insertBadgeAt,
  insertBadgesAtCaret,
  removeMentionBadge,
} from "../mentionEditor";
import type { MentionContext, MentionItem } from "../mentionEditor";

const MAX_RESULTS = 200;

export const useMentionEditor = (
  editorRef: React.RefObject<HTMLDivElement>,
  onContentChange: () => void,
) => {
  const { availableFiles, availableFolders } = useWorkspaceData();
  const [query, setQuery] = React.useState<string | null>(null);
  const contextRef = React.useRef<MentionContext | null>(null);
  const undoStackRef = React.useRef<Node[][]>([]);
  const isOpen = query !== null;

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      const root = editorRef.current;
      if (data?.command !== "addMention" || !root) return;
      if (!Array.isArray(data.items) || data.items.length === 0) return;
      const inserted = insertBadgesAtCaret(root, data.items as MentionItem[]);
      if (inserted.length > 0) undoStackRef.current.push(inserted);
      onContentChange();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [editorRef, onContentChange]);

  React.useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const handler = (event: MouseEvent) => {
      if (!removeMentionBadge(event.target)) return;
      event.preventDefault();
      onContentChange();
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [editorRef, onContentChange]);

  // Badge chèn bằng DOM không nằm trong undo stack native → tự xử lý Ctrl+Z cho tới khi người dùng gõ tiếp
  React.useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onInput = () => {
      undoStackRef.current = [];
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";
      if (!isUndo) return;
      const last = undoStackRef.current.pop();
      if (!last) return;
      event.preventDefault();
      last.forEach((node) => {
        if (root.contains(node)) node.parentNode?.removeChild(node);
      });
      onContentChange();
    };
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [editorRef, onContentChange]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      const root = editorRef.current;
      if (data?.command !== "addMention" || !root) return;
      if (!Array.isArray(data.items) || data.items.length === 0) return;
      insertBadgesAtCaret(root, data.items as MentionItem[]);
      onContentChange();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [editorRef, onContentChange]);

  React.useEffect(() => {
    if (!isOpen) return;
    (window as any).vscodeApi?.postMessage({ command: "getWorkspaceFiles" });
  }, [isOpen]);

  const items = React.useMemo<MentionItem[]>(() => {
    if (query === null) return [];
    const matcher = buildMatcher(query);
    const result: MentionItem[] = [];
    for (const item of [...availableFolders, ...availableFiles]) {
      if (!matcher.test(item.path)) continue;
      result.push({ path: item.path, type: item.type });
      if (result.length >= MAX_RESULTS) break;
    }
    return result;
  }, [query, availableFiles, availableFolders]);

  const updateFromSelection = React.useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const context = getMentionContext(root);
    contextRef.current = context;
    setQuery(context ? context.query : null);
  }, [editorRef]);

  const closePopup = React.useCallback(() => {
    contextRef.current = null;
    setQuery(null);
  }, []);

  const selectItem = React.useCallback(
    (item: MentionItem) => {
      const root = editorRef.current;
      const context = contextRef.current;
      if (!root || !context) return;
      insertBadgeAt(context, item);
      closePopup();
      root.focus();
      onContentChange();
    },
    [editorRef, closePopup, onContentChange],
  );

  return {
    query,
    isOpen,
    items,
    updateFromSelection,
    closePopup,
    selectItem,
  };
};