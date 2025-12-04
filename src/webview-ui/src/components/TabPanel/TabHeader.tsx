import React from "react";

const TabHeader: React.FC = () => {
  return (
    <div className="chat-header">
      <div
        className="chat-header-content"
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-md)",
          }}
        >
          <div className="chat-avatar">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#E8EAF6" />
              <path
                d="M18 20C18 18.8954 18.8954 18 20 18C21.1046 18 22 18.8954 22 20C22 21.1046 21.1046 22 20 22C18.8954 22 18 21.1046 18 20Z"
                fill="#3F51B5"
              />
              <path
                d="M26 20C26 18.8954 26.8954 18 28 18C29.1046 18 30 18.8954 30 20C30 21.1046 29.1046 22 28 22C26.8954 22 26 21.1046 26 20Z"
                fill="#3F51B5"
              />
              <path
                d="M24 28C26.7614 28 29 25.7614 29 23H19C19 25.7614 21.2386 28 24 28Z"
                fill="#3F51B5"
              />
            </svg>
          </div>
          <div className="chat-title">
            <h1 style={{ margin: 0, fontSize: "var(--font-size-xxl)" }}>Zen</h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabHeader;
