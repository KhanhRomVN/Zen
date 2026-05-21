import React, { useState } from "react";
import { Message } from "../types";
import { ParsedResponse } from "../../../../services/ResponseParser";
import MessageBox from "./MessageBox";

interface ProcessGroupProps {
  messages: Message[];
  parsedMap: Map<string, ParsedResponse>;
  clickedActions: Set<string>;
  failedActions?: Set<string>;
  onToolClick: (action: any, message: Message, index: number, type: "accept_all" | "accept_once" | "reject") => void;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  allMessages: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  onSendMessage?: (...args: any[]) => void;
  onSelectOption?: (messageId: string, option: string) => void;
  executionState?: any;
  previousAssistantMessage?: Message;
}

const ProcessGroup: React.FC<ProcessGroupProps> = ({
  messages, parsedMap, clickedActions, failedActions, onToolClick,
  toolOutputs, terminalStatus, allMessages, activeTerminalIds,
  attachedTerminalIds, conversationId, onSendMessage, onSelectOption,
  executionState, previousAssistantMessage,
}) => {
  const [expanded, setExpanded] = useState(false);

  const toolCount = messages.reduce((acc, msg) => {
    const parsed = parsedMap.get(msg.id);
    return acc + (parsed?.actions?.length || 0);
  }, 0);

  const stepCount = messages.filter(m => m.role === "assistant").length;

  // First assistant in the group — its metadata renders outside
  const firstAssistant = messages.find(m => m.role === "assistant");

  // Render metadata dot outside the collapsible box
  const renderMetadata = () => {
    if (!firstAssistant) return null;
    const metaChanged =
      !previousAssistantMessage ||
      firstAssistant.conversationId !== previousAssistantMessage.conversationId ||
      firstAssistant.providerId !== previousAssistantMessage.providerId ||
      firstAssistant.modelId !== previousAssistantMessage.modelId ||
      firstAssistant.accountId !== previousAssistantMessage.accountId ||
      firstAssistant.email !== previousAssistantMessage.email;

    if (!metaChanged || !(firstAssistant.providerId || firstAssistant.modelId || firstAssistant.email)) {
      return null;
    }

    const providerStr = firstAssistant.providerId ? `${firstAssistant.providerId}/` : "";
    const modelStr = firstAssistant.modelId || "unknown-model";
    const emailStr = firstAssistant.email ? ` by ${firstAssistant.email}` : "";

    let faviconUrl: string | undefined;
    if (firstAssistant.websiteUrl) {
      try { faviconUrl = `${new URL(firstAssistant.websiteUrl).origin}/favicon.ico`; } catch {}
    }

    return (
      <div style={{ paddingBottom: "8px" }}>
        <div className="timeline-dot" style={{ backgroundColor: "transparent", top: "10px", display: "flex", alignItems: "center", justifyContent: "center", border: "none" }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt="favicon" style={{ width: "16px", height: "16px", borderRadius: "2px" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span className="codicon codicon-server-process" style={{ color: "var(--vscode-descriptionForeground)", fontSize: "14px" }} />
          )}
        </div>
        <div style={{ paddingLeft: "29px", paddingTop: "4px", fontSize: "var(--font-size-sm)", color: "var(--vscode-descriptionForeground)", fontStyle: "italic", display: "flex", alignItems: "center", gap: "6px" }}>
          {`Used ${providerStr}${modelStr}${emailStr}`}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: "8px" }}>
      {renderMetadata()}

      {/* Collapsed dot header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "4px 0", userSelect: "none" }}
      >
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#3fb950", flexShrink: 0, boxShadow: "0 0 0 2px var(--secondary-bg), 0 0 0 3px #3fb95060" }} />
        <span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
          {stepCount} step{stepCount !== 1 ? "s" : ""}, {toolCount} action{toolCount !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: "11px", color: "var(--vscode-textLink-foreground)", marginLeft: "4px" }}>
          {expanded ? "▲ hide" : "▼ show"}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderLeft: "2px solid #3fb95040", marginLeft: "4px", paddingLeft: "16px", marginTop: "4px" }}>
          {messages.map((msg, i) => {
            const parsed = parsedMap.get(msg.id);
            if (!parsed) return null;
            // Suppress short markdown prefix text in messages that also have tools
            // (e.g. "I'll scan the codebase structure." before tool calls)
            const hasTools = (parsed.actions?.length || 0) > 0;
            const filteredParsed = hasTools ? {
              ...parsed,
              contentBlocks: parsed.contentBlocks?.filter((b: any) => {
                if (b.type === "markdown" && b.content.trim().length < 150) return false;
                if (b.type === "mixed_content") {
                  // filter out short markdown segments
                  const filtered = b.segments?.filter((s: any) => !(s.type === "markdown" && s.content.trim().length < 150));
                  return filtered?.length > 0;
                }
                return true;
              }),
              displayText: parsed.displayText && parsed.displayText.trim().length < 150 ? "" : parsed.displayText,
            } : parsed;
            // Pass the message itself as previousAssistantMessage for the first assistant
            // so MessageBox won't re-render the metadata dot inside
            const prevForBox = msg.role === "assistant" && msg.id === firstAssistant?.id
              ? msg
              : messages.slice(0, i).reverse().find(m => m.role === "assistant");
            const nextUser = allMessages
              .slice(allMessages.findIndex(m => m.id === msg.id) + 1)
              .find(m => m.role === "user");
            return (
              <MessageBox
                key={msg.id}
                message={msg}
                parsedContent={filteredParsed}
                nextUserMessage={nextUser}
                isGenerating={false}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                clickedActions={clickedActions}
                failedActions={failedActions}
                onToolClick={onToolClick}
                executionState={executionState}
                isLastMessage={false}
                toolOutputs={toolOutputs}
                terminalStatus={terminalStatus}
                allMessages={allMessages}
                activeTerminalIds={activeTerminalIds}
                attachedTerminalIds={attachedTerminalIds}
                conversationId={conversationId}
                previousAssistantMessage={prevForBox}
                onSendMessage={onSendMessage}
                onSelectOption={onSelectOption}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProcessGroup;
