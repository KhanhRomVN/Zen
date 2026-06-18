import React from "react";
import { Send } from "lucide-react";

interface QuestionBlockProps {
  options: string[];
  onOptionSelect: (option: string) => void;
  disabled?: boolean;
  title?: string;
  selectedOption?: string;
  optional?: boolean;
}

const QuestionBlock: React.FC<QuestionBlockProps> = ({
  options,
  onOptionSelect,
  disabled = false,
  title,
  selectedOption,
  optional = false,
}) => {
  const [localSelected, setLocalSelected] = React.useState<string | null>(null);
  const [isCustomActive, setIsCustomActive] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");

  const effectiveSelected = selectedOption || localSelected;

  const handleSelect = (option: string) => {
    if (disabled || effectiveSelected) return;
    setLocalSelected(option);
    onOptionSelect(option);
  };

  const handleCustomSubmit = () => {
    if (disabled || effectiveSelected || !customValue.trim()) return;
    setLocalSelected(customValue.trim());
    onOptionSelect(customValue.trim());
    setIsCustomActive(false);
  };

  // Determine if the selected option is one of the predefined ones
  const isPredefinedSelected = (opt: string) => effectiveSelected === opt;
  const isCustomOptionSelected =
    effectiveSelected && !options.includes(effectiveSelected);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginTop: "20px",
        marginBottom: "12px",
        padding: "0",
        backgroundColor: "transparent",
        border: "none",
        boxShadow: "none",
        marginLeft: "29px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--vscode-foreground)",
          marginBottom: "4px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            opacity: 0.8,
          }}
        >
          {title || (optional ? "Suggested" : "Choice Required")}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(option)}
            disabled={disabled || !!effectiveSelected}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: isPredefinedSelected(option)
                ? "var(--vscode-button-background)"
                : "var(--vscode-foreground)",
              border: "none",
              borderLeft: `3px solid ${
                isPredefinedSelected(option)
                  ? "var(--vscode-button-background)"
                  : "var(--vscode-descriptionForeground)"
              }`,
              borderRadius: "0",
              cursor: disabled || effectiveSelected ? "default" : "pointer",
              fontSize: "13px",
              fontWeight: isPredefinedSelected(option) ? 600 : 500,
              textAlign: "left",
              transition: "all 0.15s ease",
              opacity:
                effectiveSelected && !isPredefinedSelected(option) ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            onMouseEnter={(e) => {
              if (!disabled && !effectiveSelected) {
                e.currentTarget.style.borderLeftColor =
                  "var(--vscode-button-background)";
                e.currentTarget.style.color = "var(--vscode-button-background)";
                e.currentTarget.style.background =
                  "linear-gradient(to right, var(--vscode-button-background) -300%, transparent)";
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !effectiveSelected) {
                e.currentTarget.style.borderLeftColor =
                  "var(--vscode-descriptionForeground)";
                e.currentTarget.style.color = "var(--vscode-foreground)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {option}
          </button>
        ))}

        {/* Custom Option Toggle */}
        {!effectiveSelected && !isCustomActive && (
          <button
            onClick={() => setIsCustomActive(true)}
            disabled={disabled}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "var(--vscode-descriptionForeground)",
              border: "none",
              borderLeft: "3px dashed var(--vscode-descriptionForeground)",
              borderRadius: "0",
              cursor: disabled ? "default" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              textAlign: "left",
              transition: "all 0.15s ease",
              opacity: 0.8,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderLeftColor =
                  "var(--vscode-button-background)";
                e.currentTarget.style.color = "var(--vscode-button-background)";
                e.currentTarget.style.background =
                  "linear-gradient(to right, var(--vscode-button-background) -300%, transparent)";
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderLeftColor =
                  "var(--vscode-descriptionForeground)";
                e.currentTarget.style.color =
                  "var(--vscode-descriptionForeground)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            Tùy chỉnh...
          </button>
        )}

        {/* Custom Option Selected State */}
        {isCustomOptionSelected && (
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "var(--vscode-button-background)",
              borderLeft: "3px solid var(--vscode-button-background)",
              borderRadius: "0",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {effectiveSelected}
          </div>
        )}

        {/* Custom Input Area */}
        {isCustomActive && !effectiveSelected && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "0px",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "0px",
            }}
          >
            <textarea
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Nhập lựa chọn của bạn..."
              style={{
                width: "100%",
                minHeight: "60px",
                backgroundColor: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                borderRadius: "4px",
                padding: "8px",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
                if (e.key === "Escape") {
                  setIsCustomActive(false);
                }
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setIsCustomActive(false)}
                style={{
                  padding: "4px 12px",
                  backgroundColor: "transparent",
                  color: "var(--vscode-foreground)",
                  border: "none",
                  fontSize: "12px",
                  cursor: "pointer",
                  opacity: 0.8,
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  backgroundColor: "var(--vscode-button-background)",
                  color: "var(--vscode-button-foreground)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: customValue.trim() ? "pointer" : "default",
                  opacity: customValue.trim() ? 1 : 0.6,
                }}
              >
                <Send size={14} />
                Gửi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBlock;
