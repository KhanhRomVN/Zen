import React, { useState } from "react";

interface HistoryItem {
  id: string;
  timestamp: string;
  task: string;
  status: "success" | "error" | "pending";
  tokens: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
  const [historyItems] = useState<HistoryItem[]>([
    {
      id: "1",
      timestamp: "2024-12-03 12:53 PM",
      task: "Thêm hệ thống context cho ZenCLI",
      status: "success",
      tokens: "+1.4m | 119.6k",
    },
    {
      id: "2",
      timestamp: "2024-12-03 12:41 PM",
      task: "Thêm hàm trừ 2 số nguyên cho file test.py",
      status: "success",
      tokens: "+180.2k | 7.6k",
    },
    {
      id: "3",
      timestamp: "2024-12-03 12:37 PM",
      task: "Tạo component ChatInput với validation",
      status: "error",
      tokens: "+176.1k | 6.6k",
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredHistory = historyItems.filter((item) =>
    item.task.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "var(--success-color)";
      case "error":
        return "var(--error-color)";
      case "pending":
        return "var(--warning-color)";
      default:
        return "var(--secondary-text)";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "pending":
        return "⟳";
      default:
        return "•";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "var(--primary-bg)",
          zIndex: 1000,
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
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              margin: 0,
            }}
          >
            History
          </h2>
          <div
            style={{
              cursor: "pointer",
              padding: "var(--spacing-xs)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
            }}
            onClick={onClose}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "var(--spacing-lg)" }}>
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-md)",
              outline: "none",
            }}
          />
        </div>

        {/* History List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 var(--spacing-lg) var(--spacing-lg)",
          }}
        >
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "var(--spacing-md)",
                marginBottom: "var(--spacing-md)",
                backgroundColor: "var(--secondary-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                e.currentTarget.style.borderColor = "var(--accent-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                  }}
                >
                  {item.timestamp}
                </span>
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: getStatusColor(item.status),
                    fontWeight: 600,
                  }}
                >
                  {getStatusIcon(item.status)}
                </span>
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-md)",
                  color: "var(--primary-text)",
                  marginBottom: "var(--spacing-xs)",
                  lineHeight: 1.4,
                }}
              >
                {item.task}
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                }}
              >
                {item.tokens}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "var(--spacing-lg)",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            gap: "var(--spacing-sm)",
          }}
        >
          <button
            style={{
              flex: 1,
              padding: "var(--spacing-sm)",
              backgroundColor: "var(--button-secondary)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--button-secondary-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--button-secondary)";
            }}
          >
            Clear History
          </button>
          <button
            style={{
              flex: 1,
              padding: "var(--spacing-sm)",
              backgroundColor: "var(--button-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--button-primary-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--button-primary)";
            }}
          >
            Export History
          </button>
        </div>
      </div>
    </>
  );
};

export default HistoryPanel;
