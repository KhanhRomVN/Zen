import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  parseAIResponse,
  formatActionForDisplay,
  type ParsedResponse,
  type ToolAction,
} from "../../../services/ResponseParser";
import {
  getFileIconPath,
  getFolderIconPath,
} from "../../../utils/fileIconMapper";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isFirstRequest?: boolean;
  isToolRequest?: boolean;
  systemPrompt?: string;
  contextSize?: number;
}

interface Checkpoint {
  id: string;
  conversationId: string;
  filePath: string;
  preEditContent: string; // Content before edit
  postEditContent?: string; // Content after edit (optional)
  timestamp: number;
  toolType: "write_to_file" | "replace_in_file" | "execute_command";
  isComplete: boolean; // Has post-edit content
  actionId?: string; // Track which action created this checkpoint
  messageId?: string; // Track which message contains this action
}

interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  checkpoints: string[];
  checkpoint?: Checkpoint | null;
  onSendToolRequest?: (action: ToolAction, message: Message) => void;
  onSendMessage?: (content: string) => void;
  onRevertCheckpoint?: (checkpoint: Checkpoint) => void;
  agentOptions?: any; // Agent options for auto-execute
}

// Helper functions moved to module scope
const getActionName = (type: string): string => {
  const names: Record<string, string> = {
    replace_in_file: "replace_in_file",
    write_to_file: "write_to_file",
    execute_command: "Run Command",
  };
  return names[type] || type;
};

const getFilename = (action: any): string => {
  if (action.type === "execute_command") {
    const cmd = action.params.command || "";
    return cmd.length > 50 ? cmd.substring(0, 50) + "..." : cmd;
  }
  const path = action.params.path || "";
  return path.split("/").pop() || path || "";
};

const getToolLabel = (type: string) => {
  switch (type) {
    case "read_file":
      return "Zen wants to read file:";
    case "write_to_file":
      return "Zen wants to create/edit file:";
    case "replace_in_file":
      return "Zen wants to edit file:";
    case "list_files":
      return "Zen wants to list files in:";
    case "search_files":
      return "Zen wants to search files:";
    case "execute_command":
      return "Zen wants to execute command:";
    default:
      return "Zen wants to perform action:";
  }
};

const parseNewCodeFromDiff = (diff: string): string => {
  if (!diff) return "";

  // Match REPLACE block: =======\n<content>\n>>>>>>> REPLACE
  const replaceMatch = diff.match(
    /=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/
  );
  if (replaceMatch) {
    return replaceMatch[1].trim();
  }

  // Fallback: return entire diff if no REPLACE block found
  return diff;
};

// Stateless handler for diff click
const handleDiffClick = (e: React.MouseEvent, action: any) => {
  e.stopPropagation();
  const vscodeApi = (window as any).vscodeApi;
  if (vscodeApi) {
    // Extract new code from diff or use content directly
    let newCode = "";
    if (action.type === "replace_in_file" && action.params.diff) {
      newCode = parseNewCodeFromDiff(action.params.diff);
    } else if (action.type === "write_to_file" && action.params.content) {
      newCode = action.params.content;
    }

    vscodeApi.postMessage({
      command: "openDiffView",
      filePath: action.params.path,
      newCode: newCode,
    });
  }
};

const ChatBody: React.FC<ChatBodyProps> = ({
  messages,
  isProcessing,
  checkpoints,
  checkpoint,
  onSendToolRequest,
  onSendMessage,
  onRevertCheckpoint,
  agentOptions,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [selectedFollowupOptions, setSelectedFollowupOptions] = useState<
    Map<string, string>
  >(new Map());
  // 🆕 Track clicked tool actions
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  // 🆕 Track first edit tool for checkpoint
  const [firstEditToolId, setFirstEditToolId] = useState<string | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const parsedMessages = useMemo(() => {
    const cache = new Map<string, ParsedResponse>();

    const result = messages.map((msg) => {
      if (!cache.has(msg.content)) {
        cache.set(msg.content, parseAIResponse(msg.content));
      }

      return {
        ...msg,
        parsed: cache.get(msg.content)!,
      };
    });

    return result;
  }, [messages]);

  // Auto-scroll to bottom khi có message mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // 🆕 Note: We don't clear clickedActions anymore - once clicked, tools stay in "completed" state

  // 🆕 Auto-collapse PROMPT REQUEST sections by default
  useEffect(() => {
    const newCollapsed = new Set(collapsedSections);
    messages.forEach((msg) => {
      if (msg.role === "user") {
        newCollapsed.add(`prompt-${msg.id}`);
      }
    });
    setCollapsedSections(newCollapsed);
  }, [messages.length]);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 🆕 Listen for removeClickedAction message from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "removeClickedAction" && event.data.actionId) {
        setClickedActions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(event.data.actionId);
          return newSet;
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 🆕 Scroll to bottom handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 🆕 Helper to get tool color
  const getToolColor = (type: string) => {
    switch (type) {
      case "read_file":
        return "#3b82f6"; // blue
      case "write_to_file":
      case "replace_in_file":
        return "#10b981"; // green
      case "execute_command":
        return "#f59e0b"; // orange
      case "attempt_completion":
        return "#22c55e"; // success green
      default:
        return "#6b7280"; // gray
    }
  };

  // 🆕 Handle tool action click
  const handleToolClick = (
    action: ToolAction,
    message: Message,
    actionIndex: number
  ) => {
    const clickableTools = [
      "read_file",
      "write_to_file",
      "replace_in_file",
      "list_files",
      "search_files",
      "execute_command",
    ];

    if (clickableTools.includes(action.type) && onSendToolRequest) {
      // Mark as clicked
      const actionId = `${message.id}-action-${actionIndex}`;
      setClickedActions((prev) => new Set(prev).add(actionId));

      // Attach actionId to action for checkpoint tracking
      const actionWithId = { ...action, actionId };
      onSendToolRequest(actionWithId, message);
    }
  };

  // 🆕 Auto-execute tools when autoRead is "always"
  useEffect(() => {
    if (!agentOptions) return;

    // Check each parsed message for actions
    parsedMessages.forEach((parsedMsg) => {
      const { parsed, id, role } = parsedMsg;

      parsed.actions.forEach((action, idx) => {
        const actionId = `${id}-action-${idx}`;

        // Skip if already clicked
        if (clickedActions.has(actionId)) return;

        // Check if this tool should auto-execute
        let shouldAutoExecute = false;

        switch (action.type) {
          case "read_file":
            shouldAutoExecute = agentOptions.read_file?.autoRead === "always";
            break;
          case "write_to_file":
            shouldAutoExecute =
              agentOptions.write_to_file?.autoRead === "always";
            break;
          case "replace_in_file":
            shouldAutoExecute =
              agentOptions.replace_in_file?.autoRead === "always";
            break;
          case "list_files":
            shouldAutoExecute = agentOptions.list_files?.autoRead === "always";
            break;
          case "search_files":
            shouldAutoExecute =
              agentOptions.search_files?.autoRead === "always";
            break;
          case "execute_command":
            shouldAutoExecute = agentOptions.run_command?.autoRead === "always";
            break;
        }

        // Auto-execute if needed
        if (shouldAutoExecute) {
          // Need to pass the full message object, so reconstruct it from parsedMsg
          const messageObj: Message = {
            id,
            role,
            content: parsedMsg.content,
            timestamp: parsedMsg.timestamp,
            isFirstRequest: parsedMsg.isFirstRequest,
            isToolRequest: parsedMsg.isToolRequest,
            systemPrompt: parsedMsg.systemPrompt,
            contextSize: parsedMsg.contextSize,
          };
          handleToolClick(action, messageObj, idx);
        }
      });
    });
  }, [parsedMessages, agentOptions, clickedActions, onSendToolRequest]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--spacing-xl)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              marginBottom: "var(--spacing-lg)",
              animation: "float 3s ease-in-out infinite",
            }}
          >
            💬
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              marginBottom: "var(--spacing-sm)",
            }}
          >
            Start a Conversation
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "var(--font-size-md)",
              color: "var(--secondary-text)",
              lineHeight: 1.6,
              marginBottom: "var(--spacing-lg)",
            }}
          >
            Ask anything, get instant responses from your AI assistant
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
              padding: "var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              borderRadius: "var(--border-radius-lg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>💡</span>
              <span>Get code suggestions and explanations</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>🔍</span>
              <span>Debug and troubleshoot issues</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>📝</span>
              <span>Generate documentation and tests</span>
            </div>
          </div>
          <style>
            {`
              @keyframes float {
                0%, 100% {
                  transform: translateY(0px);
                }
                50% {
                  transform: translateY(-10px);
                }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  // 🆕 Helper function to copy text
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 🆕 Helper to toggle section collapse
  const toggleCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
        paddingBottom: "200px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      {messages.map((message, index) => {
        // Skip first message if it's from user (displayed in header)
        if (index === 0 && message.role === "user") {
          return null;
        }

        // 🆕 Calculate request number for user messages
        const requestNumber =
          message.role === "user"
            ? messages.filter(
                (m) => m.role === "user" && m.timestamp <= message.timestamp
              ).length
            : null;

        // 🆕 Regular messages - Use memoized parsed content
        const parsedMessage = parsedMessages.find((pm) => pm.id === message.id);
        if (!parsedMessage) {
          return null;
        }
        const parsedContent = parsedMessage.parsed;

        return (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-md)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            {/* 🆕 REQUEST Divider for all user messages */}
            {message.role === "user" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                    margin: "var(--spacing-md) 0",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      borderTop:
                        "1px dashed var(--vscode-descriptionForeground)",
                      opacity: 0.6,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--vscode-descriptionForeground)",
                      fontWeight: 600,
                      padding: "0 8px",
                    }}
                  >
                    REQUEST {requestNumber}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      borderTop:
                        "1px dashed var(--vscode-descriptionForeground)",
                      opacity: 0.6,
                    }}
                  />
                </div>

                {/* 🆕 PROMPT REQUEST Section - Collapsible (for all user messages) */}
                <div
                  style={{
                    overflow: "hidden",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-xs)",
                      paddingBottom: "var(--spacing-sm) var(--spacing-md)",
                      marginBottom: "var(--spacing-sm)",
                      cursor: "pointer",
                      justifyContent: "space-between",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(`prompt-${message.id}`);
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transition: "transform 0.2s",
                          transform: collapsedSections.has(
                            `prompt-${message.id}`
                          )
                            ? "rotate(0deg)"
                            : "rotate(180deg)",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          fontWeight: 600,
                          color: "var(--secondary-text)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        PROMPT REQUEST
                      </span>
                    </div>
                  </div>
                  {!collapsedSections.has(`prompt-${message.id}`) && (
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        maxHeight: "400px",
                        overflowY: "auto",
                      }}
                    >
                      {message.systemPrompt && (
                        <>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--accent-text)",
                              marginBottom: "var(--spacing-xs)",
                            }}
                          >
                            === SYSTEM PROMPT ===
                          </div>
                          {message.systemPrompt}
                          <div
                            style={{
                              margin: "var(--spacing-md) 0",
                              borderTop: "1px dashed var(--border-color)",
                            }}
                          />
                        </>
                      )}
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--accent-text)",
                          marginBottom: "var(--spacing-xs)",
                        }}
                      >
                        === USER MESSAGE ===
                      </div>
                      {message.content}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 🆕 THINKING Section - Collapsible (for assistant messages) */}
            {message.role === "assistant" && parsedContent.thinking && (
              <div
                style={{
                  borderRadius: "var(--border-radius)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    paddingBottom: "var(--spacing-sm) var(--spacing-md)",
                    marginBottom: "var(--spacing-sm)",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleCollapse(`thinking-${message.id}`)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transition: "transform 0.2s",
                      transform: collapsedSections.has(`thinking-${message.id}`)
                        ? "rotate(0deg)"
                        : "rotate(180deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 600,
                      color: "var(--secondary-text)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    THINKING
                  </span>
                </div>
                {!collapsedSections.has(`thinking-${message.id}`) && (
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--secondary-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      opacity: 0.8,
                    }}
                  >
                    {parsedContent.thinking}
                  </div>
                )}
              </div>
            )}

            {/* Result - Plain text display */}
            {message.role === "assistant" &&
              parsedContent.attemptCompletion && (
                <div
                  style={{
                    padding: "8px 0",
                    fontSize: "13px",
                    color: "var(--vscode-editor-foreground)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {parsedContent.attemptCompletion}
                </div>
              )}

            {/* Message Header + Content - Only show if there's displayText or it's a user message */}
            {/* Hide "You" box for tool requests, show for all other user messages */}
            {(message.role === "assistant" && parsedContent.displayText) ||
            (message.role === "user" && !message.isToolRequest) ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  backgroundColor:
                    message.role === "user"
                      ? "var(--input-bg)"
                      : "var(--secondary-bg)",
                  padding: message.role === "user" ? "var(--spacing-md)" : "0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                    fontWeight: 600,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-xs)",
                    }}
                  >
                    <span>{message.role === "user" ? "👤" : "🤖"}</span>
                    <span>
                      {message.role === "user" ? "You" : "AI Assistant"}
                    </span>
                  </div>

                  {/* Copy icon - Only for User messages */}
                  {message.role === "user" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--vscode-descriptionForeground)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        cursor: "pointer",
                        opacity: 0.6,
                        transition: "all 0.2s",
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.stroke =
                          "var(--vscode-textLink-activeForeground)";
                        e.currentTarget.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.stroke =
                          "var(--vscode-descriptionForeground)";
                        e.currentTarget.style.opacity = "0.6";
                      }}
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </div>

                {/* Main text content (thinking or cleaned text) */}
                {parsedContent.displayText && (
                  <div
                    style={{
                      fontSize: "var(--font-size-md)",
                      color: "var(--primary-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {parsedContent.displayText}
                  </div>
                )}
              </div>
            ) : null}

            {/* Tool Actions */}
            {parsedContent.actions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-sm)",
                }}
              >
                {parsedContent.actions.map((action, idx) => {
                  const clickableTools = [
                    "read_file",
                    "write_to_file",
                    "replace_in_file",
                    "list_files",
                    "search_files",
                    "execute_command",
                  ];
                  const actionId = `${message.id}-action-${idx}`;
                  const isClicked = clickedActions.has(actionId);

                  if (isClicked && clickableTools.includes(action.type)) {
                    const toolColor = getToolColor(action.type);

                    // Get action-specific label
                    let completedLabel = "";
                    const fileName = action.params.path
                      ? action.params.path.split("/").pop()
                      : "";

                    switch (action.type) {
                      case "read_file":
                        completedLabel = `read_file: ${fileName}`;
                        break;
                      case "write_to_file":
                        completedLabel = `write_to_file: ${fileName}`;
                        break;
                      case "replace_in_file":
                        completedLabel = `replace_in_file: ${fileName}`;
                        break;
                      case "list_files":
                        completedLabel = `list_files`;
                        break;
                      case "search_files":
                        completedLabel = `search_files`;
                        break;
                      case "execute_command":
                        const cmd =
                          action.params.command?.substring(0, 30) || "command";
                        completedLabel = `execute_command: ${cmd}${
                          action.params.command &&
                          action.params.command.length > 30
                            ? "..."
                            : ""
                        }`;
                        break;
                      default:
                        completedLabel = `Done`;
                    }

                    // Check if this is a file modification tool for CHECKPOINT
                    const needsCheckpoint = [
                      "write_to_file",
                      "replace_in_file",
                      "execute_command",
                    ].includes(action.type);

                    return (
                      <React.Fragment key={idx}>
                        {/* Completed tool label */}
                        <div style={{ marginBottom: "8px" }}>
                          <div
                            style={{
                              padding: "6px 10px",
                              backgroundColor:
                                "var(--vscode-editor-background)",
                              border: `1px solid ${toolColor}40`,
                              borderLeft: `4px solid ${toolColor}`,
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              opacity: 0.9,
                            }}
                          >
                            {/* Icon */}
                            <img
                              src={
                                action.type === "list_files"
                                  ? getFolderIconPath(true)
                                  : getFileIconPath(getFilename(action))
                              }
                              alt="icon"
                              style={{ width: "16px", height: "16px" }}
                            />

                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: "13px",
                                color: "var(--vscode-editor-foreground)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={
                                action.params.path || action.params.command
                              }
                            >
                              {getFilename(action)}
                            </span>
                          </div>
                        </div>

                        {/* CHECKPOINT (after every edit tool) */}
                        {needsCheckpoint && checkpoint && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--spacing-sm)",
                              margin: "16px 0",
                              transition: "all 0.2s",
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                height: "1px",
                                borderTop: "2px dashed var(--input-bg)",
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              {/* CHECKPOINT Text */}
                              <span
                                style={{
                                  fontSize: "var(--font-size-xs)",
                                  color: "var(--secondary-text)",
                                  padding: "2px 8px",
                                  backgroundColor: "var(--secondary-bg)",
                                  borderRadius: "var(--border-radius)",
                                  fontWeight: 600,
                                }}
                              >
                                📍 CHECKPOINT
                              </span>

                              {/* Diff Icon - Click to open diff */}
                              {checkpoint && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const vscodeApi = (window as any).vscodeApi;
                                    if (vscodeApi && checkpoint) {
                                      vscodeApi.postMessage({
                                        command: "openDiffView",
                                        filePath: checkpoint.filePath,
                                        newCode: checkpoint.preEditContent,
                                      });
                                    }
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                    transition: "stroke 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    const svg =
                                      e.currentTarget.querySelector("svg");
                                    if (svg) svg.style.stroke = "#3b82f6"; // Blue for diff
                                  }}
                                  onMouseLeave={(e) => {
                                    const svg =
                                      e.currentTarget.querySelector("svg");
                                    if (svg)
                                      svg.style.stroke =
                                        "var(--vscode-editor-foreground)";
                                  }}
                                  title="View diff"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--vscode-editor-foreground)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ transition: "stroke 0.2s" }}
                                  >
                                    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                                    <path d="M9 10h6" />
                                    <path d="M12 13V7" />
                                    <path d="M9 17h6" />
                                  </svg>
                                </button>
                              )}

                              {/* Revert Icon - Click to revert */}
                              {checkpoint && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onRevertCheckpoint && checkpoint) {
                                      // Send message to extension to show confirmation dialog
                                      const vscodeApi = (window as any)
                                        .vscodeApi;
                                      if (vscodeApi) {
                                        vscodeApi.postMessage({
                                          command: "confirmRevert",
                                          checkpoint: checkpoint,
                                        });
                                      }
                                    }
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                    transition: "stroke 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    const svg =
                                      e.currentTarget.querySelector("svg");
                                    if (svg) svg.style.stroke = "#f59e0b"; // Orange for revert
                                  }}
                                  onMouseLeave={(e) => {
                                    const svg =
                                      e.currentTarget.querySelector("svg");
                                    if (svg)
                                      svg.style.stroke =
                                        "var(--vscode-editor-foreground)";
                                  }}
                                  title="Revert to checkpoint"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--vscode-editor-foreground)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ transition: "stroke 0.2s" }}
                                  >
                                    <path d="M9 14 4 9l5-5" />
                                    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                height: "1px",
                                borderTop: "2px dashed var(--input-bg)",
                              }}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }

                  const toolColor = getToolColor(action.type);

                  // Helper functions moved to top of file

                  // Helper functions removed from here

                  // Check if this is a file modification action OR execute_command OR read_file
                  const isStyledTool =
                    action.type === "replace_in_file" ||
                    action.type === "write_to_file" ||
                    action.type === "read_file" ||
                    action.type === "list_files" ||
                    action.type === "execute_command" ||
                    action.type === "search_files";

                  // getToolLabel moved up

                  return (
                    <div key={idx} style={{ marginBottom: "8px" }}>
                      {/* Label */}
                      {isStyledTool && (
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--vscode-descriptionForeground)",
                            marginBottom: "4px",
                            marginLeft: "2px",
                          }}
                        >
                          {getToolLabel(action.type)}
                        </div>
                      )}

                      {/* New icon-based UI for file actions */}
                      {isStyledTool ? (
                        <div
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "var(--vscode-editor-background)",
                            border: `1px solid ${toolColor}40`, // Reduced opacity border
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          {/* Icon */}
                          {action.type !== "execute_command" && (
                            <img
                              src={
                                action.type === "list_files"
                                  ? getFolderIconPath(true)
                                  : getFileIconPath(getFilename(action))
                              }
                              alt="icon"
                              style={{ width: "16px", height: "16px" }}
                            />
                          )}
                          {action.type === "execute_command" && (
                            <div style={{ color: toolColor, display: "flex" }}>
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="4 17 10 11 4 5" />
                                <line x1="12" y1="19" x2="20" y2="19" />
                              </svg>
                            </div>
                          )}

                          {/* Filename Only (No Action Name) */}
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--vscode-editor-foreground)",
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "monospace",
                                color: "var(--vscode-editor-foreground)", // Use main text color for filename
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={
                                action.params.path || action.params.command
                              }
                            >
                              {getFilename(action)}
                            </span>
                          </span>

                          {/* Icon Group (Right Side) */}
                          <div style={{ display: "flex", gap: "4px" }}>
                            {/* Diff/Preview Icon Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const vscodeApi = (window as any).vscodeApi;
                                if (vscodeApi) {
                                  let newCode = "";
                                  if (
                                    action.type === "replace_in_file" &&
                                    action.params.diff
                                  ) {
                                    newCode = parseNewCodeFromDiff(
                                      action.params.diff
                                    );
                                    vscodeApi.postMessage({
                                      command: "openDiffView",
                                      filePath: action.params.path,
                                      newCode: newCode,
                                    });
                                  } else if (
                                    action.type === "write_to_file" &&
                                    action.params.content
                                  ) {
                                    newCode = action.params.content;
                                    vscodeApi.postMessage({
                                      command: "openDiffView",
                                      filePath: action.params.path,
                                      newCode: newCode,
                                    });
                                  } else if (
                                    action.type === "execute_command" &&
                                    action.params.command
                                  ) {
                                    vscodeApi.postMessage({
                                      command: "openPreview",
                                      content: action.params.command,
                                      language: "shellscript",
                                    });
                                  }
                                }
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                borderRadius: "4px",
                                display: "flex",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${toolColor}15`;
                                const svg =
                                  e.currentTarget.querySelector("svg");
                                if (svg) svg.style.stroke = toolColor;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                                const svg =
                                  e.currentTarget.querySelector("svg");
                                if (svg)
                                  svg.style.stroke =
                                    "var(--vscode-editor-foreground)";
                              }}
                              title={
                                action.type === "execute_command"
                                  ? "Preview command"
                                  : "Preview diff"
                              }
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--vscode-editor-foreground)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transition: "stroke 0.2s" }}
                              >
                                <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                                <path d="M9 10h6" />
                                <path d="M12 13V7" />
                                <path d="M9 17h6" />
                              </svg>
                            </button>

                            {/* Arrow Right Icon Button - Execute */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToolClick(action, message, idx);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                borderRadius: "4px",
                                display: "flex",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${toolColor}15`;
                                const svg =
                                  e.currentTarget.querySelector("svg");
                                if (svg) svg.style.stroke = toolColor;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                                const svg =
                                  e.currentTarget.querySelector("svg");
                                if (svg)
                                  svg.style.stroke =
                                    "var(--vscode-editor-foreground)";
                              }}
                              title="Execute action"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--vscode-editor-foreground)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transition: "stroke 0.2s" }}
                              >
                                <rect
                                  width="18"
                                  height="18"
                                  x="3"
                                  y="3"
                                  rx="2"
                                />
                                <path d="M8 8h8v8" />
                                <path d="m8 16 8-8" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : action.type === "attempt_completion" ? (
                        /* attempt_completion: Plain text only, no button */
                        <div
                          style={{
                            padding: "8px 0",
                            fontSize: "13px",
                            color: "var(--vscode-descriptionForeground)",
                          }}
                        >
                          {formatActionForDisplay(action)}
                        </div>
                      ) : (
                        /* Original UI for other actions */
                        <div
                          style={{
                            padding: "var(--spacing-sm) var(--spacing-md)",
                            backgroundColor: "var(--secondary-bg)",
                            border: `2px solid ${toolColor}`,
                            borderRadius: "var(--border-radius-lg)",
                            cursor: clickableTools.includes(action.type)
                              ? "pointer"
                              : "default",
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--spacing-sm)",
                          }}
                          onClick={() => {
                            setClickedActions((prev) =>
                              new Set(prev).add(actionId)
                            );

                            // Track first edit tool for checkpoint
                            const editTools = [
                              "write_to_file",
                              "replace_in_file",
                              "execute_command",
                            ];
                            if (
                              editTools.includes(action.type) &&
                              !firstEditToolId
                            ) {
                              setFirstEditToolId(actionId);
                            }

                            // Use unified handleToolClick for all tools
                            handleToolClick(action, message, idx);
                          }}
                          onMouseEnter={(e) => {
                            if (clickableTools.includes(action.type)) {
                              e.currentTarget.style.backgroundColor = `${toolColor}15`;
                              e.currentTarget.style.transform =
                                "translateX(4px)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (clickableTools.includes(action.type)) {
                              e.currentTarget.style.backgroundColor =
                                "var(--secondary-bg)";
                              e.currentTarget.style.transform = "translateX(0)";
                            }
                          }}
                        >
                          <span
                            style={{
                              fontSize: "var(--font-size-sm)",
                              color: "var(--primary-text)",
                              fontWeight: 600,
                              flex: 1,
                            }}
                          >
                            {formatActionForDisplay(action)}
                          </span>
                          {clickableTools.includes(action.type) && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={toolColor}
                              strokeWidth="2"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Followup Options */}
            {parsedContent.followupOptions &&
              parsedContent.followupOptions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "8px",
                  }}
                >
                  {parsedContent.followupOptions.map((option, idx) => {
                    const messageKey = `${message.id}-followup`;
                    const isSelected =
                      selectedFollowupOptions.get(messageKey) === option;
                    const hasSelection =
                      selectedFollowupOptions.has(messageKey);

                    return (
                      <button
                        key={idx}
                        disabled={hasSelection && !isSelected}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "transparent",
                          borderLeft: isSelected
                            ? "3px solid var(--vscode-charts-green)"
                            : "3px solid var(--vscode-textLink-foreground)",
                          borderTop: "none",
                          borderRight: "none",
                          borderBottom: "none",
                          cursor:
                            hasSelection && !isSelected
                              ? "not-allowed"
                              : "pointer",
                          transition: "all 0.2s",
                          fontSize: "13px",
                          color:
                            hasSelection && !isSelected
                              ? "var(--vscode-disabledForeground)"
                              : "var(--vscode-editor-foreground)",
                          textAlign: "left",
                          width: "100%",
                          opacity: hasSelection && !isSelected ? 0.5 : 1,
                        }}
                        onClick={() => {
                          if (hasSelection) return;
                          // Mark as selected
                          setSelectedFollowupOptions((prev) =>
                            new Map(prev).set(messageKey, option)
                          );

                          // Direct send message
                          if (onSendMessage) {
                            onSendMessage(option);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (hasSelection && !isSelected) return;
                          e.currentTarget.style.backgroundColor =
                            "var(--vscode-list-hoverBackground)";
                          e.currentTarget.style.borderLeftColor =
                            "var(--vscode-textLink-activeForeground)";
                        }}
                        onMouseLeave={(e) => {
                          if (hasSelection && !isSelected) return;
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.borderLeftColor = isSelected
                            ? "var(--vscode-charts-green)"
                            : "var(--vscode-textLink-foreground)";
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

            {/* 🆕 CHECKPOINT Divider after file modification tools */}
            {message.role === "assistant" &&
              (message.content.includes("[write_to_file") ||
                message.content.includes("[replace_in_file")) &&
              message.content.includes("Success: File") && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                    margin: "var(--spacing-md) 0",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      borderTop: "2px dashed var(--input-bg)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                      padding: "2px 8px",
                      backgroundColor: "var(--secondary-bg)",
                      borderRadius: "var(--border-radius)",
                      fontWeight: 600,
                    }}
                  >
                    📍 CHECKPOINT
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      borderTop: "2px dashed var(--input-bg)",
                    }}
                  />
                </div>
              )}
          </div>
        );
      })}

      {isProcessing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
            padding: "var(--spacing-md)",
            color: "var(--secondary-text)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-text)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <span>AI is thinking...</span>
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* 🆕 Scroll to Bottom Button - Pass to parent */}
      {!isAtBottom && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(var(--spacing-lg) + 180px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}
        >
          <button
            onClick={scrollToBottom}
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--accent-text)",
              color: "white",
              border: "none",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          >
            <span>Scroll to Bottom</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ChatBody;
