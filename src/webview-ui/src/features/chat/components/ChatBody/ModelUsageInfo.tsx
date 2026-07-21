import React from "react";

interface ModelUsageInfoProps {
  providerId?: string;
  modelId: string;
  email?: string;
  websiteUrl?: string;
}

/**
 * ModelUsageInfo displays information about which model and account was used
 * for an AI response. Features a prominent design with favicon/icon, model name,
 * and user account.
 */
export const ModelUsageInfo: React.FC<ModelUsageInfoProps> = ({
  providerId,
  modelId,
  email,
  websiteUrl,
}) => {
  const [faviconError, setFaviconError] = React.useState(false);

  // Extract favicon URL from website
  let faviconUrl: string | undefined = undefined;
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      faviconUrl = `${url.origin}/favicon.ico`;
    } catch (e) {
      // Ignore invalid URL
    }
  }

  // Build display text
  const providerPrefix = providerId ? `${providerId}/` : "";
  const modelText = `${providerPrefix}${modelId}`;
  const accountText = email ? ` by ${email}` : "";

  // Inline styles
  const containerStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 16px",
    margin: "8px 0",
    background:
      "color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 10%, transparent)",
    border:
      "1.5px dashed color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 40%, transparent)",
    borderRadius: "10px",
    overflow: "hidden",
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "7px",
    padding: "5px",
    position: "relative",
    zIndex: 2,
  };

  const faviconStyle: React.CSSProperties = {
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    objectFit: "contain",
  };

  const codiconStyle: React.CSSProperties = {
    fontSize: "18px",
    color: "var(--vscode-badge-foreground, #ffffff)",
  };

  const contentStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap",
    position: "relative",
    zIndex: 2,
  };

  const modelNameStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--vscode-badge-foreground, #ffffff)",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
  };

  const separatorStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    opacity: 0.5,
  };

  const accountStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--vscode-descriptionForeground)",
    opacity: 0.9,
  };

  const afterStyle: React.CSSProperties = {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: "10px",
    backgroundImage:
      "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='rgba(77, 77, 77, 0.4)' stroke-width='2' stroke-dasharray='8 6' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e\")",
    pointerEvents: "none",
    zIndex: 1,
  };

  const beforeStyle: React.CSSProperties = {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: "10px",
    padding: "1.5px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 60%, transparent), color-mix(in srgb, var(--vscode-focusBorder, #007acc) 40%, transparent), color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 60%, transparent))",
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle}>
      {/* Pseudo-element ::before */}
      <div style={beforeStyle} />
      {/* Pseudo-element ::after */}
      <div style={afterStyle} />

      <div style={iconStyle}>
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl}
            alt="Model provider icon"
            style={faviconStyle}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span
            className="codicon codicon-server-process"
            style={codiconStyle}
          />
        )}
      </div>

      <div style={contentStyle}>
        <span style={modelNameStyle}>{modelText}</span>
        {accountText && (
          <>
            <span style={separatorStyle}>•</span>
            <span style={accountStyle}>{email}</span>
          </>
        )}
      </div>
    </div>
  );
};
