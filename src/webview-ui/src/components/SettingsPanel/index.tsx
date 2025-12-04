import React, { useState } from "react";
import { useModels } from "../../hooks/useModels";

interface Model {
  id: string;
  name: string;
}

interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  description: string;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    "models" | "context" | "checkpoints" | "notifications"
  >("models");

  // Models State - Using shared hook
  const {
    models,
    addModel: addModelToStore,
    updateModel,
    deleteModel: deleteModelFromStore,
  } = useModels();
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  // Context Window State
  const [contextWindowSize, setContextWindowSize] = useState(128);

  // Checkpoints State
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([
    {
      id: "1",
      name: "Initial Setup",
      timestamp: "2024-12-01 10:00 AM",
      description: "Project initialization",
    },
    {
      id: "2",
      name: "Feature Complete",
      timestamp: "2024-12-03 02:30 PM",
      description: "All features implemented",
    },
  ]);
  const [newCheckpointName, setNewCheckpointName] = useState("");
  const [newCheckpointDesc, setNewCheckpointDesc] = useState("");

  // Notifications State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);

  // Model Management Functions
  const addModel = () => {
    if (newModelId && newModelName) {
      addModelToStore({ id: newModelId, name: newModelName });
      setNewModelId("");
      setNewModelName("");
    }
  };

  const deleteModel = (id: string) => {
    deleteModelFromStore(id);
  };

  const startEditModel = (id: string) => {
    setEditingModelId(id);
    const model = models.find((m) => m.id === id);
    if (model) {
      setNewModelId(model.id);
      setNewModelName(model.name);
    }
  };

  const saveEditModel = () => {
    if (editingModelId && newModelId && newModelName) {
      updateModel(editingModelId, { id: newModelId, name: newModelName });
      setEditingModelId(null);
      setNewModelId("");
      setNewModelName("");
    }
  };

  const cancelEdit = () => {
    setEditingModelId(null);
    setNewModelId("");
    setNewModelName("");
  };

  // Checkpoint Management Functions
  const createCheckpoint = () => {
    if (newCheckpointName) {
      const now = new Date();
      const timestamp = now.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setCheckpoints([
        ...checkpoints,
        {
          id: Date.now().toString(),
          name: newCheckpointName,
          timestamp,
          description: newCheckpointDesc,
        },
      ]);
      setNewCheckpointName("");
      setNewCheckpointDesc("");
    }
  };

  const deleteCheckpoint = (id: string) => {
    setCheckpoints(checkpoints.filter((c) => c.id !== id));
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "var(--primary-bg)",
          zIndex: 1000,
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
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              margin: 0,
            }}
          >
            Settings
          </h2>
          <div
            style={{
              cursor: "pointer",
              padding: "var(--spacing-xs)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
            }}
            onClick={onClose}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-color)",
            padding: "0 var(--spacing-lg)",
          }}
        >
          {(["models", "context", "checkpoints", "notifications"] as const).map(
            (tab) => (
              <div
                key={tab}
                style={{
                  flex: 1,
                  padding: "var(--spacing-md)",
                  cursor: "pointer",
                  borderBottom:
                    activeTab === tab ? "2px solid var(--accent-text)" : "none",
                  color:
                    activeTab === tab
                      ? "var(--accent-text)"
                      : "var(--secondary-text)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  textAlign: "center",
                  textTransform: "capitalize",
                  transition: "all 0.2s",
                }}
                onClick={() => setActiveTab(tab)}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = "var(--primary-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = "var(--secondary-text)";
                  }
                }}
              >
                {tab}
              </div>
            )
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--spacing-lg)",
          }}
        >
          {/* Models Tab */}
          {activeTab === "models" && (
            <div>
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <h3
                  style={{
                    fontSize: "var(--font-size-lg)",
                    color: "var(--primary-text)",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  {editingModelId ? "Edit Model" : "Add New Model"}
                </h3>
                <input
                  type="text"
                  placeholder="Model ID (e.g., gpt-4)"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-sm)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--primary-text)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-md)",
                    outline: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Model Name (e.g., GPT-4)"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-sm)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--primary-text)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-md)",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                  {editingModelId ? (
                    <>
                      <button
                        onClick={saveEditModel}
                        style={{
                          flex: 1,
                          padding: "var(--spacing-sm)",
                          backgroundColor: "var(--button-primary)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "var(--border-radius)",
                          fontSize: "var(--font-size-sm)",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          flex: 1,
                          padding: "var(--spacing-sm)",
                          backgroundColor: "var(--button-secondary)",
                          color: "var(--primary-text)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "var(--font-size-sm)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={addModel}
                      style={{
                        width: "100%",
                        padding: "var(--spacing-sm)",
                        backgroundColor: "var(--button-primary)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-sm)",
                        cursor: "pointer",
                      }}
                    >
                      Add Model
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3
                  style={{
                    fontSize: "var(--font-size-lg)",
                    color: "var(--primary-text)",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  Available Models
                </h3>
                {models.map((model) => (
                  <div
                    key={model.id}
                    style={{
                      padding: "var(--spacing-md)",
                      marginBottom: "var(--spacing-sm)",
                      backgroundColor: "var(--secondary-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--border-radius)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
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
                        {model.name}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--secondary-text)",
                        }}
                      >
                        {model.id}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
                      <button
                        onClick={() => startEditModel(model.id)}
                        style={{
                          padding: "var(--spacing-xs) var(--spacing-sm)",
                          backgroundColor: "var(--button-secondary)",
                          color: "var(--primary-text)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "var(--font-size-xs)",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteModel(model.id)}
                        style={{
                          padding: "var(--spacing-xs) var(--spacing-sm)",
                          backgroundColor: "var(--error-color)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "var(--border-radius)",
                          fontSize: "var(--font-size-xs)",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context Window Tab */}
          {activeTab === "context" && (
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-lg)",
                  color: "var(--primary-text)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                Context Window Size
              </h3>
              <div
                style={{
                  padding: "var(--spacing-lg)",
                  backgroundColor: "var(--secondary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-md)",
                      color: "var(--primary-text)",
                    }}
                  >
                    Current Size:
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-size-lg)",
                      fontWeight: 600,
                      color: "var(--accent-text)",
                    }}
                  >
                    {contextWindowSize}K
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="256"
                  step="8"
                  value={contextWindowSize}
                  onChange={(e) =>
                    setContextWindowSize(parseInt(e.target.value))
                  }
                  style={{
                    width: "100%",
                    marginBottom: "var(--spacing-sm)",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                  }}
                >
                  <span>8K</span>
                  <span>128K (Default)</span>
                  <span>256K</span>
                </div>
              </div>
            </div>
          )}

          {/* Checkpoints Tab */}
          {activeTab === "checkpoints" && (
            <div>
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <h3
                  style={{
                    fontSize: "var(--font-size-lg)",
                    color: "var(--primary-text)",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  Create Checkpoint
                </h3>
                <input
                  type="text"
                  placeholder="Checkpoint Name"
                  value={newCheckpointName}
                  onChange={(e) => setNewCheckpointName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-sm)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--primary-text)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-md)",
                    outline: "none",
                  }}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newCheckpointDesc}
                  onChange={(e) => setNewCheckpointDesc(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-sm)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--primary-text)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-md)",
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={createCheckpoint}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm)",
                    backgroundColor: "var(--button-primary)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  Create Checkpoint
                </button>
              </div>

              <div>
                <h3
                  style={{
                    fontSize: "var(--font-size-lg)",
                    color: "var(--primary-text)",
                    marginBottom: "var(--spacing-md)",
                  }}
                >
                  Saved Checkpoints
                </h3>
                {checkpoints.map((checkpoint) => (
                  <div
                    key={checkpoint.id}
                    style={{
                      padding: "var(--spacing-md)",
                      marginBottom: "var(--spacing-sm)",
                      backgroundColor: "var(--secondary-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--border-radius)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        marginBottom: "var(--spacing-xs)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "var(--font-size-md)",
                            color: "var(--primary-text)",
                            fontWeight: 600,
                          }}
                        >
                          {checkpoint.name}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--secondary-text)",
                            marginTop: "var(--spacing-xs)",
                          }}
                        >
                          {checkpoint.timestamp}
                        </div>
                        {checkpoint.description && (
                          <div
                            style={{
                              fontSize: "var(--font-size-sm)",
                              color: "var(--secondary-text)",
                              marginTop: "var(--spacing-xs)",
                            }}
                          >
                            {checkpoint.description}
                          </div>
                        )}
                      </div>
                      <div
                        style={{ display: "flex", gap: "var(--spacing-xs)" }}
                      >
                        <button
                          style={{
                            padding: "var(--spacing-xs) var(--spacing-sm)",
                            backgroundColor: "var(--button-secondary)",
                            color: "var(--primary-text)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "var(--font-size-xs)",
                            cursor: "pointer",
                          }}
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => deleteCheckpoint(checkpoint.id)}
                          style={{
                            padding: "var(--spacing-xs) var(--spacing-sm)",
                            backgroundColor: "var(--error-color)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "var(--border-radius)",
                            fontSize: "var(--font-size-xs)",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-lg)",
                  color: "var(--primary-text)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                Notification Settings
              </h3>
              <div
                style={{
                  padding: "var(--spacing-lg)",
                  backgroundColor: "var(--secondary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                }}
              >
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
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    style={{
                      width: "20px",
                      height: "20px",
                      cursor: "pointer",
                    }}
                  />
                </div>

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
                  <input
                    type="checkbox"
                    checked={notifyOnError}
                    onChange={(e) => setNotifyOnError(e.target.checked)}
                    disabled={!notificationsEnabled}
                    style={{
                      width: "20px",
                      height: "20px",
                      cursor: notificationsEnabled ? "pointer" : "not-allowed",
                    }}
                  />
                </div>

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
                  <input
                    type="checkbox"
                    checked={notifyOnSuccess}
                    onChange={(e) => setNotifyOnSuccess(e.target.checked)}
                    disabled={!notificationsEnabled}
                    style={{
                      width: "20px",
                      height: "20px",
                      cursor: notificationsEnabled ? "pointer" : "not-allowed",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
