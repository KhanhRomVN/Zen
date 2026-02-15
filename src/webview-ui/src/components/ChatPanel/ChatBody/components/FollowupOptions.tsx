import React from "react";

interface FollowupOptionsProps {
  options: string[];
  messageId: string;
  selectedOption: string | undefined;
  onOptionClick: (option: string) => void;
}

const FollowupOptions: React.FC<FollowupOptionsProps> = ({
  options,
  messageId,
  selectedOption,
  onOptionClick,
}) => {
  if (!options || options.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-xs)",
        marginTop: "var(--spacing-sm)",
      }}
    >
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--secondary-text)",
          fontWeight: 600,
          marginBottom: "var(--spacing-xs)",
        }}
      >
        Suggested Follow-up:
      </div>
      <div
        style={{ display: "flex", gap: "var(--spacing-sm)", flexWrap: "wrap" }}
      >
        {options.map((option, idx) => (
          <button
            key={idx}
            disabled={!!selectedOption}
            onClick={() => onOptionClick(option)}
            style={{
              padding: "var(--spacing-xs) var(--spacing-sm)",
              backgroundColor:
                selectedOption === option
                  ? "var(--accent-color)"
                  : "var(--secondary-bg)",
              color:
                selectedOption === option
                  ? "#fff"
                  : selectedOption
                  ? "var(--disabled-text)"
                  : "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              cursor: selectedOption ? "default" : "pointer",
              fontSize: "var(--font-size-sm)",
              transition: "all 0.2s",
              textAlign: "left",
              opacity: selectedOption && selectedOption !== option ? 0.5 : 1,
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FollowupOptions;
