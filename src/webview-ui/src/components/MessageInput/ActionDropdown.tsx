import React from "react";
import { useRef, useState } from "react";
import { Paperclip, Image, Video, Search, GitCommitHorizontal } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../ui/Dropdown";
import {
  extensionService,
  messageDispatcher,
} from "../../services/ExtensionService";

interface AttachmentOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
  show: boolean;
  /** Vô hiệu hóa item (vẫn hiển thị, kèm tooltip lý do). */
  disabled?: boolean;
  disabledReason?: string;
}

interface ActionDropdownProps {
  onSelectAttach: () => void;
  onSelectImageGenerator?: () => void;
  onSelectVideoGenerator?: () => void;
  onSelectDeepResearch?: () => void;
  /** Callback khi click "Create Pull Request" — nếu truyền, item sẽ hiển thị. */
  onSelectPullRequest?: () => void;
  /** Callback toggle Memory (được gọi khi click switch trong item Memory). */
  onToggleMemory?: () => void;
  /** Trạng thái Memory hiện tại (ON/OFF) — chỉ hiển thị item khi prop này được truyền. */
  isMemoryOn?: boolean;
  showImageGenerator?: boolean;
  showVideoGenerator?: boolean;
  showDeepResearch?: boolean;
  triggerButton: React.ReactNode;
  currentModel?: any;
  currentModelConfig?: any;
}

const ActionDropdown: React.FC<ActionDropdownProps> = ({
  onSelectAttach,
  onSelectImageGenerator,
  onSelectVideoGenerator,
  onSelectDeepResearch,
  onSelectPullRequest,
  onToggleMemory,
  isMemoryOn = false,
  showImageGenerator = false,
  showVideoGenerator = false,
  showDeepResearch = false,
  triggerButton,
  currentModel,
  currentModelConfig,
}) => {
  // Prefer currentModelConfig (always fresh from API), fallback to currentModel (may be cached)
  const modelCaps = currentModelConfig ?? currentModel;

  // Trạng thái kiểm tra git — chỉ dùng cho item Generate Commit Message
  const [gitReady, setGitReady] = useState<{
    checking: boolean;
    ok: boolean;
    reason?: string;
  }>({ checking: false, ok: false });
  const gitCheckIdRef = useRef<string | null>(null);

  // Mỗi lần mở dropdown: hỏi extension xem workspace có .git và đã git add chưa
  const handleOpenChange = (open: boolean) => {
    if (!open || !onSelectPullRequest) return;
    const requestId = `gitCheckReady-${Date.now()}`;
    gitCheckIdRef.current = requestId;
    setGitReady({ checking: true, ok: false, reason: "Checking git..." });
    messageDispatcher.register(
      requestId,
      (msg: any) => {
        if (gitCheckIdRef.current !== requestId) return;
        const ok = !!msg.hasGit && !!msg.hasStaged;
        setGitReady({
          checking: false,
          ok,
          reason: ok ? undefined : msg.reason,
        });
      },
      5000,
      () => {
        if (gitCheckIdRef.current !== requestId) return;
        setGitReady({
          checking: false,
          ok: false,
          reason: "Git check timed out, reopen the menu to retry",
        });
      },
    );
    extensionService.postMessage({ command: "gitCheckReady", requestId });
  };

  const getAttachDesc = () => {
    const types: string[] = ["text files"];
    if (modelCaps?.is_image_upload) types.push("images");
    if (modelCaps?.is_video_upload) types.push("videos");
    if (modelCaps?.is_audio_upload) types.push("audio");
    if (modelCaps?.is_file_upload) types.push("documents");
    return `Attach ${types.join(", ")}`;
  };

  const options: AttachmentOption[] = [
    {
      key: "attach",
      label: "Attach",
      icon: <Paperclip size={14} />,
      color: "#3b82f6",
      desc: getAttachDesc(),
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
    {
      key: "pull-request",
      label: "Generate Commit Message",
      icon: <GitCommitHorizontal size={14} strokeWidth={2.3} />,
      color: "#f59e0b",
      desc: "Generate a commit message from staged changes",
      show: !!onSelectPullRequest,
      disabled: !gitReady.ok,
      disabledReason: gitReady.reason,
    },
  ];

  const visibleOptions = options.filter((opt) => opt.show);

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
      case "pull-request":
        onSelectPullRequest?.();
        break;
    }
  };

  return (
    <Dropdown
      side="top"
      align="start"
      sideOffset={4}
      onOpenChange={handleOpenChange}
    >
      <DropdownTrigger asChild>{triggerButton}</DropdownTrigger>
      <DropdownContent>
        {visibleOptions.map((option) => {
          return (
            <DropdownItem
              key={option.key}
              onClick={() => handleSelect(option.key)}
              disabled={option.disabled}
              title={option.disabled ? option.disabledReason : undefined}
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
                    }}
                  >
                    {option.desc}
                  </div>
                </div>
              </div>
            </DropdownItem>
          );
        })}

        {/* Memory item (có switch toggle) — chỉ hiển thị khi onToggleMemory được truyền */}
        {onToggleMemory && (
          <DropdownItem onClick={() => {}} noPadding closeOnSelect={false}>
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
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "color-mix(in srgb, #8b5cf6 15%, transparent)",
                  color: "#8b5cf6",
                  flexShrink: 0,
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 12a9 3 0 0 0 18 0" />
                  <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    marginBottom: "2px",
                  }}
                >
                  Memory
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.4,
                  }}
                >
                  Reference saved memories & chat history
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMemory();
                }}
                title="Toggle memory"
                style={{
                  width: "30px",
                  height: "17px",
                  borderRadius: "999px",
                  background: isMemoryOn
                    ? "#8b5cf6"
                    : "rgba(128, 128, 128, 0.3)",
                  position: "relative",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                  border: "none",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: "2px",
                    width: "13px",
                    height: "13px",
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "transform 0.15s ease",
                    transform: isMemoryOn ? "translateX(13px)" : "translateX(0)",
                  }}
                />
              </button>
            </div>
          </DropdownItem>
        )}
      </DropdownContent>
    </Dropdown>
  );
};

export default ActionDropdown;
