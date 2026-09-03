/**
 * ------------------------------------------------------------------
 * Skill Panel
 * ------------------------------------------------------------------
 * Empty UI - Coming soon
 * ------------------------------------------------------------------
 */

import React from 'react';

export function SkillPanel() {
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
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--primary-text)',
          marginBottom: '8px',
        }}
      >
        Skills Marketplace
      </h3>
      <p style={{ fontSize: '13px', opacity: 0.7, maxWidth: '300px' }}>
        Browse and install skills for Zen. Coming soon!
      </p>
    </div>
  );
}
