import React, { useState, useEffect } from "react";

interface PromptEditorPanelProps {
  moduleId: string;
  moduleTitle: string;
  moduleEmoji: string;
  filePath: string;
  defaultContent: string;
  onBack: () => void;
}

const PromptEditorPanel: React.FC<PromptEditorPanelProps> = ({
  moduleId,
  moduleTitle,
  moduleEmoji,
  filePath,
  defaultContent,
  onBack,
}) => {
  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Request system info from extension
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi && moduleId === "system_info") {
      vscodeApi.postMessage({
        command: "getSystemInfo",
      });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === "systemInfo") {
          setSystemInfo(message.data);
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [moduleId]);

  // Load content from file
  useEffect(() => {
    // 🔥 SIMPLIFIED: No more dynamic imports!
    // Priority 1: Check localStorage first (user edited content)
    const savedContent = localStorage.getItem(`zen-prompt-${moduleId}`);
    if (savedContent) {
      setContent(savedContent);
      setIsLoading(false);
      return;
    }

    // Priority 2: Use defaultContent from props
    let finalContent = defaultContent;

    // 🆕 If this is system_info module and we have systemInfo, inject it
    if (moduleId === "system_info" && systemInfo) {
      finalContent = finalContent
        .replace(/Operating System: .+/, `Operating System: ${systemInfo.os}`)
        .replace(/IDE: .+/, `IDE: ${systemInfo.ide}`)
        .replace(/Default Shell: .+/, `Default Shell: ${systemInfo.shell}`)
        .replace(/Home Directory: .+/, `Home Directory: ${systemInfo.homeDir}`)
        .replace(
          /Current Working Directory: .+/,
          `Current Working Directory: ${systemInfo.cwd}`
        );
    }

    setContent(finalContent);
    setIsLoading(false);
  }, [moduleId, defaultContent, systemInfo]);

  const handleSave = () => {
    localStorage.setItem(`zen-prompt-${moduleId}`, content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    if (
      !confirm(
        "Bạn có chắc muốn reset về nội dung gốc? Thay đổi chưa lưu sẽ bị mất."
      )
    ) {
      return;
    }

    // 🔥 SIMPLIFIED: Just clear localStorage and use defaultContent
    localStorage.removeItem(`zen-prompt-${moduleId}`);
    setContent(defaultContent);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 1002,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </div>
        <span style={{ fontSize: "24px" }}>{moduleEmoji}</span>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--primary-text)",
            margin: 0,
            flex: 1,
          }}
        >
          {moduleTitle}
        </h2>
        <div
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--secondary-text)",
            padding: "4px 8px",
            backgroundColor: "var(--tertiary-bg)",
            borderRadius: "var(--border-radius)",
          }}
        >
          {content.length} chars
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "var(--spacing-lg)",
          gap: "var(--spacing-md)",
        }}
      >
        {/* Editor */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
            overflow: "hidden",
          }}
        >
          {isLoading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--secondary-text)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--spacing-md)",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid var(--border-color)",
                    borderTop: "3px solid var(--accent-text)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <span>Loading content...</span>
              </div>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt content here..."
              style={{
                flex: 1,
                padding: "var(--spacing-lg)",
                backgroundColor: "var(--input-bg)",
                color: "var(--primary-text)",
                border: "none",
                outline: "none",
                fontSize: "var(--font-size-sm)",
                fontFamily: "monospace",
                lineHeight: 1.8,
                resize: "none",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
          }}
        >
          <button
            onClick={handleReset}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "var(--spacing-md)",
              backgroundColor: "var(--button-secondary)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-xs)",
              opacity: isLoading ? 0.5 : 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor =
                  "var(--button-secondary-hover)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--button-secondary)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "var(--spacing-md)",
              backgroundColor: isSaved
                ? "var(--success-color)"
                : "var(--button-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--spacing-xs)",
              opacity: isLoading ? 0.5 : 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading && !isSaved) {
                e.currentTarget.style.backgroundColor =
                  "var(--button-primary-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaved) {
                e.currentTarget.style.backgroundColor = "var(--button-primary)";
              }
            }}
          >
            {isSaved ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default PromptEditorPanel;
