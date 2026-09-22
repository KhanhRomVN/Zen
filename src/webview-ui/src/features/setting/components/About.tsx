/**
 * ------------------------------------------------------------------
 * AboutSettings
 * ------------------------------------------------------------------
 * Tab About trong Settings Panel: hero (logo, tên, tagline), 2 card
 * liên kết (mã nguồn mở, issues), giới thiệu Zen + 4 tính năng cốt lõi
 * (theo README) và card giới thiệu đội ngũ phát triển.
 * ------------------------------------------------------------------
 */

import React from "react";
import {
  Bug,
  Github,
  Layers,
  Mail,
  FileText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

const REPO_URL = "https://github.com/KhanhRomVN/Zen";

interface Developer {
  initials: string;
  name: string;
  role: string;
  /** Username GitHub — dùng cho link profile và ảnh avatar */
  username: string;
  email?: string;
  /** Màu nhấn cho avatar fallback (soft-style) */
  accent: string;
}

const DEVELOPERS: Developer[] = [
  {
    initials: "KR",
    name: "KhanhRomVN",
    role: "Author · architecture & backend agent",
    username: "KhanhRomVN",
    email: "khanhromvn@gmail.com",
    accent: "#4c9dfb",
  },
  {
    initials: "BC",
    name: "BlackCandy001",
    role: "Co-developer",
    username: "BlackCandy001",
    accent: "#a371f7",
  },
];

interface Feature {
  icon: React.ElementType;
  /** Màu nhấn của badge icon (soft-style) */
  color: string;
  title: string;
  description: string;
}

/** 4 tính năng cốt lõi của Zen — rút gọn từ README.md. */
const FEATURES: Feature[] = [
  {
    icon: Layers,
    color: "#4c9dfb",
    title: "Any LLM provider",
    description: "DeepSeek, Claude, Gemini, Qwen, OpenAI, Ollama and more.",
  },
  {
    icon: FileText,
    color: "#39c5cf",
    title: "Agentic editing",
    description:
      "The AI reads and edits files and runs commands. You approve each action.",
  },
  {
    icon: ShieldCheck,
    color: "#3fb950",
    title: "Permission modes",
    description: "Full Access, Approval or Read Only. You set the autonomy.",
  },
  {
    icon: RotateCcw,
    color: "#a371f7",
    title: "Checkpoint & Revert",
    description: "Every edit is checkpointed. View the diff or undo in one click.",
  },
];

/** Ô tính năng gọn: badge icon màu soft ở trên, tiêu đề và mô tả ngắn bên dưới. */
const FeatureItem: React.FC<{ feature: Feature }> = ({ feature }) => {
  const Icon = feature.icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: 0,
        padding: "12px",
        borderRadius: "8px",
        backgroundColor: "var(--input-bg)",
      }}
    >
      <div
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: feature.color,
          backgroundColor: `color-mix(in srgb, ${feature.color} 16%, transparent)`,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span
          style={{
            fontSize: "12.5px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          {feature.title}
        </span>
        <span
          style={{
            fontSize: "11px",
            lineHeight: 1.45,
            color: "var(--secondary-text)",
            opacity: 0.85,
          }}
        >
          {feature.description}
        </span>
      </div>
    </div>
  );
};

/**
 * Avatar developer: ảnh GitHub bo góc nhẹ; nếu tải lỗi (offline/CSP)
 * thì hiện chữ viết tắt trên nền soft-style.
 */
const Avatar: React.FC<{ dev: Developer }> = ({ dev }) => {
  const [failed, setFailed] = React.useState(false);
  const box: React.CSSProperties = {
    width: "40px",
    height: "40px",
    flexShrink: 0,
    borderRadius: "10px",
    overflow: "hidden",
  };
  const soft = `color-mix(in srgb, ${dev.accent} 18%, transparent)`;

  if (!failed) {
    return (
      <img
        src={`https://github.com/${dev.username}.png?size=80`}
        alt={dev.name}
        width={40}
        height={40}
        draggable={false}
        onError={() => setFailed(true)}
        style={{ ...box, objectFit: "cover", backgroundColor: soft }}
      />
    );
  }
  return (
    <div
      style={{
        ...box,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: dev.accent,
        backgroundColor: soft,
      }}
    >
      {dev.initials}
    </div>
  );
};

/** Card liên kết ngoài (mở repo / issues). */
const LinkCard: React.FC<{
  href: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
}> = ({ href, icon, color, title, subtitle }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "11px",
        borderRadius: "8px",
        textDecoration: "none",
        boxSizing: "border-box",
        backgroundColor: hovered
          ? "color-mix(in srgb, var(--primary-text) 8%, var(--input-bg))"
          : "var(--input-bg)",
        transition: "background-color 0.14s ease",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          flexShrink: 0,
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--primary-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "11.5px",
            color: "var(--secondary-text)",
            opacity: 0.8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </span>
      </div>
    </a>
  );
};

const AboutSettings: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "26px 12px 22px",
        }}
      >
        <img
          src={`${(window as any).__zenImagesUri}/icon.png`}
          alt="Zen Logo"
          style={{
            width: "58px",
            height: "58px",
            objectFit: "contain",
            borderRadius: "14px",
          }}
        />
        <div
          style={{
            fontSize: "26px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "var(--primary-text)",
          }}
        >
          Zen
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "12.5px",
            color: "var(--secondary-text)",
            textAlign: "center",
            maxWidth: "32ch",
            lineHeight: 1.45,
          }}
        >
          AI-powered coding assistant extension for VSCode
        </p>
      </div>

      {/* Links: mã nguồn mở + issues (đặt ngay dưới hero để dễ thấy) */}
      <div style={{ display: "flex", gap: "8px" }}>
        <LinkCard
          href={REPO_URL}
          icon={<Github size={16} />}
          color="#4c9dfb"
          title="Open source"
          subtitle="View source on GitHub"
        />
        <LinkCard
          href={`${REPO_URL}/issues`}
          icon={<Bug size={16} />}
          color="#f0883e"
          title="Issues"
          subtitle="Report bugs & requests"
        />
      </div>

      {/* What is Zen + Core features */}
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            What is Zen?
          </span>
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "12px",
            lineHeight: 1.55,
            color: "var(--secondary-text)",
          }}
        >
          Zen brings AI chat into your VSCode sidebar. Connect any LLM
          provider, chat about your code, let the AI edit files and run
          commands, and track every change without leaving your editor. No
          subscription, no lock-in.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Core features
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {FEATURES.map((f) => (
            <FeatureItem key={f.title} feature={f} />
          ))}
        </div>
      </div>

      {/* Development team */}
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Development team
          </span>
          <span
            style={{
              fontSize: "11.5px",
              color: "var(--secondary-text)",
              opacity: 0.8,
            }}
          >
            The people who write and maintain Zen.
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {DEVELOPERS.map((dev) => (
            <div
              key={dev.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minWidth: 0,
                padding: "11px",
                borderRadius: "8px",
                backgroundColor: "var(--input-bg)",
              }}
            >
              <Avatar dev={dev} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1px",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dev.name}
                </span>
                <span
                  style={{
                    fontSize: "11.5px",
                    color: "var(--secondary-text)",
                    opacity: 0.8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dev.role}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "2px 12px",
                    marginTop: "3px",
                  }}
                >
                  <a
                    className="zen-about-link"
                    href={`https://github.com/${dev.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github size={11} />
                    github.com/{dev.username}
                  </a>
                  {dev.email && (
                    <a className="zen-about-link" href={`mailto:${dev.email}`}>
                      <Mail size={11} />
                      {dev.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .zen-about-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--secondary-text);
          text-decoration: none;
          min-width: 0;
        }
        .zen-about-link:hover {
          color: var(--primary-text);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default AboutSettings;