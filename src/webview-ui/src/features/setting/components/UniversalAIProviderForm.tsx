import React, { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────
interface ProviderConfig {
  host: string;
  route: string;
  models: string[];
  headers: [string, string][];
  body: string;
  resp: string;
  err: string;
}

type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "cohere"
  | "ollama"
  | "groq"
  | "custom";

// ── Data ───────────────────────────────────────────────
const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    host: "https://api.openai.com/v1",
    route: "/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    headers: [
      ["Authorization", "Bearer {{api_key}}"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "messages": [{"role":"user","content":"{{message}}"}],\n  "max_tokens": 1024\n}',
    resp: "choices[0].message.content",
    err: "error.message",
  },
  anthropic: {
    host: "https://api.anthropic.com",
    route: "/v1/messages",
    models: [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ],
    headers: [
      ["x-api-key", "{{api_key}}"],
      ["anthropic-version", "2023-06-01"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "max_tokens": 1024,\n  "messages": [{"role":"user","content":"{{message}}"}]\n}',
    resp: "content[0].text",
    err: "error.message",
  },
  gemini: {
    host: "https://generativelanguage.googleapis.com",
    route: "/v1beta/models/{{model}}:generateContent?key={{api_key}}",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    headers: [["Content-Type", "application/json"]],
    body: '{\n  "contents": [{"parts":[{"text":"{{message}}"}]}]\n}',
    resp: "candidates[0].content.parts[0].text",
    err: "error.message",
  },
  mistral: {
    host: "https://api.mistral.ai/v1",
    route: "/chat/completions",
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mixtral-8x7b",
    ],
    headers: [
      ["Authorization", "Bearer {{api_key}}"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "messages": [{"role":"user","content":"{{message}}"}]\n}',
    resp: "choices[0].message.content",
    err: "error.message",
  },
  cohere: {
    host: "https://api.cohere.ai/v1",
    route: "/chat",
    models: ["command-r-plus", "command-r", "command", "command-light"],
    headers: [
      ["Authorization", "Bearer {{api_key}}"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "message": "{{message}}"\n}',
    resp: "text",
    err: "message",
  },
  ollama: {
    host: "http://localhost:11434",
    route: "/api/chat",
    models: ["llama3.2", "mistral", "phi3", "gemma2"],
    headers: [["Content-Type", "application/json"]],
    body: '{\n  "model": "{{model}}",\n  "messages": [{"role":"user","content":"{{message}}"}],\n  "stream": false\n}',
    resp: "message.content",
    err: "error",
  },
  groq: {
    host: "https://api.groq.com/openai/v1",
    route: "/chat/completions",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    headers: [
      ["Authorization", "Bearer {{api_key}}"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "messages": [{"role":"user","content":"{{message}}"}]\n}',
    resp: "choices[0].message.content",
    err: "error.message",
  },
  custom: {
    host: "https://",
    route: "/v1/chat",
    models: [],
    headers: [
      ["Authorization", "Bearer {{api_key}}"],
      ["Content-Type", "application/json"],
    ],
    body: '{\n  "model": "{{model}}",\n  "messages": [{"role":"user","content":"{{message}}"}]\n}',
    resp: "",
    err: "",
  },
};

const PROVIDER_COLORS: Record<ProviderId, string> = {
  openai: "#10a37f",
  anthropic: "#d97757",
  gemini: "#4285f4",
  mistral: "#ff7000",
  cohere: "#39594d",
  ollama: "#888",
  groq: "#f55036",
  custom: "#b4b2a9",
};

const PROVIDER_IDS: ProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "cohere",
  "ollama",
  "groq",
  "custom",
];

// ── Styles ─────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "var(--tertiary-bg)",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  padding: "14px 16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--secondary-text)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  marginBottom: "10px",
  opacity: 0.8,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--secondary-text)",
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  background: "var(--input-bg)",
  color: "var(--primary-text)",
  fontSize: "13px",
  fontFamily: "var(--vscode-font-family, inherit)",
  outline: "none",
  boxSizing: "border-box",
};

const monoInputStyle: React.CSSProperties = {
  ...inputBaseStyle,
  fontFamily: "var(--vscode-editor-font-family, monospace)",
  fontSize: "12px",
};

const hintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--secondary-text)",
  opacity: 0.7,
  marginTop: "3px",
};

const badgeStyle = (color: "green" | "blue"): React.CSSProperties => ({
  display: "inline-block",
  padding: "1px 7px",
  borderRadius: "10px",
  fontSize: "10px",
  fontWeight: 500,
  background:
    color === "green"
      ? "rgba(34,197,94,0.15)"
      : "rgba(59,130,246,0.15)",
  color: color === "green" ? "rgb(34,197,94)" : "rgb(59,130,246)",
});

// ── Component ──────────────────────────────────────────
const UniversalAIProviderForm: React.FC = () => {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [host, setHost] = useState(PROVIDERS.openai.host);
  const [route, setRoute] = useState(PROVIDERS.openai.route);
  const [method, setMethod] = useState<"POST" | "GET">("POST");
  const [model, setModel] = useState(PROVIDERS.openai.models[0] || "");
  const [body, setBody] = useState(PROVIDERS.openai.body);
  const [respPath, setRespPath] = useState(PROVIDERS.openai.resp);
  const [errPath, setErrPath] = useState(PROVIDERS.openai.err);
  const [headers, setHeaders] = useState<[string, string][]>([
    ...PROVIDERS.openai.headers,
  ]);
  const [bodyExtraFields, setBodyExtraFields] = useState<[string, string][]>(
    []
  );
  const [bodyTab, setBodyTab] = useState<"template" | "extra">("template");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [respHeaders, setRespHeaders] = useState<[string, string][]>([]);

  const fullUrl = host.replace(/\/$/, "") + route;

  const selectProvider = useCallback(
    (id: ProviderId) => {
      setProvider(id);
      const p = PROVIDERS[id];
      setHost(p.host);
      setRoute(p.route);
      setMethod("POST");
      setModel(p.models[0] || "");
      setBody(p.body);
      setRespPath(p.resp);
      setErrPath(p.err);
      setHeaders([...p.headers]);
      setBodyExtraFields([]);
      setBodyTab("template");
      setShowAdvanced(false);
      setRespHeaders([]);
    },
    []
  );

  const selectModel = useCallback((m: string) => {
    setModel(m);
  }, []);

  // Headers helpers
  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, ["", ""]]);
  }, []);

  const updateHeader = useCallback(
    (idx: number, key: string, value: string) => {
      setHeaders((prev) => {
        const next = [...prev];
        next[idx] = [key, value];
        return next;
      });
    },
    []
  );

  const removeHeader = useCallback((idx: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Body extra fields helpers
  const addBodyField = useCallback(() => {
    setBodyExtraFields((prev) => [...prev, ["", ""]]);
  }, []);

  const updateBodyField = useCallback(
    (idx: number, key: string, value: string) => {
      setBodyExtraFields((prev) => {
        const next = [...prev];
        next[idx] = [key, value];
        return next;
      });
    },
    []
  );

  const removeBodyField = useCallback((idx: number) => {
    setBodyExtraFields((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Response headers helpers
  const addRespHeader = useCallback(() => {
    setRespHeaders((prev) => [...prev, ["", ""]]);
  }, []);

  const updateRespHeader = useCallback(
    (idx: number, key: string, value: string) => {
      setRespHeaders((prev) => {
        const next = [...prev];
        next[idx] = [key, value];
        return next;
      });
    },
    []
  );

  const removeRespHeader = useCallback((idx: number) => {
    setRespHeaders((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        marginTop: "8px",
      }}
    >
      {/* Section: Provider */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Provider</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}
        >
          {PROVIDER_IDS.map((id) => (
            <div
              key={id}
              onClick={() => selectProvider(id)}
              style={{
                border:
                  provider === id
                    ? "1px solid var(--vscode-focusBorder, #007acc)"
                    : "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "7px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                background:
                  provider === id
                    ? "rgba(0,122,204,0.08)"
                    : "var(--input-bg)",
                fontSize: "13px",
                color:
                  provider === id
                    ? "var(--vscode-focusBorder, #007acc)"
                    : "var(--secondary-text)",
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: PROVIDER_COLORS[id],
                }}
              />
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Section: Host & Route */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>1. Host & Route</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div style={fieldStyle}>
            <label style={labelStyle}>Base URL</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              style={inputBaseStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Route path</label>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              style={inputBaseStyle}
            />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginTop: "8px",
          }}
        >
          <div style={fieldStyle}>
            <label style={labelStyle}>Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "POST" | "GET")}
              style={{ ...inputBaseStyle, cursor: "pointer" }}
            >
              <option>POST</option>
              <option>GET</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Full URL{" "}
              <span style={badgeStyle("blue")}>{method}</span>
            </label>
            <input
              type="text"
              value={fullUrl}
              readOnly
              style={{
                ...monoInputStyle,
                color: "var(--secondary-text)",
                opacity: 0.8,
                fontSize: "11px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Section: Model */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>2. Model</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Model ID</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={inputBaseStyle}
          />
        </div>
        {PROVIDERS[provider].models.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            {PROVIDERS[provider].models.map((m) => (
              <div
                key={m}
                onClick={() => selectModel(m)}
                style={{
                  padding: "4px 10px",
                  border:
                    model === m
                      ? "1px solid var(--vscode-focusBorder, #007acc)"
                      : "1px solid var(--border-color)",
                  borderRadius: "20px",
                  fontSize: "12px",
                  cursor: "pointer",
                  color:
                    model === m
                      ? "var(--vscode-focusBorder, #007acc)"
                      : "var(--secondary-text)",
                  background:
                    model === m
                      ? "rgba(0,122,204,0.08)"
                      : "var(--input-bg)",
                }}
              >
                {m}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Request Headers */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>3. Request headers</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {headers.map(([key, value], idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="key"
                value={key}
                onChange={(e) => updateHeader(idx, e.target.value, value)}
                style={monoInputStyle}
              />
              <input
                type="text"
                placeholder="value"
                value={value}
                onChange={(e) => updateHeader(idx, key, e.target.value)}
                style={monoInputStyle}
              />
              <button
                onClick={() => removeHeader(idx)}
                style={{
                  padding: "3px 7px",
                  border: "none",
                  borderRadius: "4px",
                  background: "rgba(239,68,68,0.12)",
                  color: "var(--vscode-errorForeground, #f87171)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addHeader}
          style={{
            marginTop: "8px",
            padding: "5px 12px",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            background: "transparent",
            color: "var(--secondary-text)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          + Add header
        </button>
      </div>

      {/* Section: Request Body */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>4. Request body</div>
        <div
          style={{
            display: "flex",
            gap: "2px",
            borderBottom: "1px solid var(--border-color)",
            marginBottom: "12px",
          }}
        >
          <div
            onClick={() => setBodyTab("template")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              color:
                bodyTab === "template"
                  ? "var(--vscode-focusBorder, #007acc)"
                  : "var(--secondary-text)",
              borderBottom:
                bodyTab === "template"
                  ? "2px solid var(--vscode-focusBorder, #007acc)"
                  : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            Template
          </div>
          <div
            onClick={() => setBodyTab("extra")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              color:
                bodyTab === "extra"
                  ? "var(--vscode-focusBorder, #007acc)"
                  : "var(--secondary-text)",
              borderBottom:
                bodyTab === "extra"
                  ? "2px solid var(--vscode-focusBorder, #007acc)"
                  : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            Extra fields
          </div>
        </div>
        {bodyTab === "template" ? (
          <div style={fieldStyle}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              style={{
                ...monoInputStyle,
                resize: "vertical",
                minHeight: "100px",
              }}
            />
            <div style={hintStyle}>
              Dùng <code style={{ fontSize: "11px" }}>{`{{message}}`}</code>{" "}
              làm placeholder cho nội dung người dùng nhập
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {bodyExtraFields.map(([key, value], idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="field"
                    value={key}
                    onChange={(e) =>
                      updateBodyField(idx, e.target.value, value)
                    }
                    style={monoInputStyle}
                  />
                  <input
                    type="text"
                    placeholder="value"
                    value={value}
                    onChange={(e) =>
                      updateBodyField(idx, key, e.target.value)
                    }
                    style={monoInputStyle}
                  />
                  <button
                    onClick={() => removeBodyField(idx)}
                    style={{
                      padding: "3px 7px",
                      border: "none",
                      borderRadius: "4px",
                      background: "rgba(239,68,68,0.12)",
                      color: "var(--vscode-errorForeground, #f87171)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addBodyField}
              style={{
                marginTop: "8px",
                padding: "5px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--secondary-text)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              + Add field
            </button>
          </div>
        )}
      </div>

      {/* Section: Response Mapping */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>5. Response mapping</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Content path <span style={badgeStyle("green")}>JSONPath</span>
            </label>
            <input
              type="text"
              value={respPath}
              onChange={(e) => setRespPath(e.target.value)}
              style={monoInputStyle}
            />
            <div style={hintStyle}>
              Đường dẫn để extract text từ response JSON
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Error path</label>
            <input
              type="text"
              value={errPath}
              onChange={(e) => setErrPath(e.target.value)}
              style={monoInputStyle}
            />
          </div>
        </div>
        <div
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            fontSize: "12px",
            color: "var(--vscode-focusBorder, #007acc)",
            cursor: "pointer",
            marginTop: "10px",
            display: "inline-block",
            userSelect: "none",
          }}
        >
          {showAdvanced ? "▾" : "▸"} Response headers (advanced)
        </div>
        {showAdvanced && (
          <div style={{ marginTop: "10px" }}>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {respHeaders.map(([key, value], idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="key"
                    value={key}
                    onChange={(e) =>
                      updateRespHeader(idx, e.target.value, value)
                    }
                    style={monoInputStyle}
                  />
                  <input
                    type="text"
                    placeholder="value"
                    value={value}
                    onChange={(e) =>
                      updateRespHeader(idx, key, e.target.value)
                    }
                    style={monoInputStyle}
                  />
                  <button
                    onClick={() => removeRespHeader(idx)}
                    style={{
                      padding: "3px 7px",
                      border: "none",
                      borderRadius: "4px",
                      background: "rgba(239,68,68,0.12)",
                      color: "var(--vscode-errorForeground, #f87171)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRespHeader}
              style={{
                marginTop: "8px",
                padding: "5px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--secondary-text)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              + Add expected header
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
          marginTop: "4px",
        }}
      >
        <button
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--primary-text)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Export JSON config ↗
        </button>
        <button
          style={{
            padding: "8px 20px",
            borderRadius: "6px",
            border: "none",
            background: "var(--vscode-focusBorder, #007acc)",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Test connection
        </button>
      </div>
    </div>
  );
};

export default UniversalAIProviderForm;