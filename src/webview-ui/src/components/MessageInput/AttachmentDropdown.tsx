import React from "react";
import { Paperclip, Image, Video, Search } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../ui/Dropdown";

interface AttachmentOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
  show: boolean;
}

interface AttachmentDropdownProps {
  onSelectAttach: () => void;
  onSelectImageGenerator?: () => void;
  onSelectVideoGenerator?: () => void;
  onSelectDeepResearch?: () => void;
  showImageGenerator?: boolean;
  showVideoGenerator?: boolean;
  showDeepResearch?: boolean;
  triggerButton: React.ReactNode;
}

const AttachmentDropdown: React.FC<AttachmentDropdownProps> = ({
  onSelectAttach,
  onSelectImageGenerator,
  onSelectVideoGenerator,
  onSelectDeepResearch,
  showImageGenerator = false,
  showVideoGenerator = false,
  showDeepResearch = false,
  triggerButton,
}) => {
  const options: AttachmentOption[] = [
    {
      key: "attach",
      label: "Attach",
      icon: <Paperclip size={14} />,
      color: "#3b82f6",
      desc: "Attach file, image, video or audio",
      show: true, // Always show
    },
    {
      key: "image-generator",
      label: "Image Generator",
      icon: <Image size={14} />,
      color: "#ec4899",
      desc: "Generate images from text descriptions",
      show: showImageGenerator,
    },
    {
      key: "video-generator",
      label: "Video Generator",
      icon: <Video size={14} />,
      color: "#8b5cf6",
      desc: "Generate videos from text descriptions",
      show: showVideoGenerator,
    },
    {
      key: "deep-research",
      label: "Deep Research",
      icon: <Search size={14} />,
      color: "#10b981",
      desc: "Comprehensive research and analysis",
      show: showDeepResearch,
    },
  ];

  const visibleOptions = options.filter((opt) => opt.show);

  // Debug: log visible options
  console.log("AttachmentDropdown visible options:", visibleOptions);

  const handleSelect = (key: string) => {
    switch (key) {
      case "attach":
        onSelectAttach();
        break;
      case "image-generator":
        onSelectImageGenerator?.();
        break;
      case "video-generator":
        onSelectVideoGenerator?.();
        break;
      case "deep-research":
        onSelectDeepResearch?.();
        break;
    }
  };

  return (
    <Dropdown side="top" align="start" sideOffset={4}>
      <DropdownTrigger asChild>{triggerButton}</DropdownTrigger>
      <DropdownContent>
        {visibleOptions.map((option) => {
          return (
            <DropdownItem
              key={option.key}
              onClick={() => handleSelect(option.key)}
              noPadding
            >
              <div
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Badge Icon */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: `color-mix(in srgb, ${option.color} 15%, transparent)`,
                    color: option.color,
                    flexShrink: 0,
                  }}
                >
                  {option.icon}
                </span>

                {/* Text Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--primary-text)",
                      marginBottom: "2px",
                    }}
                  >
                    {option.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--secondary-text)",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {option.desc}
                  </div>
                </div>
              </div>
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
};

export default AttachmentDropdown;
