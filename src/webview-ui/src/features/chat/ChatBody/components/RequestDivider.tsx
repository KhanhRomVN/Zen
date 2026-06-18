import React from "react";

interface RequestDividerProps {
  requestNumber: number | null;
}

const RequestDivider: React.FC<RequestDividerProps> = ({ requestNumber }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-sm)",
        margin: "var(--spacing-md) 0",
      }}
    >
      <div
        style={{
          flex: 1,
          height: "1px",
          borderTop: "1px dashed var(--vscode-descriptionForeground)",
          opacity: 0.6,
        }}
      />
      <span
        style={{
          fontSize: "var(--font-size-sm)",
          color: "var(--vscode-descriptionForeground)",
          fontWeight: 600,
          padding: "0 8px",
        }}
      >
        REQUEST {requestNumber}
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          borderTop: "1px dashed var(--vscode-descriptionForeground)",
          opacity: 0.6,
        }}
      />
    </div>
  );
};

export default RequestDivider;
