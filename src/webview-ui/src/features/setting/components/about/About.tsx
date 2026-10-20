/**
 * ------------------------------------------------------------------
 * AboutSettings
 * ------------------------------------------------------------------
 * Tab About: logo + tên + tagline, liên kết, giới thiệu Zen, 4 tính
 * năng cốt lõi và đội ngũ phát triển. Bố cục phẳng, không box.
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
  ArrowUpRight,
} from "lucide-react";

const REPO_URL = "https://github.com/KhanhRomVN/Zen";

interface Developer {
  initials: string;
  name: string;
  role: string;
  username: string;
  email?: string;
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
  color: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Layers,
    color: "#4c9dfb",
    title: "Any LLM provider",
    description: "DeepSeek, Claude, Gemini, Qwen, OpenAI, Ollama and more.",
  },
  {
    icon: FileText,
    color: "#2dd4bf",
    title: "Agentic editing",
    description:
      "The AI reads and edits files and runs commands. You approve each action.",
  },
  {
    icon: ShieldCheck,
    color: "#34d399",
    title: "Permission modes",
    description: "Full Access, Approval or Read Only. You set the autonomy.",
  },
  {
    icon: RotateCcw,
    color: "#a78bfa",
    title: "Checkpoint & Revert",
    description: "Every edit is checkpointed. View the diff or undo in one click.",
  },
];

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      marginBottom: "12px",
    }}
  >
    <span
      style={{ fontSize: "14.5px", fontWeight: 600, color: "var(--primary-text)" }}
    >
      {title}
    </span>
    {subtitle && <span className="zs-hint">{subtitle}</span>}
  </div>
);

const FeatureRow: React.FC<{ feature: Feature }> = ({ feature }) => {
  const Icon = feature.icon;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ display: "flex", color: feature.color, marginTop: 2 }}>
        <Icon size={16} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{ fontSize: 14.5, fontWeight: 500, color: "var(--primary-text)" }}
        >
          {feature.title}
        </span>
        <span className="zs-hint">{feature.description}</span>
      </div>
    </div>
  );
};

const Avatar: React.FC<{ dev: Developer }> = ({ dev }) => {
  const [failed, setFailed] = React.useState(false);
  const box: React.CSSProperties = {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",
  };
  const soft = `color-mix(in srgb, ${dev.accent} 18%, transparent)`;

  if (!failed) {
    return (
      <img
        src={`https://github.com/${dev.username}.png?size=76`}
        alt={dev.name}
        width={38}
        height={38}
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
        fontSize: 14,
        fontWeight: 700,
        color: dev.accent,
        backgroundColor: soft,
      }}
    >
      {dev.initials}
    </div>
  );
};

const LinkRow: React.FC<{
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}> = ({ href, icon, title, subtitle }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="zs-tile"
  >
    <span style={{ display: "flex", color: "var(--secondary-text)" }}>
      {icon}
    </span>
    <div
      style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}
    >
      <span
        style={{ fontSize: 14.5, fontWeight: 500, color: "var(--primary-text)" }}
      >
        {title}
      </span>
      <span
        className="zs-hint"
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subtitle}
      </span>
    </div>
    <ArrowUpRight
      size={14}
      style={{ color: "var(--secondary-text)", opacity: 0.5, flexShrink: 0 }}
    />
  </a>
);

const AboutSettings: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "8px 0 0",
      }}
    >
      <img
        src={`${(window as any).__zenImagesUri}/icon.png`}
        alt="Zen Logo"
        style={{ width: 52, height: 52, objectFit: "contain" }}
      />
      <div
        style={{
          fontSize: 25.75,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--primary-text)",
        }}
      >
        Zen
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          color: "var(--secondary-text)",
          textAlign: "center",
          maxWidth: "34ch",
          lineHeight: 1.5,
        }}
      >
        AI-powered coding assistant extension for VSCode
      </p>
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <LinkRow
        href={REPO_URL}
        icon={<Github size={16} />}
        title="Open source"
        subtitle="View source on GitHub"
      />
      <LinkRow
        href={`${REPO_URL}/issues`}
        icon={<Bug size={16} />}
        title="Issues"
        subtitle="Report bugs & requests"
      />
    </div>

    <div>
      <SectionTitle title="What is Zen?" />
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          lineHeight: 1.6,
          color: "var(--secondary-text)",
        }}
      >
        Zen brings AI chat into your VSCode sidebar. Connect any LLM provider,
        chat about your code, let the AI edit files and run commands, and track
        every change without leaving your editor. No subscription, no lock-in.
      </p>
    </div>

    <div>
      <SectionTitle title="Core features" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {FEATURES.map((f) => (
          <FeatureRow key={f.title} feature={f} />
        ))}
      </div>
    </div>

    <div>
      <SectionTitle
        title="Development team"
        subtitle="The people who write and maintain Zen."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {DEVELOPERS.map((dev) => (
          <div key={dev.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar dev={dev} />
            <div
              style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}
            >
              <span
                style={{
                  fontSize: 14.5,
                  fontWeight: 500,
                  color: "var(--primary-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {dev.name}
              </span>
              <span className="zs-hint">{dev.role}</span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "2px 14px",
                  marginTop: 2,
                }}
              >
                <a
                  className="zs-link"
                  href={`https://github.com/${dev.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github size={11} />
                  github.com/{dev.username}
                </a>
                {dev.email && (
                  <a className="zs-link" href={`mailto:${dev.email}`}>
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
  </div>
);

export default AboutSettings;