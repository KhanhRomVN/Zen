import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";

// Simple language definition with emoji flags
export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
];

interface LanguageSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

// Custom Chevron Icons
const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLanguage =
    LANGUAGES.find((l) => l.code === value) || LANGUAGES[0];

  return (
    <div
      className={cn("relative w-full", className)}
      ref={dropdownRef}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        style={{
          width: "100%",
          height: "36px", // Increased height
          padding: "0 12px", // Increased padding
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          color: "var(--primary-text)",
          fontSize: "14px", // Increased font size
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">
            {selectedLanguage.flag}
          </span>
          <span className="font-medium text-foreground">
            {selectedLanguage.name}
          </span>
        </div>
        <div style={{ color: "var(--secondary-text)" }}>
          {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            width: "100%",
            marginTop: "4px",
            backgroundColor: "var(--input-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {LANGUAGES.map((lang) => (
              <div
                key={lang.code}
                style={{
                  padding: "8px 12px", // Increased padding
                  fontSize: "14px", // Increased font size
                  cursor: "pointer",
                  color: "var(--primary-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor:
                    value === lang.code ? "var(--hover-bg)" : "transparent",
                }}
                onClick={() => {
                  onChange(lang.code);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (value !== lang.code) {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== lang.code) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                {/* Check icon removed */}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
