/**
 * ------------------------------------------------------------------
 * LSP Panel
 * ------------------------------------------------------------------
 * Browse and install Language Server Protocol servers
 * ------------------------------------------------------------------
 */

import React, { useState, useEffect } from 'react';
import { AVAILABLE_LSP_SERVERS, type LSPServer } from '../constants/lsp-servers';
import { isLSPInstalled, markLSPInstalled, unmarkLSPInstalled } from '../services/lsp.service';

export function LSPPanel() {
  const [servers, setServers] = useState<LSPServer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = () => {
    const serversWithStatus = AVAILABLE_LSP_SERVERS.map((server) => ({
      ...server,
      installed: isLSPInstalled(server.id),
    }));
    setServers(serversWithStatus);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      loadServers();
      setLoading(false);
    }, 300);
  };

  const handleInstall = async (server: LSPServer) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate installation
      await new Promise((resolve) => setTimeout(resolve, 1500));
      markLSPInstalled(server.id);
      loadServers();
    } catch (err) {
      console.error('[LSP] Failed to install', server.name, ':', err);
      setError(`Failed to install ${server.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async (serverId: string) => {
    setLoading(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      unmarkLSPInstalled(serverId);
      loadServers();
    } catch (err) {
      console.error('[LSP] Failed to uninstall', serverId, ':', err);
      setError(`Failed to uninstall server`);
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = searchQuery.trim()
    ? servers.filter(
        (server) =>
          server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          server.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
          server.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : servers;

  const displayedServers = showInstalledOnly
    ? filteredServers.filter((server) => server.installed)
    : filteredServers;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder={
                showInstalledOnly ? 'Search installed servers...' : 'Search language servers...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '13px',
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--primary-text)',
                outline: 'none',
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--secondary-text)',
              }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>
          <button
            onClick={() => setShowInstalledOnly(!showInstalledOnly)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: '6px',
              backgroundColor: showInstalledOnly
                ? 'var(--vscode-button-background)'
                : 'var(--tertiary-bg)',
              border: '1px solid var(--border-color)',
              color: showInstalledOnly
                ? 'var(--vscode-button-foreground)'
                : 'var(--secondary-text)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={showInstalledOnly ? 'Show all servers' : 'Show installed only'}
          >
            {showInstalledOnly ? 'Installed' : 'All'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'var(--tertiary-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--secondary-text)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            title="Refresh"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 21h5v-5"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            margin: '12px 16px',
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'rgb(239, 68, 68)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Servers List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayedServers.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--secondary-text)',
              opacity: 0.5,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '12px' }}
            >
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <p style={{ fontSize: '13px' }}>
              {searchQuery.trim()
                ? 'No servers match your search'
                : showInstalledOnly
                  ? 'No installed language servers'
                  : 'No language servers found'}
            </p>
          </div>
        ) : (
          <div>
            {displayedServers.map((server) => (
              <LSPServerItem
                key={server.id}
                server={server}
                onInstall={() => handleInstall(server)}
                onUninstall={() => handleUninstall(server.id)}
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── LSP Server Item ────────────────────────────────────────────────────

interface LSPServerItemProps {
  server: LSPServer;
  onInstall: () => void;
  onUninstall: () => void;
  loading: boolean;
}

function LSPServerItem({ server, onInstall, onUninstall, loading }: LSPServerItemProps) {
  const handleOpenHomepage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (server.homepage) {
      window.open(server.homepage, '_blank');
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
        {/* Icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--tertiary-bg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {server.icon ? (
            <img
              src={server.icon}
              alt={server.language}
              style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--vscode-focusBorder)' }}
            >
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--primary-text)',
                margin: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {server.name}
            </h3>
            {server.installed && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  color: 'rgb(52, 211, 153)',
                  flexShrink: 0,
                }}
              >
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
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                Installed
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: '11px',
              color: 'var(--secondary-text)',
              opacity: 0.7,
              margin: '0 0 8px 0',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {server.description}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--vscode-focusBorder)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {server.language}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {server.homepage && (
                <button
                  onClick={handleOpenHomepage}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--secondary-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  title="Open homepage"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--primary-text)';
                    e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--secondary-text)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
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
                </button>
              )}

              {server.installed ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUninstall();
                  }}
                  disabled={loading}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--secondary-text)',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.color = 'rgb(239, 68, 68)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.color = 'var(--secondary-text)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'transparent';
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
                      style={{ animation: 'spin 1s linear infinite' }}
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
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Uninstall
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstall();
                  }}
                  disabled={loading}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--secondary-text)',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.color = 'var(--primary-text)';
                      e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
                      e.currentTarget.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.color = 'var(--secondary-text)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'transparent';
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
                      style={{ animation: 'spin 1s linear infinite' }}
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
    </div>
  );
}
