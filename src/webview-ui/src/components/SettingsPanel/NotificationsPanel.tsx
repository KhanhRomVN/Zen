import React, { useState } from "react";

interface NotificationsPanelProps {
  onBack: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ onBack }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 1001,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--primary-text)",
            margin: 0,
          }}
        >
          Notifications
        </h2>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
        }}
      >
        <div
          style={{
            padding: "var(--spacing-lg)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          {/* Master Toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "var(--spacing-md)",
              borderBottom: "1px solid var(--border-color)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--font-size-md)",
                  color: "var(--primary-text)",
                  fontWeight: 600,
                }}
              >
                Enable Notifications
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Master toggle for all notifications
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                backgroundColor: notificationsEnabled
                  ? "var(--accent-text)"
                  : "var(--border-color)",
                position: "relative",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  position: "absolute",
                  top: "2px",
                  left: notificationsEnabled ? "22px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* Error Notifications */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "var(--spacing-md)",
              borderBottom: "1px solid var(--border-color)",
              marginBottom: "var(--spacing-md)",
              opacity: notificationsEnabled ? 1 : 0.5,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--font-size-md)",
                  color: "var(--primary-text)",
                  fontWeight: 600,
                }}
              >
                Error Notifications
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Show notifications when errors occur
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                backgroundColor: notifyOnError
                  ? "var(--accent-text)"
                  : "var(--border-color)",
                position: "relative",
                cursor: notificationsEnabled ? "pointer" : "not-allowed",
                transition: "background-color 0.2s",
              }}
              onClick={() =>
                notificationsEnabled && setNotifyOnError(!notifyOnError)
              }
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  position: "absolute",
                  top: "2px",
                  left: notifyOnError ? "22px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* Success Notifications */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: notificationsEnabled ? 1 : 0.5,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--font-size-md)",
                  color: "var(--primary-text)",
                  fontWeight: 600,
                }}
              >
                Success Notifications
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Show notifications when tasks complete successfully
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                backgroundColor: notifyOnSuccess
                  ? "var(--accent-text)"
                  : "var(--border-color)",
                position: "relative",
                cursor: notificationsEnabled ? "pointer" : "not-allowed",
                transition: "background-color 0.2s",
              }}
              onClick={() =>
                notificationsEnabled && setNotifyOnSuccess(!notifyOnSuccess)
              }
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  position: "absolute",
                  top: "2px",
                  left: notifyOnSuccess ? "22px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPanel;
