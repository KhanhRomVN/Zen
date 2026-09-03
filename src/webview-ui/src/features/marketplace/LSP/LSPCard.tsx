/**
 * ------------------------------------------------------------------
 * LSP Card Component
 * ------------------------------------------------------------------
 * Card component với context menu (right-click) để Install/Uninstall
 * và option mở folder LSP đã lưu
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { LSPServer } from "../constants/lsp-servers";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";

interface LSPCardProps {
  server: LSPServer;
  onInstall: () => void;
  onUninstall: () => void;
  onOpenFolder?: () => void;
  loading: boolean;
}

export function LSPCard({
  server,
  onInstall,
  onUninstall,
  onOpenFolder,
  loading,
}: LSPCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ top: e.clientY, left: e.clientX });
    setDropdownOpen(true);
  };

  const handleOpenHomepage = () => {
    if (server.homepage) {
      window.open(server.homepage, "_blank");
    }
  };

  const handleInstallClick = () => {
    onInstall();
  };

  const handleUninstallClick = () => {
    onUninstall();
  };

  const handleOpenFolderClick = () => {
    if (onOpenFolder) {
      onOpenFolder();
    }
  };

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      trigger="contextmenu"
      strategy="fixed"
      align="start"
      position={menuPosition}
    >
      <DropdownTrigger asChild>
        <div
          onContextMenu={handleContextMenu}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            transition: "background-color 0.2s",
            cursor: "context-menu",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Icon */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {server.icon ? (
                <img
                  src={server.icon}
                  alt={server.language}
                  style={{
                    width: "32px",
                    height: "32px",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--vscode-focusBorder)" }}
                >
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    margin: 0,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {server.name}
                </h3>
              </div>

              <p
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  margin: "0 0 8px 0",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {server.description}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--vscode-focusBorder)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {server.language}
                </span>

                {!server.installed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInstall();
                    }}
                    disabled={loading}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--secondary-text)",
                      cursor: loading ? "default" : "pointer",
                      opacity: loading ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 0.2s",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor =
                          "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)";
                        e.currentTarget.style.color = "var(--vscode-button-background)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = "var(--input-bg)";
                        e.currentTarget.style.color = "var(--secondary-text)";
                      }
                    }}
                  >
                    {loading ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ animation: "spin 1s linear infinite" }}
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Install
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DropdownTrigger>

      <DropdownContent>
        {server.installed ? (
          <>
            <DropdownItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              }
              onClick={handleUninstallClick}
              disabled={loading}
            >
              Uninstall
            </DropdownItem>
            <DropdownItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
                </svg>
              }
              onClick={handleOpenFolderClick}
            >
              Open LSP Folder
            </DropdownItem>
          </>
        ) : (
          <DropdownItem
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            }
            onClick={handleInstallClick}
            disabled={loading}
          >
            Install
          </DropdownItem>
        )}
        {server.homepage && (
          <DropdownItem
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            }
            onClick={handleOpenHomepage}
          >
            Open Homepage
          </DropdownItem>
        )}
      </DropdownContent>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Dropdown>
  );
}