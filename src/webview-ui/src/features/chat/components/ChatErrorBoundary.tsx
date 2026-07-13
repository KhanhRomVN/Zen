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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div
          style={{
            padding: "16px 20px",
            margin: "12px",
            borderRadius: "8px",
            border: "1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44336) 30%, transparent)",
            background: "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 5%, transparent)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              fontSize: "13px",
              color: "var(--vscode-errorForeground, #f44336)",
            }}
          >
            <span className="codicon codicon-error" style={{ fontSize: "14px" }} />
            Something went wrong rendering this message
          </div>
          {this.state.error && (
            <pre
              style={{
                fontSize: "11px",
                color: "var(--vscode-descriptionForeground)",
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              alignSelf: "flex-start",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "4px",
              border: "1px solid color-mix(in srgb, var(--vscode-foreground) 25%, transparent)",
              background: "transparent",
              color: "var(--vscode-foreground)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
