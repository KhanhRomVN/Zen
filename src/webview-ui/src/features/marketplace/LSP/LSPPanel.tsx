/**
 * ------------------------------------------------------------------
 * LSP Panel (Refactored)
 * ------------------------------------------------------------------
 * Browse and install Language Server Protocol servers
 * UI style inspired by Account panel
 * ------------------------------------------------------------------
 */

import React, { useState, useEffect } from 'react';
import { AVAILABLE_LSP_SERVERS, type LSPServer } from '../constants/lsp-servers';
import { isLSPInstalled, markLSPInstalled, unmarkLSPInstalled } from '../services/lsp.service';
import { LSPCard } from './LSPCard';
import { extensionService } from "../../../services/ExtensionService";

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

  const handleOpenFolder = (server: LSPServer) => {
    extensionService.postMessage({
      command: "openLspFolder",
      packageName: server.npmPackage,
    });
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
      {/* Search Bar - Account panel style */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--tertiary-bg)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder={
                showInstalledOnly ? 'Search installed servers...' : 'Search language servers...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: '13px',
                backgroundColor: 'var(--input-bg)',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--primary-text)',
                outline: 'none',
                boxSizing: 'border-box',
                height: '34px',
              }}
            />
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
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--secondary-text)',
              }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowInstalledOnly(!showInstalledOnly)}
            onMouseEnter={(e) => {
              if (!showInstalledOnly) {
                e.currentTarget.style.backgroundColor =
                  'color-mix(in srgb, var(--vscode-button-background) 15%, transparent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showInstalledOnly) {
                e.currentTarget.style.backgroundColor = 'var(--input-bg)';
              }
            }}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: showInstalledOnly
                ? 'var(--vscode-button-background)'
                : 'var(--input-bg)',
              border: 'none',
              color: showInstalledOnly
                ? 'var(--vscode-button-foreground)'
                : 'var(--secondary-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title={showInstalledOnly ? 'Show all servers' : 'Show installed only'}
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
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor =
                  'color-mix(in srgb, var(--vscode-button-background) 15%, transparent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--input-bg)';
              }
            }}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--input-bg)',
              border: 'none',
              color: 'var(--secondary-text)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
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
              <LSPCard
                key={server.id}
                server={server}
                onInstall={() => handleInstall(server)}
                onUninstall={() => handleUninstall(server.id)}
                onOpenFolder={() => handleOpenFolder(server)}
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
