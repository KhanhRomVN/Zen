/**
 * ------------------------------------------------------------------
 * AboutSettings
 * ------------------------------------------------------------------
 * Tab About trong Settings Panel
 * Thông tin về Zen extension
 * ------------------------------------------------------------------
 */

import React from "react";

const AboutSettings: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <img
        src={`${(window as any).__zenImagesUri}/icon.png`}
        alt="Zen Logo"
        style={{
          width: "72px",
          height: "72px",
          objectFit: "contain",
          borderRadius: "16px",
        }}
      />
      <div>
        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "var(--primary-text)",
          }}
        >
          Zen
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--secondary-text)",
            opacity: 0.8,
            marginTop: "4px",
          }}
        >
          AI-powered coding assistant extension for VSCode
        </p>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "20px" }}>👨‍💻</span>
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Developer
          </div>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "12px",
              color: "var(--vscode-textLink-foreground, #3794ff)",
              textDecoration: "none",
              marginTop: "2px",
              display: "inline-block",
            }}
          >
            github.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutSettings;
