import React from "react";
import { Check, X } from "lucide-react";
import { TOOL_ACTION_TYPES } from "../../constants/constants";

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
}

const ExecuteButton: React.FC<ExecuteButtonProps> = ({
  isCompleted,
  isActive,
  isFailed,
  isLastMessage,
  onExecute,
  toolColor = "var(--vscode-descriptionForeground, #6b7280)",
  title,
  isSkipped,
  isLoading,
  showText,
  labelText,
}) => {
  const iconColor = isCompleted
    ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
    : isFailed
      ? "var(--vscode-errorForeground)"
      : toolColor;
  const isClickable = !isLoading && (!isCompleted || isFailed || isActive);

  if (isCompleted || isLoading || !isActive) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isClickable) onExecute(e, TOOL_ACTION_TYPES.ACCEPT);
        }}
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

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "8px",
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
      ].map(({ type, color, icon, label, title: btnTitle }) => (
        <button
          key={type}
          onClick={(e) => {
            e.stopPropagation();
            if (isClickable) onExecute(e, type);
          }}
          disabled={isLoading}
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            cursor: isLoading ? "wait" : "pointer",
            padding: "4px 10px",
            borderRadius: "6px",
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
            e.currentTarget.style.background = `color-mix(in srgb, ${color} 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, ${color} 15%, transparent)`;
          }}
          title={btnTitle}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ExecuteButton;
