import React, { useState } from "react";
import { useModels } from "../../hooks/useModels";

interface ModelsPanelProps {
  onBack: () => void;
}

const ModelsPanel: React.FC<ModelsPanelProps> = ({ onBack }) => {
  const {
    models,
    addModel: addModelToStore,
    updateModel,
    deleteModel: deleteModelFromStore,
  } = useModels();
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

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
          Models Management
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
        {/* Add/Edit Form */}
        <div
          style={{
            marginBottom: "var(--spacing-lg)",
            padding: "var(--spacing-md)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--font-size-lg)",
              color: "var(--primary-text)",
              marginBottom: "var(--spacing-md)",
              margin: 0,
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
              marginTop: "var(--spacing-md)",
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
                    fontWeight: 500,
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
                    fontWeight: 500,
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
                  fontWeight: 500,
                }}
              >
                Add Model
              </button>
            )}
          </div>
        </div>

        {/* Models List */}
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-lg)",
              color: "var(--primary-text)",
              marginBottom: "var(--spacing-md)",
              margin: 0,
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
                backgroundColor: "var(--primary-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius-lg)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--font-size-md)",
                    color: "var(--primary-text)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {model.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                    marginTop: "var(--spacing-xs)",
                  }}
                >
                  {model.id}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--spacing-xs)",
                  marginLeft: "var(--spacing-sm)",
                }}
              >
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
                    fontWeight: 500,
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
                    fontWeight: 500,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelsPanel;
