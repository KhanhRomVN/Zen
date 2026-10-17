import * as React from "react";
import { useWorkspaceData } from "@/features/chat/hooks/workspace/useWorkspaceData";
import {
  buildMatcher,
  getMentionContext,
  insertBadgeAt,
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
  const isOpen = query !== null;

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