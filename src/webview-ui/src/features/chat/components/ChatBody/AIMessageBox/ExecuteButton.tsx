import React from "react";
import { Check, X } from "lucide-react";

// CONSTANTS
import { TOOL_ACTION_TYPES } from "@/features/chat/constants/constants";

export interface ExecuteButtonProps {
  isCompleted: boolean;
  isActive: boolean;
  isFailed?: boolean;
  isLastMessage?: boolean;
  onExecute: (
    e: React.MouseEvent,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  toolColor?: string;
  title: string;
  isSkipped?: boolean;
  isLoading?: boolean;
  showText?: boolean;
  labelText?: string;
  hasError?: boolean; // NEW: indicates validation/parsing error
}

const ExecuteButton: React.FC<ExecuteButtonProps> = ({
  isCompleted,
  isActive,
  isFailed,
  onExecute,
  toolColor = "var(--vscode-descriptionForeground, #6b7280)",
  title,
  isSkipped,
  isLoading,
  showText,
  labelText,
  hasError = false, // NEW
}) => {
  const iconColor = isCompleted
    ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
    : isFailed
      ? "var(--vscode-errorForeground)"
      : toolColor;
  const isClickable = !isLoading && (!isCompleted || isFailed || isActive);

  const handleExecuteClick = React.useCallback(
    (e: React.MouseEvent, type: any) => {
      e.stopPropagation();
      // 🔍 DEBUG LOG
      console.log('[ExecuteButton] handleExecuteClick:', {
        type,
        isClickable,
        isCompleted,
        isActive,
        isLoading,
        title,
        timestamp: new Date().toISOString(),
      });
      if (isClickable) {
        onExecute(e, type);
      }
    },
    [isClickable, isCompleted, isActive, isLoading, title, onExecute],
  );

  // Special case: Tool has validation/parsing error in approve mode
  // Check hasError FIRST before other conditions
  if (hasError) {
    const errorColor = "var(--vscode-errorForeground, #ff4d4d)";
    return (
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "0px",
          marginBottom: "8px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={(e) => handleExecuteClick(e, TOOL_ACTION_TYPES.REJECT)}
          disabled={isLoading}
          style={{
            background: `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`,
            color: errorColor,
            opacity: 0.85,
            border: `1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`,
            cursor: isLoading ? "wait" : "pointer",
            padding: "5px 8px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 600,
            height: "24px",
            transition: "all 0.2s ease",
            gap: "6px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)`;
            e.currentTarget.style.borderColor = `color-mix(in srgb, var(--vscode-errorForeground) 35%, transparent)`;
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = `color-mix(in srgb, var(--vscode-errorForeground) 85%, white 15%)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`;
            e.currentTarget.style.borderColor = `color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`;
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.color = errorColor;
          }}
          title="Skip this tool due to error and continue to next tool"
        >
          <span style={{ textTransform: "none" }}>
            {labelText || "Skip this tool because of error"}
          </span>
        </button>
      </div>
    );
  }

  if (isCompleted || isLoading || !isActive) {
    return (
      <button
        onClick={(e) => handleExecuteClick(e, TOOL_ACTION_TYPES.ACCEPT)}
        disabled={isLoading || (isCompleted && !isFailed && !isActive)}
        style={{
          background: isCompleted ? "transparent" : `${toolColor}20`,
          color: iconColor,
          border: `1px solid ${isCompleted ? "transparent" : `${toolColor}40`}`,
          cursor: isLoading ? "wait" : isClickable ? "pointer" : "default",
          padding: "4px 8px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: isSkipped ? 0.5 : 1,
          fontSize: "12px",
          gap: "6px",
          fontWeight: 600,
          height: "24px",
        }}
        className="execute-button-premium"
        title={title}
      >
        {isLoading ? (
          <div
            className="codicon codicon-loading codicon-modifier-spin"
            style={{ fontSize: "14px" }}
          />
        ) : isCompleted ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {(showText || labelText || (!isCompleted && !isLoading)) && (
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {labelText || (isCompleted ? "Done" : "Run")}
          </span>
        )}
      </button>
    );
  }

  // Special case: Tool has validation/parsing error in approve mode
  // Show only "Skip" button to move to next tool - simple text button with Reject style
  if (hasError) {
    const errorColor = "var(--vscode-errorForeground, #ff4d4d)";
    return (
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "0px",
          marginBottom: "8px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={(e) => handleExecuteClick(e, TOOL_ACTION_TYPES.REJECT)}
          disabled={isLoading}
          style={{
            background: `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`,
            color: errorColor,
            opacity: 0.85,
            border: `1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`,
            cursor: isLoading ? "wait" : "pointer",
            padding: "5px 8px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 600,
            height: "24px",
            transition: "all 0.2s ease",
            gap: "6px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)`;
            e.currentTarget.style.borderColor = `color-mix(in srgb, var(--vscode-errorForeground) 35%, transparent)`;
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = `color-mix(in srgb, var(--vscode-errorForeground) 85%, white 15%)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`;
            e.currentTarget.style.borderColor = `color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`;
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.color = errorColor;
          }}
          title="Skip this tool due to error and continue to next tool"
        >
          <span style={{ textTransform: "none" }}>
            {labelText || "Skip this tool because of error"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "0px",
        marginBottom: "8px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {[
        {
          type: TOOL_ACTION_TYPES.ACCEPT,
          color: toolColor,
          icon: <Check size={14} strokeWidth={2.5} />,
          label: "Accept",
          title: "Accept Once",
        },
        {
          type: TOOL_ACTION_TYPES.REJECT,
          color: "var(--vscode-errorForeground, #ff4d4d)",
          icon: <X size={14} strokeWidth={2.5} />,
          label: "Reject",
          title: "Reject this tool call",
        },
      ].map(({ type, color, icon, label, title: btnTitle }) => {
        const isReject = type === TOOL_ACTION_TYPES.REJECT;
        const buttonRef = React.useRef<HTMLButtonElement>(null);

        return (
          <button
            key={type}
            ref={buttonRef}
            onClick={(e) => handleExecuteClick(e, type)}
            disabled={isLoading}
            style={{
              background: isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`
                : `color-mix(in srgb, ${color} 4%, transparent)`,
              color,
              border: isReject
                ? `1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`
                : `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
              cursor: isLoading ? "wait" : "pointer",
              padding: "5px 8px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 600,
              height: "24px",
              transition: "all 0.2s ease",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)`
                : `color-mix(in srgb, ${color} 12%, transparent)`;
              e.currentTarget.style.borderColor = isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 35%, transparent)`
                : `color-mix(in srgb, ${color} 35%, transparent)`;
              e.currentTarget.style.color = isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 85%, white 15%)`
                : `color-mix(in srgb, ${color} 85%, white 15%)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)`
                : `color-mix(in srgb, ${color} 4%, transparent)`;
              e.currentTarget.style.borderColor = isReject
                ? `color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)`
                : `color-mix(in srgb, ${color} 20%, transparent)`;
              e.currentTarget.style.color = color;
            }}
            title={btnTitle}
          >
            {icon}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ExecuteButton;
