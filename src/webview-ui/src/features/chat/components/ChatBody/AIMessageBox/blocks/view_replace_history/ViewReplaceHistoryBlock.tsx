import React from "react";
import { extensionService } from "@/services/ExtensionService";
import "./ViewReplaceHistoryBlock.css";

interface VersionInfo {
  version: number;
  errorCount: number;
  warningCount: number;
  lineCount: number;
}

interface ViewReplaceHistoryBlockProps {
  filePath: string;
  histories: VersionInfo[];
  currentVersion?: number;
}

export const ViewReplaceHistoryBlock: React.FC<ViewReplaceHistoryBlockProps> = ({
  filePath,
  histories,
  currentVersion,
}) => {
  const handleCardClick = async (version: number) => {
    try {
      // Gửi message lên extension để mở file _TEMP
      extensionService.postMessage({
        command: "openViewReplaceHistoryVersion",
        filePath,
        version,
      });
    } catch (error) {
      console.error("Error opening version:", error);
    }
  };

  if (!histories || histories.length === 0) {
    return (
      <div className="view-replace-history-block">
        <div className="view-replace-history-empty">
          No version history available
        </div>
      </div>
    );
  }

  return (
    <div className="view-replace-history-block">
      {histories.map((history) => {
        const isCurrent = currentVersion !== undefined && history.version === currentVersion;
        
        return (
          <div
            key={history.version}
            className="view-replace-history-card"
            onClick={() => handleCardClick(history.version)}
            title={`Click to view version ${history.version}`}
          >
            <div className="view-replace-history-card-left">
              <div className="view-replace-history-card-version">
                v{history.version}
              </div>
              <div className="view-replace-history-card-info">
                <div className="view-replace-history-card-diagnostic">
                  {history.errorCount > 0 && (
                    <div className="view-replace-history-card-diagnostic-item view-replace-history-card-diagnostic-error">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M8.6 1c-.2-.4-.7-.4-.9 0L.2 13.1c-.2.3 0 .7.4.7h14.8c.4 0 .6-.4.4-.7L8.6 1zM8 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V5h2v4z" />
                      </svg>
                      {history.errorCount}
                    </div>
                  )}
                  {history.warningCount > 0 && (
                    <div className="view-replace-history-card-diagnostic-item view-replace-history-card-diagnostic-warning">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M7.5 1L1 13h13L7.5 1zm0 11a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm.5-2.5h-1v-5h1v5z" />
                      </svg>
                      {history.warningCount}
                    </div>
                  )}
                  {history.errorCount === 0 && history.warningCount === 0 && (
                    <div
                      className="view-replace-history-card-diagnostic-item"
                      style={{ color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)" }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1-5.5 5.5z" />
                      </svg>
                      Clean
                    </div>
                  )}
                </div>
                <div className="view-replace-history-card-line">
                  {history.lineCount} {history.lineCount === 1 ? "line" : "lines"}
                </div>
              </div>
            </div>
            <div className="view-replace-history-card-right">
              {isCurrent && (
                <div className="view-replace-history-badge-current">
                  CURRENT
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
