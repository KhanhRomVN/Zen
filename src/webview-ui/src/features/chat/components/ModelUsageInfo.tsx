import React from "react";
import "./ModelUsageInfo.css";

interface ModelUsageInfoProps {
  /** Provider ID (e.g., "deepseek", "openai") */
  providerId?: string;
  /** Model ID (e.g., "deepseek-instant", "gpt-4") */
  modelId: string;
  /** User email/account */
  email?: string;
  /** Website URL to extract favicon */
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

  return (
    <div className="model-usage-info">
      <div className="model-usage-icon">
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl}
            alt="Model provider icon"
            className="model-favicon"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span className="codicon codicon-server-process" />
        )}
      </div>
      
      <div className="model-usage-content">
        <span className="model-name">{modelText}</span>
        {accountText && (
          <>
            <span className="model-usage-separator">•</span>
            <span className="model-account">{email}</span>
          </>
        )}
      </div>
    </div>
  );
};
