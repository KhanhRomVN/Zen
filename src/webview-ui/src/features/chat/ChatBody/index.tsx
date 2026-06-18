import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  parseAIResponse,
  ParsedResponse,
} from "../../../services/ResponseParser";
import { Message, ChatBodyProps } from "./types";

// ─── SearchBar Component ──────────────────────────────────────────────────────
interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
  bodyRef: React.RefObject<HTMLDivElement>;
}

type SearchFlag = "matchCase" | "wholeWord" | "regex";

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery: initialQuery, onSearchQueryChange, onCloseSearch, bodyRef }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local query state — not controlled by parent to avoid re-render issues
  const [localQuery, setLocalQuery] = useState(initialQuery || "");
  const [flags, setFlags] = useState<Set<SearchFlag>>(new Set<SearchFlag>(["regex"]));
  const [matchCount, setMatchCount] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleQueryChange = (q: string) => {
    setLocalQuery(q);
    onSearchQueryChange?.(q);
  };

  const toggleFlag = (f: SearchFlag) => {
    setFlags(prev => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  // Build regex from query + flags
  const buildRegex = useCallback((q: string): RegExp | null => {
    if (!q) return null;
    try {
      const isRegex = flags.has("regex");
      const pattern = isRegex ? q : (flags.has("wholeWord") ? `\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b` : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const regexFlags = flags.has("matchCase") ? "g" : "gi";
      return new RegExp(pattern, regexFlags);
    } catch { return null; }
  }, [flags]);

  // Highlight effect — runs when query, flags, or body content changes
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;

    // Remove previous highlights
    const prev = root.querySelectorAll("mark.zen-search-hl");
    prev.forEach(el => {
      const parent = el.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(el.textContent || ""), el); parent.normalize(); }
    });

    const regex = buildRegex(localQuery);
    if (!regex) { setMatchCount(0); setCurrentIdx(0); return; }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
        if (p.closest("mark.zen-search-hl")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);

    let total = 0;
    nodes.forEach(textNode => {
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
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "zen-search-hl";
        mark.dataset.matchIdx = String(total++);
        mark.textContent = m[0];
        mark.style.cssText = "background:var(--vscode-editor-findMatchHighlightBackground,rgba(255,255,0,0.35));color:inherit;border-radius:2px;padding:0 1px;";
        frag.appendChild(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      parent.replaceChild(frag, textNode);
    });

    setMatchCount(total);
    setCurrentIdx(total > 0 ? 1 : 0);
  }, [localQuery, flags, buildRegex, bodyRef]);

  // Navigate matches
  const navigate = (dir: 1 | -1) => {
    if (matchCount === 0) return;
    const root = bodyRef.current;
    if (!root) return;
    const marks = root.querySelectorAll("mark.zen-search-hl");
    // Remove current focus style
    marks.forEach(m => { (m as HTMLElement).style.background = "var(--vscode-editor-findMatchHighlightBackground,rgba(255,255,0,0.35))"; (m as HTMLElement).style.outline = ""; });
    const next = ((currentIdx - 1 + dir + matchCount) % matchCount) + 1;
    setCurrentIdx(next);
    const target = marks[next - 1] as HTMLElement | undefined;
    if (target) {
      target.style.background = "var(--vscode-editor-findMatchBackground,rgba(255,165,0,0.6))";
      target.style.outline = "1px solid var(--vscode-editor-findMatchBorder,orange)";
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const iconBtn = (active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)" : "transparent",
        border: active ? "1px solid color-mix(in srgb, var(--vscode-button-background) 45%, transparent)" : "1px solid transparent",
        color: active ? "var(--vscode-button-background)" : "var(--vscode-icon-foreground)",
        cursor: "pointer", padding: "2px 4px", borderRadius: "3px",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: active ? 1 : 0.6,
        transition: "all 0.12s ease", flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.opacity = "0.6"; }}
    >
      {children}
    </button>
  );

  const inputBorderStyle = "1px solid var(--vscode-input-border, var(--border-color))";
  const inputBg = "var(--vscode-input-background, var(--primary-bg))";

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100, alignSelf: "flex-end",
      display: "inline-flex", alignItems: "center", gap: "4px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.32)", marginBottom: "6px",
      backgroundColor: "var(--vscode-editorWidget-background, var(--vscode-input-background, var(--primary-bg)))",
      border: "1px solid var(--vscode-editorWidget-border, var(--vscode-input-border, var(--border-color)))",
      borderRadius: "6px", padding: "3px 4px",
    }}>

      {/* Inner wrapper: left=input, right=flag icons — same background, no gap */}
      <div style={{
        display: "flex", alignItems: "stretch",
        overflow: "hidden",
        backgroundColor: inputBg,
        borderRadius: "3px",
      }}>
        {/* Left: text input — same bg as right panel */}
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Search"
          onKeyDown={e => {
            if (e.key === "Escape") { onCloseSearch?.(); }
            else if (e.key === "Enter") { navigate(e.shiftKey ? -1 : 1); }
          }}
          style={{
            background: inputBg, border: "none", outline: "none",
            color: "var(--vscode-input-foreground)",
            fontSize: "12px", padding: "4px 6px", width: "180px",
            fontFamily: "var(--vscode-font-family, sans-serif)",
          }}
        />
        {/* Right: 3 toggle icons, separated by left border — same bg */}
        <div style={{
          display: "flex", alignItems: "center", gap: "1px", padding: "2px 4px",
          borderLeft: inputBorderStyle,
          backgroundColor: inputBg,
        }}>
          {/* Match Case: Aa */}
          {iconBtn(flags.has("matchCase"), "Match Case (Alt+C)", () => toggleFlag("matchCase"),
            <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "monospace", lineHeight: 1 }}>Aa</span>
          )}
          {/* Whole Word: [ ab ] */}
          {iconBtn(flags.has("wholeWord"), "Match Whole Word (Alt+W)", () => toggleFlag("wholeWord"),
            <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "-0.5px", lineHeight: 1 }}>ab</span>
          )}
          {/* Regex: .* */}
          {iconBtn(flags.has("regex"), "Use Regular Expression (Alt+R)", () => toggleFlag("regex"),
            <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "monospace", lineHeight: 1 }}>.*</span>
          )}
        </div>
      </div>

      {/* Match counter + navigation + close */}
      <span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", whiteSpace: "nowrap", minWidth: "72px", textAlign: "center", userSelect: "none" }}>
        {localQuery
          ? (matchCount === 0 ? "No results" : `${currentIdx} of ${matchCount}`)
          : "\u00A0"}
      </span>

      {/* Arrow up */}
      <button
        title="Previous match (Shift+Enter)"
        onClick={() => navigate(-1)}
        disabled={matchCount === 0}
        style={{ background: "transparent", border: "none", cursor: matchCount > 0 ? "pointer" : "default", color: "var(--vscode-icon-foreground)", padding: "2px 3px", opacity: matchCount > 0 ? 0.7 : 0.3, display: "flex", alignItems: "center" }}
        onMouseEnter={e => { if (matchCount > 0) e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={e => { if (matchCount > 0) e.currentTarget.style.opacity = "0.7"; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
      </button>

      {/* Arrow down */}
      <button
        title="Next match (Enter)"
        onClick={() => navigate(1)}
        disabled={matchCount === 0}
        style={{ background: "transparent", border: "none", cursor: matchCount > 0 ? "pointer" : "default", color: "var(--vscode-icon-foreground)", padding: "2px 3px", opacity: matchCount > 0 ? 0.7 : 0.3, display: "flex", alignItems: "center" }}
        onMouseEnter={e => { if (matchCount > 0) e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={e => { if (matchCount > 0) e.currentTarget.style.opacity = "0.7"; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {/* Close X */}
      <button
        title="Close (Esc)"
        onClick={() => { handleQueryChange(""); onCloseSearch?.(); }}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--vscode-icon-foreground)", padding: "2px 3px", opacity: 0.55, display: "flex", alignItems: "center", transition: "opacity 0.12s" }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "0.55"; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

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
  singleLineReviewActions?: Record<string, { action: any; actionId: string; messageId: string }>;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  isSearchOpen?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
}

// Hooks
import { useCollapseSections } from "./hooks/useCollapseSections";
import { useToolActions } from "./hooks/useToolActions";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { useSettings } from "../../../context/SettingsContext";
import { getPermissionDecision } from "../../../hooks/useToolExecution";

import WelcomeUI from "../../HomePanel/WelcomeUI";
import ProcessingIndicator from "./components/ProcessingIndicator";
import ScrollToBottomButton from "./components/ScrollToBottomButton";
import MessageBox from "./components/MessageBox";

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

  // Persistent parse cache across renders — keyed by message content.
  // This avoids re-running marked.parse() on old messages every time a new
  // streaming chunk arrives and changes the messages array reference.
  const parseCacheRef = useRef<Map<string, ParsedResponse>>(new Map());

  // Memoize parsed messages — only re-parses messages whose content changed
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

  // Hooks
  const { collapsedSections, toggleCollapse, setInitiallyCollapsed } =
    useCollapseSections();
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

  // Notify parent of pause state changes
  const prevPausedRef = useRef(false);
  useEffect(() => {
    if (autoScrollPaused !== prevPausedRef.current) {
      prevPausedRef.current = autoScrollPaused;
      onAutoScrollPausedChange?.(autoScrollPaused);
    }
  }, [autoScrollPaused, onAutoScrollPausedChange]);

  // Expose scrollToBottom to parent
  useEffect(() => {
    if (scrollToBottomRef) scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom, scrollToBottomRef]);

  const hasUnexecutedAutoActions = useMemo(() => {
    if (!isRestored || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const parsed = parseAIResponse(lastMessage.content);
    if (!parsed.actions || parsed.actions.length === 0) return false;

    // Find the very first pending action in the list
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

    // Determine if this first pending action is visible to the user
    const isVisible =
      !isSimpleMode ||
      [
        "write_to_file",
        "replace_in_file",
        "run_command",
        "execute_agent_action",
      ].includes(firstPendingAction.type);

    // If it's visible, the user can interact with it directly via its 3 buttons,
    // so we don't need to show the "Continue Task" button.
    if (isVisible) return false;

    // If it's invisible, we show the "Continue Task" button ONLY if it is auto-runnable
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

  // 🆕 Debug logging and filtering logic
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((message) => {
      if (message.uiHidden || message.isCancelled) {
        return false;
      }
      return true;
    });
    return filtered;
  }, [messages, firstRequestMessageId]);

  // Find the index of the last assistant message (it might not be the literal last if followed by user input)
  // This ensures tools in that assistant block remain interactive.
  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  // Detect if assistant is currently streaming content
  const isResponding = useMemo(() => {
    if (!isProcessing || visibleMessages.length === 0) return false;
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    if (lastMessage.role !== "assistant") return false;

    const parsedMessage = parsedMessages.find((pm) => pm.id === lastMessage.id);
    if (!parsedMessage) return false;

    const parsed = parsedMessage.parsed;
    // Check if there's any content being streamed
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

  // Auto-focus search input when search opens — handled inside SearchBar component

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
      {/* Search bar — sticky top-right, VS Code style */}
      {isSearchOpen && (
        <SearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onCloseSearch={onCloseSearch}
          bodyRef={bodyRef}
        />
      )}

      {visibleMessages.length === 0 && !isProcessing && !hasInitialMessage && (
        <WelcomeUI onLoadConversation={onLoadConversation} />
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
          {/* Dot indicator */}
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

      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
};

export default ChatBody;
