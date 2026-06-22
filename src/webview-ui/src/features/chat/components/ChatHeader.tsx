import React from "react";

interface ChatHeaderProps {
  displayedModel: any;
  currentAccount: any;
  currentTaskName: string | null;
  contextUsage: { prompt: number; completion: number; total: number };
  isSearchOpen: boolean;
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayedModel,
  currentAccount,
  currentTaskName,
  contextUsage,
  isSearchOpen,
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
}) => {
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId = displayedModel?.providerId || "";
  const faviconUrl = providerId
    ? `https://www.google.com/s2/favicons?domain=${(() => {
        const pid = providerId.toLowerCase();
        if (pid.includes("openai")) return "openai.com";
        if (pid.includes("anthropic")) return "anthropic.com";
        if (pid.includes("google") || pid.includes("gemini"))
          return "google.com";
        if (pid.includes("openrouter")) return "openrouter.ai";
        if (pid.includes("deepseek")) return "deepseek.com";
        if (pid.includes("zenmux") || pid.includes("moonshotai"))
          return "zenmux.ai";
        if (pid.includes("qwen")) return "qwen.ai";
        if (pid.includes("groq")) return "groq.com";
        if (pid.includes("mistral")) return "mistral.ai";
        if (pid.includes("glm") || pid.includes("zai") || pid.includes("z-ai"))
          return "bigmodel.cn";
        return "deepseek.com";
      })()}&sz=64`
    : "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";

  return (
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
            {displayedModel?.providerId || "?"}/{displayedModel?.id || "chat"}
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
  );
};

export default ChatHeader;