import React from "react";
import { useRef, useState } from "react";
import {
  Paperclip,
  Image,
  Video,
  Search,
  GitCommitHorizontal,
  Sparkles,
} from "lucide-react";
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
import type { AttachedItem } from "../../types/file-uploader";
import SkillPickerDrawer from "./SkillPickerDrawer";

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
  showImageGenerator?: boolean;
  showVideoGenerator?: boolean;
  showDeepResearch?: boolean;
  triggerButton: React.ReactNode;
  currentModel?: any;
  currentModelConfig?: any;
  /** Gọi khi xác nhận chọn skill — truyền toàn bộ tập skill mới (thay thế tập cũ). */
  onSelectSkills?: (items: AttachedItem[]) => void;
  /** Slug các skill đang gắn vào input — dùng để tick sẵn trong drawer. */
  selectedSkillSlugs?: string[];
}

const SKILL_COLOR = "#8b5cf6";

const ActionDropdown: React.FC<ActionDropdownProps> = ({
  onSelectAttach,
  onSelectImageGenerator,
  onSelectVideoGenerator,
  onSelectDeepResearch,
  onSelectPullRequest,
  showImageGenerator = false,
  showVideoGenerator = false,
  showDeepResearch = false,
  triggerButton,
  currentModel,
  currentModelConfig,
  onSelectSkills,
  selectedSkillSlugs,
}) => {
  const [skillDrawerOpen, setSkillDrawerOpen] = useState(false);

  // Prefer currentModelConfig (always fresh from API), fallback to currentModel (may be cached)
  const modelCaps = currentModelConfig ?? currentModel;

  // Trạng thái kiểm tra git — chỉ hiển thị thông tin, không chặn click
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
      desc: gitReady.checking
        ? "Đang kiểm tra git..."
        : gitReady.ok
          ? "Generate a commit message from staged changes"
          : "Chọn repository để tạo commit message",
      show: !!onSelectPullRequest,
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

  const rowStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    transition: "all 0.15s ease",
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
    flexShrink: 0,
  });

  return (
    <>
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
                <div style={rowStyle}>
                  <span style={badgeStyle(option.color)}>{option.icon}</span>
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

          {/* Skills — chỉ hiển thị nếu onSelectSkills được truyền */}
          {onSelectSkills && (
            <DropdownItem onClick={() => setSkillDrawerOpen(true)} noPadding>
              <div style={rowStyle}>
                <span style={badgeStyle(SKILL_COLOR)}>
                  <Sparkles size={14} />
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
                    Skills
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--secondary-text)",
                      lineHeight: 1.4,
                    }}
                  >
                    Attach installed skills for the agent to use
                  </div>
                </div>
              </div>
            </DropdownItem>
          )}
        </DropdownContent>
      </Dropdown>

      {onSelectSkills && (
        <SkillPickerDrawer
          isOpen={skillDrawerOpen}
          selectedSlugs={selectedSkillSlugs ?? []}
          onClose={() => setSkillDrawerOpen(false)}
          onConfirm={(skills) =>
            onSelectSkills(
              skills.map((s) => ({
                id: `skill-${s.slug}`,
                path: s.name,
                type: "skill" as const,
                skillSlug: s.slug,
              })),
            )
          }
        />
      )}

    </>
  );
};

export default ActionDropdown;