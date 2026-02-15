import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";

// Simple language definition with emoji flags
const LANGUAGES = [
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

  const filteredLanguages = LANGUAGES.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm",
          "bg-input border border-border rounded-md shadow-sm",
          "hover:bg-accent hover:text-accent-foreground transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          isOpen && "ring-1 ring-ring border-ring",
        )}
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
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 overflow-hidden bg-popover border border-border rounded-md shadow-md animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search language..."
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-muted/50 border border-transparent rounded-sm outline-none focus:bg-muted text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors text-left",
                    value === lang.code
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent hover:text-accent-foreground text-foreground",
                  )}
                  onClick={() => {
                    onChange(lang.code);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                  {value === lang.code && <Check className="w-3.5 h-3.5" />}
                </button>
              ))
            ) : (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
