/**
 * ------------------------------------------------------------------
 * MCP Panel
 * ------------------------------------------------------------------
 * Empty UI - Coming soon
 * ------------------------------------------------------------------
 */

import React from 'react';

export function MCPPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--secondary-text)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: '16px', opacity: 0.3 }}
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="M12 8v4"></path>
        <path d="M12 16h.01"></path>
      </svg>
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--primary-text)',
          marginBottom: '8px',
        }}
      >
        MCP Servers Marketplace
      </h3>
      <p style={{ fontSize: '13px', opacity: 0.7, maxWidth: '300px' }}>
        Browse and configure Model Context Protocol servers. Coming soon!
      </p>
    </div>
  );
}
