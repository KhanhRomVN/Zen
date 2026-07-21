import React from "react";

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. Defaults to a minimal error card. */
  fallback?: React.ReactNode;
}

/**
 * Error boundary for the chat panel.
 * Catches render errors from child components (e.g. MarkdownBlock, ToolRouter)
 * and shows a recoverable error UI instead of crashing the entire webview.
 */
export class ChatErrorBoundary extends React.Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ChatErrorBoundary] Render error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const errorColor = "var(--vscode-errorForeground, #f44336)";

      return (
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {/* Left panel: CircleDot */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "16px",
                  height: "16px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "2px",
                }}
                title="Error - Render failed"
              >
                {/* CircleDot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: errorColor,
                  }}
                />
              </div>
            </div>

            {/* Right panel: ERROR label */}
            <div
              style={{
                flexShrink: 0,
                marginLeft: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: errorColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ERROR
              </span>
            </div>
          </div>

          {/* Error Block */}
          {this.state.error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "6px",
                border: `1px solid color-mix(in srgb, ${errorColor} 30%, transparent)`,
                background: `color-mix(in srgb, ${errorColor} 5%, transparent)`,
              }}
            >
              <pre
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "120px",
                  overflowY: "auto",
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                }}
              >
                {this.state.error.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
