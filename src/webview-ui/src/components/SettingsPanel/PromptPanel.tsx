import React, { useState } from "react";
import PromptEditorPanel from "./PromptEditorPanel";
import * as PromptModules from "./prompts";

interface PromptPanelProps {
  onBack: () => void;
}

interface PromptModule {
  id: string;
  title: string;
  description: string;
  emoji: string;
  filePath: string;
  category: "core" | "tools" | "rules" | "modes" | "examples" | "system";
  content: string; // 🆕 Thêm field content
}

const PROMPT_MODULES: PromptModule[] = [
  // Core
  {
    id: "core",
    title: "Core Identity",
    description: "Role, ngôn ngữ, workflow và top 4 critical rules",
    emoji: "🎯",
    filePath: "core.ts",
    category: "core",
    content: PromptModules.CORE,
  },
  // Tools
  {
    id: "tools",
    title: "Tools Reference",
    description: "File operations, execution, communication tools",
    emoji: "🔧",
    filePath: "tools.ts",
    category: "tools",
    content: PromptModules.TOOLS,
  },
  // Rules
  {
    id: "rules",
    title: "Critical Rules",
    description:
      "R1-R5: Read-before-replace, Ask-when-unclear, Code-wrapping, etc",
    emoji: "📋",
    filePath: "rules.ts",
    category: "rules",
    content: PromptModules.RULES,
  },
  // System
  {
    id: "system_info",
    title: "System Information",
    description: "OS, IDE, shell, directories, capabilities overview",
    emoji: "ℹ️",
    filePath: "system.ts",
    category: "system",
    content: PromptModules.SYSTEM,
  },
];

const CATEGORY_INFO: Record<string, { title: string; color: string }> = {
  core: { title: "Core Prompts", color: "#3b82f6" },
  tools: { title: "Tools", color: "#10b981" },
  rules: { title: "Rules", color: "#f59e0b" },
  modes: { title: "Modes", color: "#a855f7" },
  examples: { title: "Examples", color: "#ec4899" },
  system: { title: "System", color: "#6b7280" },
};

const PromptPanel: React.FC<PromptPanelProps> = ({ onBack }) => {
  const [editingModule, setEditingModule] = useState<PromptModule | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem("zen-prompt-language") || "vietnamese";
  });

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    localStorage.setItem("zen-prompt-language", language);
  };

  const handleCardClick = (module: PromptModule) => {
    // Open editor panel instead of VS Code editor
    setEditingModule(module);
  };

  const handleEditorBack = () => {
    setEditingModule(null);
  };

  // Show editor panel if editing
  if (editingModule) {
    return (
      <PromptEditorPanel
        moduleId={editingModule.id}
        moduleTitle={editingModule.title}
        moduleEmoji={editingModule.emoji}
        filePath={editingModule.filePath}
        defaultContent={editingModule.content}
        onBack={handleEditorBack}
      />
    );
  }

  // Group modules by category
  const groupedModules = PROMPT_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, PromptModule[]>);

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
          Rule Prompt Modules
        </h2>
      </div>

      {/* Language Selector */}
      <div
        style={{
          padding: "var(--spacing-md) var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--secondary-bg)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--secondary-text)",
            fontWeight: 600,
          }}
        >
          🌐 Language:
        </span>
        <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
          {["vietnamese", "english"].map((lang) => (
            <div
              key={lang}
              style={{
                padding: "var(--spacing-xs) var(--spacing-md)",
                backgroundColor:
                  selectedLanguage === lang
                    ? "var(--accent-text)"
                    : "var(--primary-bg)",
                color:
                  selectedLanguage === lang ? "#ffffff" : "var(--primary-text)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius)",
                cursor: "pointer",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onClick={() => handleLanguageChange(lang)}
              onMouseEnter={(e) => {
                if (selectedLanguage !== lang) {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedLanguage !== lang) {
                  e.currentTarget.style.backgroundColor = "var(--primary-bg)";
                }
              }}
            >
              {lang === "vietnamese" ? "Tiếng Việt" : "English"}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-xl)",
        }}
      >
        {/* Grouped Cards */}
        {Object.entries(groupedModules).map(([category, modules]) => {
          const categoryInfo = CATEGORY_INFO[category];
          return (
            <div key={category}>
              {/* Category Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-xs)",
                  marginBottom: "var(--spacing-md)",
                  paddingBottom: "var(--spacing-xs)",
                  borderBottom: "2px solid var(--border-color)",
                }}
              >
                <div
                  style={{
                    width: "4px",
                    height: "20px",
                    backgroundColor: categoryInfo.color,
                    borderRadius: "2px",
                  }}
                />
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-md)",
                    fontWeight: 600,
                    color: categoryInfo.color,
                    letterSpacing: "0.5px",
                  }}
                >
                  {categoryInfo.title}
                </h3>
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                    marginLeft: "auto",
                  }}
                >
                  {modules.length} module{modules.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "var(--spacing-sm)",
                }}
              >
                {modules.map((module) => (
                  <div
                    key={module.id}
                    style={{
                      padding: "var(--spacing-md)",
                      backgroundColor: "var(--primary-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--border-radius-lg)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onClick={() => handleCardClick(module)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                      e.currentTarget.style.borderColor = categoryInfo.color;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--primary-bg)";
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-sm)",
                        marginBottom: "var(--spacing-xs)",
                      }}
                    >
                      <span style={{ fontSize: "24px" }}>{module.emoji}</span>
                      <span
                        style={{
                          fontSize: "var(--font-size-md)",
                          fontWeight: 600,
                          color: "var(--primary-text)",
                          flex: 1,
                        }}
                      >
                        {module.title}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ opacity: 0.5 }}
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        lineHeight: 1.4,
                      }}
                    >
                      {module.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromptPanel;
