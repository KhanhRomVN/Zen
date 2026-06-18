import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { parseAIResponse, ParsedResponse } from "./services/ResponseParser";
import { useSettings } from "../../context/SettingsContext";
import { useCollapseSections } from "./hooks/useCollapseSections";
import { useToolActions } from "./hooks/useToolActions";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { getPermissionDecision } from "./hooks/useToolExecution";

import ProcessingIndicator from "./components/messages/ProcessingIndicator";
import MessageBox from "./components/messages/MessageBox";
import { useBackendConnection } from "../../context/BackendConnectionContext";

import { extensionService } from "../../services/ExtensionService";
import {
  saveConversation,
  deleteConversation,
} from "./services/ConversationService";
import { HISTORY_CONTEXT_REMINDER } from "./prompts";
import { useChatLLM } from "./hooks/useChatLLM";
import { useToolExecution } from "./hooks/useToolExecution";
import { useWorkspaceData } from "./hooks/useWorkspaceData";
import { useFileHandling } from "./hooks/useFileHandling";
import { useMentionSystem } from "./hooks/useMentionSystem";
import { TabInfo } from "../../types";
import { Message, ChatBodyProps } from "./types";
import { ConversationCache } from "./services/ConversationCache";

// Shared components
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import MentionDropdowns from "@/components/MessageInput/MentionDropdowns";

// ─── SearchBar Component ──────────────────────────────────────────────────────
interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
  bodyRef: React.RefObject<HTMLDivElement>;
}

type SearchFlag = "matchCase" | "wholeWord" | "regex";

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery: initialQuery,
  onSearchQueryChange,
  onCloseSearch,
  bodyRef,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(initialQuery || "");
  const [flags, setFlags] = useState<Set<SearchFlag>>(
    new Set<SearchFlag>(["regex"]),
  );
  const [matchCount, setMatchCount] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (q: string) => {
    setLocalQuery(q);
    onSearchQueryChange?.(q);
  };

  const toggleFlag = (f: SearchFlag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  const buildRegex = useCallback(
    (q: string): RegExp | null => {
      if (!q) return null;
      try {
        const isRegex = flags.has("regex");
        const pattern = isRegex
          ? q
          : flags.has("wholeWord")
            ? `\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
            : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regexFlags = flags.has("matchCase") ? "g" : "gi";
        return new RegExp(pattern, regexFlags);
      } catch {
        return null;
      }
    },
    [flags],
  );

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const prev = root.querySelectorAll("mark.zen-search-hl");
    prev.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });
    const regex = buildRegex(localQuery);
    if (!regex) {
      setMatchCount(0);
      setCurrentIdx(0);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "script" ||
          tag === "style"
        )
          return NodeFilter.FILTER_REJECT;
        if (p.closest("mark.zen-search-hl")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    let total = 0;
    nodes.forEach((textNode) => {
      const text = textNode.textContent || "";
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;
      const parent = textNode.parentNode;
      if (!parent) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        if (m.index > last)
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "zen-search-hl";
        mark.dataset.matchIdx = String(total++);
        mark.textContent = m[0];
        mark.style.cssText =
          "background:var(--vscode-editor-findMatchHighlightBackground,rgba(255,255,0,0.35));color:inherit;border-radius:2px;padding:0 1px;";
        frag.appendChild(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      parent.replaceChild(frag, textNode);
    });
    setMatchCount(total);
    setCurrentIdx(total > 0 ? 1 : 0);
  }, [localQuery, flags, buildRegex, bodyRef]);

  const navigate = (dir: 1 | -1) => {
    if (matchCount === 0) return;
    const root = bodyRef.current;
    if (!root) return;
    const marks = root.querySelectorAll("mark.zen-search-hl");
    marks.forEach((m) => {
      (m as HTMLElement).style.background =
        "var(--vscode-editor-findMatchHighlightBackground,rgba(255,255,0,0.35))";
      (m as HTMLElement).style.outline = "";
    });
    const next = ((currentIdx - 1 + dir + matchCount) % matchCount) + 1;
    setCurrentIdx(next);
    const target = marks[next - 1] as HTMLElement | undefined;
    if (target) {
      target.style.background =
        "var(--vscode-editor-findMatchBackground,rgba(255,165,0,0.6))";
      target.style.outline =
        "1px solid var(--vscode-editor-findMatchBorder,orange)";
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const iconBtn = (
    active: boolean,
    title: string,
    onClick: () => void,
    children: React.ReactNode,
  ) => (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active
          ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)"
          : "transparent",
        border: active
          ? "1px solid color-mix(in srgb, var(--vscode-button-background) 45%, transparent)"
          : "1px solid transparent",
        color: active
          ? "var(--vscode-button-background)"
          : "var(--vscode-icon-foreground)",
        cursor: "pointer",
        padding: "2px 4px",
        borderRadius: "3px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: active ? 1 : 0.6,
        transition: "all 0.12s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.opacity = "0.6";
      }}
    >
      {children}
    </button>
  );

  const inputBorderStyle =
    "1px solid var(--vscode-input-border, var(--border-color))";
  const inputBg = "var(--vscode-input-background, var(--primary-bg))";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        alignSelf: "flex-end",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.32)",
        marginBottom: "6px",
        backgroundColor:
          "var(--vscode-editorWidget-background, var(--vscode-input-background, var(--primary-bg)))",
        border:
          "1px solid var(--vscode-editorWidget-border, var(--vscode-input-border, var(--border-color)))",
        borderRadius: "6px",
        padding: "3px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
          backgroundColor: inputBg,
          borderRadius: "3px",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onCloseSearch?.();
            } else if (e.key === "Enter") {
              navigate(e.shiftKey ? -1 : 1);
            }
          }}
          style={{
            background: inputBg,
            border: "none",
            outline: "none",
            color: "var(--vscode-input-foreground)",
            fontSize: "12px",
            padding: "4px 6px",
            width: "180px",
            fontFamily: "var(--vscode-font-family, sans-serif)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1px",
            padding: "2px 4px",
            borderLeft: inputBorderStyle,
            backgroundColor: inputBg,
          }}
        >
          {iconBtn(
            flags.has("matchCase"),
            "Match Case (Alt+C)",
            () => toggleFlag("matchCase"),
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "monospace",
                lineHeight: 1,
              }}
            >
              Aa
            </span>,
          )}
          {iconBtn(
            flags.has("wholeWord"),
            "Match Whole Word (Alt+W)",
            () => toggleFlag("wholeWord"),
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              ab
            </span>,
          )}
          {iconBtn(
            flags.has("regex"),
            "Use Regular Expression (Alt+R)",
            () => toggleFlag("regex"),
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: "monospace",
                lineHeight: 1,
              }}
            >
              .*
            </span>,
          )}
        </div>
      </div>

      <span
        style={{
          fontSize: "11px",
          color: "var(--vscode-descriptionForeground)",
          whiteSpace: "nowrap",
          minWidth: "72px",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {localQuery
          ? matchCount === 0
            ? "No results"
            : `${currentIdx} of ${matchCount}`
          : "\u00A0"}
      </span>

      <button
        title="Previous match (Shift+Enter)"
        onClick={() => navigate(-1)}
        disabled={matchCount === 0}
        style={{
          background: "transparent",
          border: "none",
          cursor: matchCount > 0 ? "pointer" : "default",
          color: "var(--vscode-icon-foreground)",
          padding: "2px 3px",
          opacity: matchCount > 0 ? 0.7 : 0.3,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          if (matchCount > 0) e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          if (matchCount > 0) e.currentTarget.style.opacity = "0.7";
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      <button
        title="Next match (Enter)"
        onClick={() => navigate(1)}
        disabled={matchCount === 0}
        style={{
          background: "transparent",
          border: "none",
          cursor: matchCount > 0 ? "pointer" : "default",
          color: "var(--vscode-icon-foreground)",
          padding: "2px 3px",
          opacity: matchCount > 0 ? 0.7 : 0.3,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          if (matchCount > 0) e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          if (matchCount > 0) e.currentTarget.style.opacity = "0.7";
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <button
        title="Close (Esc)"
        onClick={() => {
          handleQueryChange("");
          onCloseSearch?.();
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--vscode-icon-foreground)",
          padding: "2px 3px",
          opacity: 0.55,
          display: "flex",
          alignItems: "center",
          transition: "opacity 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.55";
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── ChatBody Types ───────────────────────────────────────────────────────────
export interface ExtendedChatBodyProps extends ChatBodyProps {
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  previousAssistantMessage?: Message;
  isSimpleMode?: boolean;
  isRestored?: boolean;
  onContinue?: () => void;
  hasInitialMessage?: boolean;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  isSearchOpen?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
}

// ─── ChatBody Component ───────────────────────────────────────────────────────
const ChatBody: React.FC<ExtendedChatBodyProps> = ({
  messages,
  isProcessing,
  onSendToolRequest,
  onSendMessage,
  executionState,
  toolOutputs,
  terminalStatus,
  firstRequestMessageId,
  onLoadConversation,
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
  onToolAction,
  onSelectOption,
  isSimpleMode = true,
  isRestored = false,
  isContinuing = false,
  incompleteHasPartialTool = false,
  incompletePartialToolType = null,
  onContinue,
  hasInitialMessage = false,
  onRevertConversation,
  onAutoScrollPausedChange,
  scrollToBottomRef,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  isSearchOpen = false,
  searchQuery = "",
  onSearchQueryChange,
  onCloseSearch,
}: ExtendedChatBodyProps) => {
  const { permissionMode } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const parseCacheRef = useRef<Map<string, ParsedResponse>>(new Map());

  const parsedMessages = useMemo(() => {
    const cache = parseCacheRef.current;
    return messages.map((msg) => {
      if (!cache.has(msg.content)) {
        cache.set(msg.content, parseAIResponse(msg.content));
      }
      return {
        ...msg,
        parsed: cache.get(msg.content)!,
      };
    });
  }, [messages]);

  const { collapsedSections, toggleCollapse } = useCollapseSections();
  const { clickedActions, handleToolClick, failedActions, rejectedActions } =
    useToolActions({
      onSendToolRequest,
      onToolAction,
      parsedMessages,
      isProcessing,
      isRestored,
    });
  const { isAtBottom, autoScrollPaused, scrollToBottom } = useScrollBehavior(
    messagesEndRef,
    [messages, isProcessing],
  );

  const prevPausedRef = useRef(false);
  useEffect(() => {
    if (autoScrollPaused !== prevPausedRef.current) {
      prevPausedRef.current = autoScrollPaused;
      onAutoScrollPausedChange?.(autoScrollPaused);
    }
  }, [autoScrollPaused, onAutoScrollPausedChange]);

  useEffect(() => {
    if (scrollToBottomRef) scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom, scrollToBottomRef]);

  const hasUnexecutedAutoActions = useMemo(() => {
    if (!isRestored || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsed = parseAIResponse(lastMessage.content);
    if (!parsed.actions || parsed.actions.length === 0) return false;
    const firstPendingAction = parsed.actions.find(
      (action: any, idx: number) => {
        if (action.isPartial) return false;
        const actionId = `${lastMessage.id}-action-${idx}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);
        return !hasOutput && !isClicked;
      },
    );
    if (!firstPendingAction) return false;
    const isVisible =
      !isSimpleMode ||
      [
        "write_to_file",
        "replace_in_file",
        "run_command",
        "execute_agent_action",
      ].includes(firstPendingAction.type);
    if (isVisible) return false;
    const decision = getPermissionDecision(
      permissionMode,
      firstPendingAction.type,
    );
    return decision === "allow";
  }, [
    messages,
    isRestored,
    toolOutputs,
    permissionMode,
    clickedActions,
    isSimpleMode,
  ]);

  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      if (message.uiHidden || message.isCancelled) return false;
      return true;
    });
  }, [messages, firstRequestMessageId]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  const isResponding = useMemo(() => {
    if (!isProcessing || visibleMessages.length === 0) return false;
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsedMessage = parsedMessages.find((pm) => pm.id === lastMessage.id);
    if (!parsedMessage) return false;
    const parsed = parsedMessage.parsed;
    const hasText = parsed.displayText && parsed.displayText.trim().length > 0;
    const hasActions = parsed.actions && parsed.actions.length > 0;
    const hasOtherBlocks =
      parsed.contentBlocks &&
      parsed.contentBlocks.some((b) => {
        switch (b.type) {
          case "tool":
            return true;
          case "mixed_content":
            return b.segments.length > 0;
          case "code":
          case "html":
          case "file":
          case "markdown":
            return b.content.trim().length > 0;
          default:
            return false;
        }
      });
    return !!(hasText || hasActions || hasOtherBlocks);
  }, [isProcessing, visibleMessages, parsedMessages]);

  const parsedMap = useMemo(() => {
    const map = new Map<string, any>();
    parsedMessages.forEach((pm) => map.set(pm.id, pm.parsed));
    return map;
  }, [parsedMessages]);

  return (
    <div
      ref={bodyRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
        backgroundColor: "var(--secondary-bg)",
        paddingBottom:
          visibleMessages.length > 0 ? "200px" : "var(--spacing-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
        fontSize: "14px",
        position: "relative",
      }}
    >
      {isSearchOpen && (
        <SearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onCloseSearch={onCloseSearch}
          bodyRef={bodyRef}
        />
      )}

      <div className="chat-timeline-wrapper">
        {visibleMessages.map((message, index) => {
          const parsedMessage = parsedMessages.find(
            (pm) => pm.id === message.id,
          );
          if (!parsedMessage) return null;
          const parsedContent = parsedMessage.parsed;
          const nextUserMessage = messages
            .slice(messages.findIndex((m) => m.id === message.id) + 1)
            .find((m) => m.role === "user");
          const previousAssistantMessage = messages
            .slice(
              0,
              messages.findIndex((m) => m.id === message.id),
            )
            .reverse()
            .find((m) => m.role === "assistant");
          return (
            <MessageBox
              key={message.id}
              message={message}
              parsedContent={parsedContent}
              nextUserMessage={nextUserMessage}
              isGenerating={
                isProcessing && index === visibleMessages.length - 1
              }
              isCollapsed={
                message.role === "user"
                  ? collapsedSections.has(`prompt-${message.id}`)
                  : false
              }
              onToggleCollapse={() => toggleCollapse(`prompt-${message.id}`)}
              clickedActions={clickedActions}
              failedActions={failedActions}
              rejectedActions={rejectedActions}
              onToolClick={handleToolClick}
              executionState={executionState}
              isLastMessage={
                index === visibleMessages.length - 1 ||
                index === lastAssistantIndex
              }
              toolOutputs={toolOutputs}
              terminalStatus={terminalStatus}
              allMessages={messages}
              activeTerminalIds={activeTerminalIds}
              attachedTerminalIds={attachedTerminalIds}
              conversationId={conversationId}
              previousAssistantMessage={previousAssistantMessage}
              onSendMessage={onSendMessage}
              onSelectOption={onSelectOption}
              isSimpleMode={isSimpleMode}
              onRevertConversation={onRevertConversation}
              singleLineReviewActions={singleLineReviewActions}
              onConfirmSingleLineAction={onConfirmSingleLineAction}
              onRejectSingleLineAction={onRejectSingleLineAction}
            />
          );
        })}
      </div>

      {hasUnexecutedAutoActions && onContinue && (
        <div
          style={{
            paddingLeft: "29px",
            marginTop: "12px",
            marginBottom: "12px",
            display: "flex",
          }}
        >
          <button
            onClick={onContinue}
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)",
              color: "var(--vscode-button-background, #007acc)",
              border:
                "1px solid color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)",
              padding: "6px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "28px",
              boxSizing: "border-box",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--vscode-button-background, #007acc) 25%, transparent)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--vscode-button-background, #007acc) 50%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)";
            }}
          >
            <span
              className="codicon codicon-play"
              style={{
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
            <span>Continue Task</span>
          </button>
        </div>
      )}

      {isContinuing && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "8px 14px",
            marginBottom: "4px",
            marginTop: "4px",
            background:
              "color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 8%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 25%, transparent)",
            borderRadius: "8px",
            color: "var(--vscode-editor-foreground)",
            fontSize: "12px",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              marginTop: "2px",
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--vscode-editorWarning-foreground, #cca700)",
              animation: "zen-pulse 1.2s ease-in-out infinite",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, opacity: 0.9 }}>
              Response bị ngắt — đang tiếp tục…
            </span>
            <span style={{ opacity: 0.7, lineHeight: "1.4" }}>
              {incompleteHasPartialTool
                ? `AI tự động ngắt response dài. Đang ghép phần còn lại của \`${incompletePartialToolType ?? "tool"}\` trước khi thực thi.`
                : "AI tự động ngắt response dài. Đang lấy phần còn lại…"}
            </span>
          </div>
          <style>{`
            @keyframes zen-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.75); }
            }
          `}</style>
        </div>
      )}

      {(isProcessing || hasInitialMessage) && (
        <ProcessingIndicator isResponding={isResponding} />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  selectedTab: TabInfo | null;
  onBack: (contentToReturn?: string) => void;
  tabs?: TabInfo[];
  onTabSelect?: (tab: TabInfo) => void;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  initialMessageData?: {
    content: string;
    files: any[];
    model: any;
    account: any;
  } | null;
  onClearInitialData?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedTab,
  onBack,
  tabs,
  onTabSelect,
  onLoadConversation,
  initialMessageData,
  onClearInitialData,
}) => {
  // --- States ---
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [isApiUrlReady, setIsApiUrlReady] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentModel, setCurrentModel] = useState<any>(
    () => initialMessageData?.model ?? null,
  );
  const [currentAccount, setCurrentAccount] = useState<any>(
    () => initialMessageData?.account ?? null,
  );

  const { isSimpleMode } = useSettings();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isRestored, setIsRestored] = useState(false);
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  // --- ChatFooter local state ---
  const [message, setMessage] = useState("");
  const storage = extensionService.getStorage();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoredRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const undoIndexRef = useRef<number>(-1);
  const isUndoingRef = useRef(false);
  const [showProjectStructureDrawer, setShowProjectStructureDrawer] =
    useState(false);
  const [showChangesDropdown, setShowChangesDropdown] = useState(false);
  const [showProjectContextModal, setShowProjectContextModal] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const [isBrowserSessionReady, setIsBrowserSessionReady] = useState(false);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);
  const { apiUrl: backendApiUrl } = useBackendConnection();

  // --- Hooks ---
  const {
    messages,
    setMessages,
    messagesRef,
    isProcessing,
    setIsProcessing,
    isStreaming,
    isContinuing,
    incompleteHasPartialTool,
    incompletePartialToolType,
    currentConversationId,
    setCurrentConversationId,
    currentConversationIdRef,
    sendMessage,
    stopGeneration,
    resetSession,
    setBackendConversationId,
    conversationToolOverrides,
    setConversationToolOverrides,
    handleToolAction,
    handleSelectOption,
  } = useChatLLM({
    apiUrl,
    selectedTab,
    onToolRequest: (actions, assistantMessage, isAutoTrigger, actionType) =>
      handleToolRequest(
        actions,
        assistantMessage,
        isAutoTrigger,
        conversationToolOverrides,
        actionType,
      ),
  });

  const { availableFiles, availableFolders, availableRules } =
    useWorkspaceData();

  const {
    showAtMenu,
    setShowAtMenu,
    showMentionDropdown,
    setShowMentionDropdown,
    mentionType,
    setMentionType,
    attachedItems,
    checkMentions,
    handleMentionOptionSelect,
    handleWorkspaceItemSelect,
    handleRuleSelect,
    removeAttachedItem,
    clearAttachedItems,
    addAttachedItem,
  } = useMentionSystem({
    message,
    setMessage,
    textareaRef,
    availableFiles,
    availableFolders,
    onRequestWorkspaceFiles: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFiles" });
      }
    },
    onRequestWorkspaceFolders: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFolders" });
      }
    },
  });

  const {
    uploadedFiles,
    externalFiles,
    fileInputRef,
    externalFileInputRef,
    handlePaste,
    handleFileSelect,
    handleFileInputChange,
    removeFile,
    handleExternalFileSelect,
    handleExternalFileInputChange,
    handleDragOver,
    handleDrop,
    clearFiles,
  } = useFileHandling({
    accountId: currentAccount?.id,
    onAddAttachedItem: (item) => {
      addAttachedItem(item);
      setShowAtMenu(false);
    },
  });

  // --- Refs ---
  const hasProcessedInitial = useRef(false);
  const hasAppendedHistoryContext = useRef(false);
  const wasPaused = useRef(false);
  const isStoppedRef = useRef(false);

  const wrappedSendMessage = useCallback(
    async (
      content: string,
      files?: any[],
      model?: any,
      account?: any,
      skipFirstRequestLogic?: boolean,
      actionIds?: string[],
      uiHidden?: boolean,
    ) => {
      if (!skipFirstRequestLogic) {
        isStoppedRef.current = false;
      }
      setIsRestored(false);
      let finalContent = content;
      const isFromHistory =
        !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
      if (isFromHistory && !hasAppendedHistoryContext.current) {
        hasAppendedHistoryContext.current = true;
        finalContent = content + HISTORY_CONTEXT_REMINDER;
      }
      const parentMsgId = revertParentMessageIdRef.current || undefined;
      revertParentMessageIdRef.current = null;
      if (parentMsgId && currentConversationId) {
        sessionStorage.removeItem(`zen-revert-parent:${currentConversationId}`);
      }
      return sendMessage(
        finalContent,
        files,
        model,
        account,
        skipFirstRequestLogic,
        actionIds,
        uiHidden,
        parentMsgId,
      );
    },
    [sendMessage, selectedTab],
  );

  const {
    executionState,
    toolOutputs,
    setToolOutputs,
    terminalStatus,
    handleToolRequest,
    singleLineReviewActions,
    confirmSingleLineAction,
    rejectSingleLineAction,
  } = useToolExecution({
    conversationIdRef: currentConversationIdRef,
    messagesRef: messagesRef,
    isStoppedRef: isStoppedRef,
    sendMessage: (
      content,
      files,
      model,
      account,
      skipLogic,
      actionIds,
      uiHidden,
    ) =>
      wrappedSendMessage(
        content,
        files,
        model,
        account,
        skipLogic,
        actionIds,
        uiHidden,
      ),
  });

  // Reset hasProcessedInitial whenever a new tab/chat session starts
  useEffect(() => {
    hasProcessedInitial.current = false;
    resetSession();
  }, [selectedTab?.tabId]);

  // --- Memoized Values ---
  const isHistoryMode = useMemo(() => {
    return !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
  }, [selectedTab]);

  const parsedMessages = useMemo(() => {
    return messages.map((msg: Message) => ({
      ...msg,
      parsed: parseAIResponse(msg.content),
    }));
  }, [messages]);

  const contextUsage = useMemo(() => {
    return messages.reduce(
      (acc, msg) => {
        if (msg.isCancelled) return acc;
        if (msg.token_usage) {
          acc.total += msg.token_usage;
          if (msg.usage) {
            acc.prompt += msg.usage.prompt_tokens || 0;
            acc.completion += msg.usage.completion_tokens || 0;
          } else if (msg.role === "user") {
            acc.prompt += msg.token_usage;
          } else {
            acc.completion += msg.token_usage;
          }
        } else if (msg.usage) {
          acc.prompt += msg.usage.prompt_tokens || 0;
          acc.completion += msg.usage.completion_tokens || 0;
          acc.total += msg.usage.total_tokens || 0;
        }
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 },
    );
  }, [messages]);

  const currentTaskName = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      const msg = parsedMessages[i];
      if (msg.isCancelled) continue;
      if (msg.role === "user") break;
      if (msg.role === "assistant" && msg.parsed.taskName)
        return msg.parsed.taskName;
    }
    return null;
  }, [parsedMessages]);

  // --- Terminal Polling ---
  useEffect(() => {
    const fetchTerminals = () => {
      extensionService.postMessage({
        command: "listTerminals",
        requestId: `chat-panel-poll-${Date.now()}`,
      });
    };

    fetchTerminals();
    const interval = setInterval(fetchTerminals, 2000);

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (
        message.command === "listTerminalsResult" &&
        message.requestId?.startsWith("chat-panel-poll-")
      ) {
        if (message.terminals) {
          const allIds = new Set<string>();
          const attachedIds = new Set<string>();
          message.terminals.forEach((t: any) => {
            allIds.add(t.id);
            if (t.isAttached) {
              attachedIds.add(t.id);
            }
          });
          setActiveTerminalIds(allIds);
          setAttachedTerminalIds(attachedIds);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  // --- Effects ---
  useEffect(() => {
    const storage = extensionService.getStorage();
    storage
      .get("backend-api-url")
      .then((res: any) => {
        if (res?.value?.startsWith("http")) {
          const url = res.value.endsWith("/")
            ? res.value.slice(0, -1)
            : res.value;
          setApiUrl(url);
        }
        setIsApiUrlReady(true);
      })
      .catch((err: any) => {
        console.warn(
          "[Zen] ChatPanel failed to load apiUrl from storage:",
          err,
        );
        setIsApiUrlReady(true);
      });
  }, []);

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/v1/providers`)
      .then((r) => r.json())
      .then((res: any) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    if (initialMessageData && !hasProcessedInitial.current && isApiUrlReady) {
      hasProcessedInitial.current = true;
      const modelToSend = initialMessageData.model ?? null;
      const accountToSend = initialMessageData.account ?? null;
      sendMessage(
        initialMessageData.content,
        initialMessageData.files,
        modelToSend,
        accountToSend,
        false,
        undefined,
        undefined,
      );
      onClearInitialData?.();
    }
  }, [initialMessageData, sendMessage, onClearInitialData, isApiUrlReady]);

  // Update ConversationCache
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      const existing = ConversationCache.get(currentConversationId);
      ConversationCache.set(currentConversationId, {
        messages,
        conversationId: currentConversationId,
        backendConversationId: existing?.backendConversationId,
        currentModel: currentModel || existing?.currentModel,
        currentAccount: currentAccount || existing?.currentAccount,
        toolOutputs:
          Object.keys(toolOutputs).length > 0
            ? toolOutputs
            : existing?.toolOutputs,
      });
    }
  }, [
    messages,
    currentConversationId,
    currentModel,
    currentAccount,
    toolOutputs,
  ]);

  // Persist toolOutputs
  useEffect(() => {
    if (!currentConversationId || Object.keys(toolOutputs).length === 0) return;
    const tabId = selectedTab?.tabId || -1;
    const folderPath = selectedTab?.folderPath || null;
    saveConversation(
      tabId,
      folderPath,
      messages,
      currentConversationId,
      selectedTab || undefined,
      true,
      undefined,
      undefined,
      toolOutputs,
    );
  }, [toolOutputs, currentConversationId]);

  // Persist singleLineReviewActions
  useEffect(() => {
    if (
      !currentConversationId ||
      Object.keys(singleLineReviewActions).length === 0
    )
      return;
    const tabId = selectedTab?.tabId || -1;
    const folderPath = selectedTab?.folderPath || null;
    saveConversation(
      tabId,
      folderPath,
      messages,
      currentConversationId,
      selectedTab || undefined,
      true,
      undefined,
      undefined,
      undefined,
      singleLineReviewActions,
    );
  }, [singleLineReviewActions, currentConversationId]);

  // Load conversation
  useEffect(() => {
    const load = async () => {
      if (!selectedTab) {
        if (currentConversationIdRef.current) {
          return;
        }
        setMessages([]);
        setIsLoadingConversation(false);
        setIsProcessing(false);
        setIsRestored(false);
        return;
      }
      setIsLoadingConversation(true);
      setIsRestored(false);
      hasAppendedHistoryContext.current = false;
      const convId = (selectedTab as any).conversationId;
      if (convId) {
        const cached = ConversationCache.get(convId);
        if (cached) {
          setMessages(cached.messages);
          if (
            cached.toolOutputs &&
            Object.keys(cached.toolOutputs).length > 0
          ) {
            setToolOutputs(cached.toolOutputs);
          }
          if (
            cached.singleLineReviewActions &&
            Object.keys(cached.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: cached.singleLineReviewActions,
              },
              "*",
            );
          }
          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${convId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;
          setIsRestored(cached.messages.length > 0);
          currentConversationIdRef.current = cached.conversationId;
          setCurrentConversationId(cached.conversationId);
          if (cached.backendConversationId) {
            setBackendConversationId(cached.backendConversationId);
          }
          if (cached.currentModel) {
            setCurrentModel(cached.currentModel);
          }
          if (cached.currentAccount) {
            setCurrentAccount(cached.currentAccount);
          }
          setIsLoadingConversation(false);
          return;
        }

        const requestId = `conv-${Date.now()}`;
        extensionService.postMessage({
          command: "getConversation",
          conversationId: convId,
          requestId,
        });
      } else {
        setMessages([]);
        setCurrentConversationId("");
        setIsLoadingConversation(false);
      }
    };
    load();
  }, [selectedTab?.tabId, (selectedTab as any)?.conversationId]);

  // Handle incoming messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "conversationResult") {
        if (data.data?.messages) {
          const restoredMessages = data.data.messages.map(
            (msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            }),
          );
          setMessages(restoredMessages);

          if (
            data.data.toolOutputs &&
            Object.keys(data.data.toolOutputs).length > 0
          ) {
            setToolOutputs(data.data.toolOutputs);
          }

          if (
            data.data.singleLineReviewActions &&
            Object.keys(data.data.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: data.data.singleLineReviewActions,
              },
              "*",
            );
          }

          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${data.data?.conversationId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;

          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
            currentConversationIdRef.current = data.data.conversationId;
            setCurrentConversationId(data.data.conversationId);

            const lastMsgWithBackendId = [...restoredMessages]
              .reverse()
              .find((m: Message) => m.conversationId);
            const backendIdFromMsg = lastMsgWithBackendId?.conversationId;
            const lastAssistantWithMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );
            const restoredMeta = lastAssistantWithMeta
              ? {
                  providerId: lastAssistantWithMeta.providerId,
                  modelId: lastAssistantWithMeta.modelId,
                  accountId: lastAssistantWithMeta.accountId,
                }
              : undefined;
            const backendIdToUse =
              backendIdFromMsg ||
              data.data.backendConversationId ||
              data.data.conversationId;
            setBackendConversationId(backendIdToUse, restoredMeta);

            const lastAssistantMsgForMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );
            let modelToCache: any = undefined;
            let accountToCache: any = undefined;
            if (lastAssistantMsgForMeta) {
              modelToCache = {
                providerId: lastAssistantMsgForMeta.providerId!,
                id: lastAssistantMsgForMeta.modelId!,
                name: lastAssistantMsgForMeta.modelId!,
              };
              accountToCache = {
                id: lastAssistantMsgForMeta.accountId!,
                email: lastAssistantMsgForMeta.email!,
              };
              setCurrentModel(modelToCache);
              setCurrentAccount(accountToCache);
            }
            ConversationCache.set(data.data.conversationId, {
              messages: restoredMessages,
              conversationId: data.data.conversationId,
              backendConversationId: backendIdToUse,
              currentModel: modelToCache,
              currentAccount: accountToCache,
            });
          }
        }
        setIsLoadingConversation(false);
        setIsProcessing(false);
      } else if (
        data.command === "clearChatConfirmed" &&
        data.conversationId === currentConversationId
      ) {
        handleClearConfirmed();
      } else if (
        data.command === "conversationReverted" &&
        data.conversationId === currentConversationId
      ) {
        const targetId = revertMessageIdRef.current;
        revertMessageIdRef.current = null;
        if (targetId === "__first__") {
          deleteConversation(currentConversationId);
          const firstUserMsg = messagesRef.current.find(
            (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
          );
          let content = firstUserMsg?.content || "";
          const match = content.match(
            /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
          );
          if (match) content = match[1];
          setMessages([]);
          setIsLoadingConversation(false);
          onBack(content);
        } else {
          setMessages((prev) => {
            const idx = targetId
              ? prev.findIndex((m) => m.id === targetId)
              : -1;
            if (idx === -1) return prev;
            const msg = prev[idx];
            const match = msg.content.match(
              /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
            );
            const content = match ? match[1] : msg.content;
            const prevAssistant = [...prev.slice(0, idx)]
              .reverse()
              .find((m) => m.role === "assistant");
            revertParentMessageIdRef.current =
              prevAssistant?.response_message_id || null;
            if (revertParentMessageIdRef.current) {
              sessionStorage.setItem(
                `zen-revert-parent:${currentConversationId}`,
                revertParentMessageIdRef.current,
              );
            } else {
              sessionStorage.removeItem(
                `zen-revert-parent:${currentConversationId}`,
              );
            }
            setRevertInput({ value: content, nonce: Date.now() });
            const reverted = prev.slice(0, idx);
            const existing = ConversationCache.get(currentConversationId);
            ConversationCache.set(currentConversationId, {
              messages: reverted,
              conversationId: currentConversationId,
              backendConversationId: existing?.backendConversationId,
              currentModel: existing?.currentModel,
              currentAccount: existing?.currentAccount,
            });
            return reverted;
          });
          setIsLoadingConversation(false);
          setIsProcessing(false);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [currentConversationId]);

  // --- ChatFooter draft restore ---
  useEffect(() => {
    if (!currentConversationId) return;
    isDraftRestoredRef.current = false;
    storage
      .get(`draft:${currentConversationId}`)
      .then((res: any) => {
        if (res?.value && !isDraftRestoredRef.current && !revertInput?.value) {
          setMessage(res.value);
          undoStackRef.current = [res.value];
          undoIndexRef.current = 0;
        }
        isDraftRestoredRef.current = true;
      })
      .catch(() => {
        isDraftRestoredRef.current = true;
      });
  }, [currentConversationId]);

  // Debounce-save draft
  useEffect(() => {
    if (!currentConversationId || !isDraftRestoredRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (message.trim()) {
        storage.set(`draft:${currentConversationId}`, message).catch(() => {});
      } else {
        storage.delete(`draft:${currentConversationId}`).catch(() => {});
      }
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [message, currentConversationId]);

  useEffect(() => {
    if (revertInput?.value !== undefined) {
      setMessage(revertInput.value || "");
      undoStackRef.current = revertInput.value ? [revertInput.value] : [];
      undoIndexRef.current = revertInput.value ? 0 : -1;
    }
  }, [revertInput?.value, revertInput?.nonce]);

  // --- ChatFooter handlers ---
  const handleSend = (model: any, account: any) => {
    if (
      message.trim() ||
      uploadedFiles.length > 0 ||
      attachedItems.length > 0
    ) {
      wrappedSendMessage(
        message,
        [...uploadedFiles, ...attachedItems],
        model || currentModel,
        account || currentAccount,
        undefined,
        undefined,
        undefined,
      );
      setMessage("");
      if (currentConversationId)
        storage.delete(`draft:${currentConversationId}`).catch(() => {});
      clearFiles();
      clearAttachedItems();
      undoStackRef.current = [];
      undoIndexRef.current = -1;
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (!isUndoingRef.current) {
      const newStack = undoStackRef.current.slice(0, undoIndexRef.current + 1);
      newStack.push(value);
      undoStackRef.current = newStack;
      undoIndexRef.current = newStack.length - 1;
    }
    setMessage(value);
    checkMentions(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
    const isRedo =
      ((e.ctrlKey || e.metaKey) && e.key === "y") ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z");

    if (isUndo) {
      e.preventDefault();
      if (undoIndexRef.current > 0) {
        isUndoingRef.current = true;
        undoIndexRef.current -= 1;
        const prev = undoStackRef.current[undoIndexRef.current];
        setMessage(prev);
        checkMentions(prev);
        isUndoingRef.current = false;
      } else if (undoIndexRef.current === 0) {
        isUndoingRef.current = true;
        undoIndexRef.current = -1;
        setMessage("");
        checkMentions("");
        isUndoingRef.current = false;
      }
      return;
    }

    if (isRedo) {
      e.preventDefault();
      if (undoIndexRef.current < undoStackRef.current.length - 1) {
        isUndoingRef.current = true;
        undoIndexRef.current += 1;
        const next = undoStackRef.current[undoIndexRef.current];
        setMessage(next);
        checkMentions(next);
        isUndoingRef.current = false;
      }
      return;
    }
  };

  const handleOpenImage = (file: any) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openTempImage",
        content: file.content,
        filename: file.name,
      });
    }
  };

  const checkBrowserSession = useCallback(async () => {
    if (!currentModel || currentModel.providerId !== "zai-browser") {
      setIsBrowserSessionReady(true);
      setShowBrowserWarning(false);
      return;
    }
    if (!currentAccount?.id) {
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
      return;
    }
    try {
      const response = await fetch(
        `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
      );
      const result = await response.json();
      if (result.success && result.data) {
        if (result.data.has_profile && result.data.is_running) {
          setIsBrowserSessionReady(true);
          setShowBrowserWarning(false);
        } else {
          setIsBrowserSessionReady(false);
          setShowBrowserWarning(true);
        }
      } else {
        setIsBrowserSessionReady(false);
        setShowBrowserWarning(true);
      }
    } catch (error) {
      console.error("Failed to check browser session:", error);
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
    }
  }, [currentModel, currentAccount, backendApiUrl]);

  const launchBrowserSession = async () => {
    if (!currentModel || !currentAccount) return;
    setIsLaunchingBrowser(true);
    try {
      const response = await fetch(
        `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const result = await response.json();
      if (result.success) {
        setIsBrowserSessionReady(true);
        setShowBrowserWarning(false);
      } else {
        console.error("Failed to launch browser:", result.message);
      }
    } catch (error) {
      console.error("Failed to launch browser:", error);
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  useEffect(() => {
    checkBrowserSession();
  }, [checkBrowserSession]);

  useEffect(() => {
    if (
      !currentModel ||
      currentModel.providerId !== "zai-browser" ||
      !currentAccount?.id
    )
      return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
        );
        const result = await response.json();
        if (result.success && result.data) {
          const isRunning = result.data.is_running === true;
          setIsBrowserSessionReady(isRunning);
          setShowBrowserWarning(!isRunning);
        }
      } catch (error) {
        console.error("Polling browser status failed:", error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentModel, currentAccount?.id, backendApiUrl]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        240,
      )}px`;
    }
  }, [message]);

  // Click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showAtMenu) {
        const menu = document.querySelector('[data-at-menu="true"]');
        if (menu && !menu.contains(target) && target !== textareaRef.current) {
          setShowAtMenu(false);
        }
      }
      if (showMentionDropdown) {
        const dropdown = document.querySelector(
          '[data-mention-dropdown="true"]',
        );
        if (dropdown && !dropdown.contains(target)) {
          setShowMentionDropdown(false);
          setMentionType(null);
        }
      }
    };
    if (showAtMenu || showMentionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAtMenu, showMentionDropdown]);

  // Load Project Context
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "projectContextResponse") {
        setProjectContext(message.context);
      } else if (message.command === "addAttachedItem") {
        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);
        addAttachedItem({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // --- Handlers ---
  const handleClearChat = useCallback(() => {
    extensionService.postMessage({
      command: "confirmClearChat",
      conversationId: currentConversationId,
    });
  }, [currentConversationId]);

  const revertMessageIdRef = useRef<string | null>(null);

  const handleRevertConversation = useCallback(
    (messageId: string, timestamp: number) => {
      if (!currentConversationId) return;
      const visibleUserMessages = messagesRef.current.filter(
        (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
      );
      const isFirstMessage =
        visibleUserMessages.length > 0 &&
        visibleUserMessages[0].id === messageId;
      revertMessageIdRef.current = isFirstMessage ? "__first__" : messageId;
      setIsLoadingConversation(true);
      extensionService.postMessage({
        command: "revertConversation",
        conversationId: currentConversationId,
        messageId,
        timestamp,
      });
    },
    [currentConversationId, messagesRef],
  );

  const handleClearConfirmed = async () => {
    if (selectedTab) {
      await deleteConversation(currentConversationId);
      setMessages([]);
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  };

  const handleStopGeneration = useCallback(() => {
    isStoppedRef.current = true;
    stopGeneration();
    setIsProcessing(false);
    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reduceRight(
        (found, m, i) =>
          found === -1 && m.role === "assistant" && !m.isCancelled ? i : found,
        -1,
      );
      if (lastAssistantIdx === -1) return prev;
      const updated = [...prev];
      updated[lastAssistantIdx] = {
        ...updated[lastAssistantIdx],
        isCancelled: true,
      };
      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;
      saveConversation(
        tabId,
        folderPath,
        updated,
        currentConversationId,
        selectedTab || undefined,
        true,
      );
      return updated;
    });
  }, [
    stopGeneration,
    setIsProcessing,
    setMessages,
    selectedTab,
    currentConversationId,
  ]);

  const firstRequestMessage = messages.find((m) => m.role === "user");

  const enrichedModel = useMemo(() => {
    if (!currentModel) return null;
    if (!Array.isArray(providers)) return currentModel;
    const providerData = providers.find(
      (p: any) => p.provider_id === currentModel.providerId,
    );
    const modelData = providerData?.models?.find(
      (m: any) => m.id === currentModel.id,
    );
    if (!modelData) return currentModel;
    return { ...currentModel, ...modelData };
  }, [currentModel, providers]);

  // ChatHeader helpers
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId =
    currentModel?.providerId || selectedTab?.provider || "deepseek";
  let faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  else if (providerId.toLowerCase().includes("anthropic"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  else if (providerId.toLowerCase().includes("google"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  else if (providerId.toLowerCase().includes("openrouter"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";

  const totalTokens = contextUsage?.total ?? 0;
  const footerPaddingBottom =
    showBrowserWarning && currentModel?.providerId === "zai-browser"
      ? "20px"
      : "8px";

  return (
    <div
      className="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        color: "var(--vscode-editor-foreground)",
      }}
    >
      {/* ─── ChatHeader (inlined) ─── */}
      <div
        style={{
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--primary-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--primary-text)",
              overflow: "hidden",
            }}
          >
            <img
              src={faviconUrl}
              alt="provider"
              style={{ width: "14px", height: "14px", borderRadius: "2px" }}
            />
            <span style={{ whiteSpace: "nowrap" }}>
              {providerId}/{currentModel?.id || "chat"}
            </span>
            {currentAccount?.email && (
              <span
                style={{
                  opacity: 0.7,
                  fontStyle: "italic",
                  fontWeight: "normal",
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "150px",
                }}
                title={currentAccount.email}
              >
                {currentAccount.email}
              </span>
            )}
            {currentTaskName && (
              <>
                <span style={{ opacity: 0.3 }}>|</span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: "var(--vscode-textLink-foreground)",
                    fontWeight: 500,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      backgroundColor: "currentColor",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {currentTaskName}
                  </span>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.8,
              }}
            >
              {contextUsage ? formatTokens(contextUsage.total) : "0"}
            </span>
            <button
              onClick={() => {
                setIsSearchOpen((v) => !v);
                if (isSearchOpen) setSearchQuery("");
              }}
              title="Search in chat"
              style={{
                background: isSearchOpen
                  ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                  : "transparent",
                border: isSearchOpen
                  ? "1px solid color-mix(in srgb, var(--vscode-button-background) 40%, transparent)"
                  : "1px solid transparent",
                cursor: "pointer",
                padding: "3px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSearchOpen
                  ? "var(--vscode-button-background, var(--vscode-textLink-foreground))"
                  : "var(--vscode-icon-foreground, var(--secondary-text))",
                opacity: isSearchOpen ? 1 : 0.65,
                borderRadius: "4px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSearchOpen) e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                if (!isSearchOpen) e.currentTarget.style.opacity = "0.65";
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m13 13.5 2-2.5-2-2.5" />
                <path d="m21 21-4.3-4.3" />
                <path d="M9 8.5 7 11l2 2.5" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ─── ChatBody ─── */}
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
        isContinuing={isContinuing}
        incompleteHasPartialTool={incompleteHasPartialTool}
        incompletePartialToolType={incompletePartialToolType}
        isSimpleMode={isSimpleMode}
        onSendToolRequest={(actions, msg, isAuto, type) =>
          handleToolRequest(
            actions,
            msg,
            isAuto,
            conversationToolOverrides,
            type,
          )
        }
        onSendMessage={(c, f, m, a, skip, ids, hidden) =>
          wrappedSendMessage(c, f, m, a, skip, ids, hidden)
        }
        executionState={executionState}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        firstRequestMessageId={firstRequestMessage?.id}
        onLoadConversation={onLoadConversation}
        activeTerminalIds={activeTerminalIds}
        attachedTerminalIds={attachedTerminalIds}
        conversationId={currentConversationId}
        onToolAction={handleToolAction}
        onSelectOption={handleSelectOption}
        isRestored={isRestored}
        onContinue={() => setIsRestored(false)}
        hasInitialMessage={!!initialMessageData}
        onRevertConversation={handleRevertConversation}
        onAutoScrollPausedChange={setAutoScrollPaused}
        scrollToBottomRef={scrollToBottomRef}
        singleLineReviewActions={singleLineReviewActions}
        onConfirmSingleLineAction={confirmSingleLineAction}
        onRejectSingleLineAction={rejectSingleLineAction}
        isSearchOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onCloseSearch={() => {
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
      />

      {/* ─── ChatFooter (inlined) ─── */}
      <div
        id="chat-footer-container"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          backgroundColor: "var(--secondary-bg)",
          zIndex: 100,
          transition: "bottom 0.2s ease",
          paddingBottom: footerPaddingBottom,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          accept="image/*,text/*"
        />
        <input
          ref={externalFileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleExternalFileInputChange}
        />

        <FilesPreviews
          uploadedFiles={uploadedFiles}
          attachedItems={attachedItems}
          onRemoveFile={removeFile}
          onRemoveAttachedItem={removeAttachedItem}
          onOpenImage={handleOpenImage}
          onAttachedItemClick={(item) => {
            const vscodeApi = (window as any).vscodeApi;
            if (!vscodeApi) return;
            if (item.type === "file") {
              vscodeApi.postMessage({
                command: "openWorkspaceFile",
                path: item.path,
              });
            } else if (item.type === "folder") {
              vscodeApi.postMessage({
                command: "openWorkspaceFolder",
                path: item.path,
              });
            } else if (item.type === ("terminal" as any)) {
              vscodeApi.postMessage({
                command: "focusTerminal",
                terminalId: item.path,
              });
            }
          }}
        />

        <div style={{ position: "relative" }}>
          <MessageInput
            message={message}
            setMessage={setMessage}
            isHistoryMode={isHistoryMode}
            uploadedFiles={uploadedFiles}
            textareaRef={textareaRef}
            handleTextareaChange={handleTextareaChange}
            handleKeyDown={handleKeyDown}
            handlePaste={handlePaste}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            setShowAtMenu={setShowAtMenu}
            handleFileSelect={handleFileSelect}
            onOpenProjectStructure={() => setShowProjectStructureDrawer(true)}
            showChangesDropdown={showChangesDropdown}
            setShowChangesDropdown={setShowChangesDropdown}
            messages={messages}
            handleSend={handleSend}
            hasProjectContext={!!projectContext}
            onOpenProjectContext={() => setShowProjectContextModal(true)}
            folderPath={selectedTab?.folderPath || null}
            isConversationStarted={messages.length > 0 || !!initialMessageData}
            currentModel={enrichedModel ?? currentModel}
            setCurrentModel={setCurrentModel}
            currentAccount={currentAccount}
            setCurrentAccount={setCurrentAccount}
            isProcessing={isProcessing || executionState.status === "running"}
            isStreaming={isStreaming}
            onStopGeneration={handleStopGeneration}
            showBrowserWarning={showBrowserWarning}
            isLaunchingBrowser={isLaunchingBrowser}
            onLaunchBrowserSession={launchBrowserSession}
          />
          <MentionDropdowns
            showAtMenu={showAtMenu}
            showMentionDropdown={showMentionDropdown}
            mentionType={mentionType}
            availableFiles={availableFiles}
            availableFolders={availableFolders}
            availableRules={availableRules}
            message={message}
            handleMentionOptionSelect={handleMentionOptionSelect}
            handleExternalFileSelect={handleExternalFileSelect}
            handleWorkspaceItemSelect={handleWorkspaceItemSelect}
            handleRuleSelect={handleRuleSelect}
            mentionDropdownRef={mentionDropdownRef}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
