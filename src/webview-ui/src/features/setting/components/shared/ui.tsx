/**
 * ------------------------------------------------------------------
 * Settings shared UI
 * ------------------------------------------------------------------
 * Bộ thành phần + CSS dùng chung cho Settings: SectionCard, Field,
 * ToggleRow, Callout, StatusChip. Phong cách phẳng: không viền,
 * không bóng, không bọc box từng phần. Màu nhấn (--zs-accent) chỉ
 * dùng cho icon, switch và trạng thái.
 * ------------------------------------------------------------------
 */

import React from "react";
import { ChevronDown } from "lucide-react";

export const SETTINGS_CSS = `
.zs-stack{display:flex;flex-direction:column;gap:30px}
.zs-fade{animation:zsFade .2s ease both}
@keyframes zsFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes zsSpin{to{transform:rotate(360deg)}}
.zs-spin{animation:zsSpin 1s linear infinite}

.zs-section{display:flex;flex-direction:column;gap:14px}
.zs-section-head{display:flex;align-items:center;gap:10px}
.zs-section-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:30px;height:30px;border-radius:8px;color:var(--zs-accent);background:color-mix(in srgb,var(--zs-accent) 14%,transparent)}
.zs-section-title{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.zs-section-title span{font-size:14.5px;font-weight:600;color:var(--primary-text)}
.zs-section-title small{font-size:13.5px;color:var(--secondary-text);opacity:.7;line-height:1.4}
.zs-section-body{display:flex;flex-direction:column;gap:14px;padding-left:40px}

.zs-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.zs-field>label{font-size:13.5px;font-weight:500;color:var(--secondary-text)}
.zs-hint{font-size:13.5px;color:var(--secondary-text);opacity:.75;line-height:1.45}
.zs-grid2{display:flex;flex-direction:column;gap:14px}

.zs-input{width:100%;box-sizing:border-box;height:36px;padding:0 12px;font-size:14.5px;color:var(--primary-text);background:var(--input-bg);border:none;border-radius:8px;outline:none;transition:background .15s ease}
.zs-input::placeholder{color:var(--secondary-text);opacity:.5}
.zs-input:hover{background:color-mix(in srgb,var(--primary-text) 6%,var(--input-bg))}
div:has(>.zs-dd-content){background:color-mix(in srgb,var(--primary-text) 7%,var(--secondary-bg))!important;box-shadow:none!important;outline:1px solid color-mix(in srgb,var(--primary-text) 14%,transparent);border-radius:10px!important}
.zs-dd-content>div{display:flex;flex-direction:column;gap:2px;padding:4px!important}
.zs-dd-content [role=button]{font-size:13.5px!important;border-radius:4px}
.zs-dd-content [role=button]:hover{background:var(--vscode-button-background)!important;color:var(--vscode-button-foreground,#fff)!important}
.zs-mono{font-family:var(--vscode-editor-font-family,ui-monospace,monospace);font-size:14.5px}
.zs-select{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;text-align:left}
.zs-select-value{display:flex;align-items:center;gap:8px;min-width:0}
.zs-dd{display:block!important;width:100%}
.zs-textarea{height:auto;min-height:150px;max-height:320px;padding:10px 12px;line-height:1.55;resize:vertical}

.zs-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0}
.zs-row-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.zs-row-title{font-size:14.5px;font-weight:500;color:var(--primary-text)}
.zs-switch{position:relative;width:34px;height:20px;flex-shrink:0;padding:0;border:none;border-radius:999px;cursor:pointer;background:rgba(128,128,128,.35);transition:background .18s ease}
.zs-switch.on{background:var(--zs-accent)}
.zs-switch i{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .18s ease}
.zs-switch.on i{transform:translateX(14px)}

.zs-callout{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:12px;border:1px dashed color-mix(in srgb,var(--zs-accent) 50%,transparent);background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--zs-accent) 13%,transparent),transparent 55%),var(--vscode-sideBar-background,var(--tertiary-bg))}
.zs-callout-icon{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:var(--zs-accent);background:color-mix(in srgb,var(--zs-accent) 14%,transparent)}
.zs-callout-body{flex:1;min-width:0}
.zs-callout-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.zs-callout-title{font-size:14.5px;font-weight:600;color:var(--primary-text)}
.zs-callout-badge{display:inline-flex;align-items:center;gap:6px;line-height:1;font-size:13px;font-weight:500;color:var(--zs-accent);padding:2px 8px;border-radius:4px;background:color-mix(in srgb,var(--zs-accent) 14%,transparent);border:1px dashed color-mix(in srgb,var(--zs-accent) 50%,transparent)}
.zs-callout-dot{flex:none;width:6px;height:6px;border-radius:50%;background:currentColor;animation:zsBlink 1.4s ease-in-out infinite}
@keyframes zsBlink{50%{opacity:.25}}
.zs-callout-text{margin:5px 0 0;font-size:14px;line-height:1.55;color:var(--secondary-text)}
.zs-chip{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font-size:13.5px;color:var(--zs-accent)}
.zs-chip code{font-family:var(--vscode-editor-font-family,monospace);font-size:13px;padding:1px 5px;border-radius:4px;background:color-mix(in srgb,var(--zs-accent) 14%,transparent)}

.zs-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;color:var(--secondary-text);background:transparent;transition:background .15s ease,color .15s ease}
.zs-icon-btn:hover:not(:disabled){color:var(--primary-text);background:rgba(128,128,128,.14)}
.zs-icon-btn:disabled{cursor:wait;opacity:.6}
.zs-link{display:inline-flex;align-items:center;gap:5px;min-width:0;font-size:13.5px;color:var(--secondary-text);text-decoration:none;transition:color .15s ease}
.zs-link:hover{color:var(--primary-text)}
.zs-tile{display:flex;align-items:center;gap:12px;min-width:0;padding:8px 10px;margin:0 -10px;border-radius:8px;text-decoration:none;transition:background .15s ease}
a.zs-tile:hover{background:rgba(128,128,128,.12)}

.zs-tabs{display:flex;gap:2px}
.zs-tab{display:flex;align-items:center;gap:7px;padding:6px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;font-size:14.5px;font-weight:500;color:var(--secondary-text);user-select:none;transition:background .15s ease,color .15s ease}
.zs-tab:hover{color:var(--primary-text)}
.zs-tab.active{color:var(--primary-text);background:rgba(128,128,128,.16)}
.zs-tab.active svg{color:var(--zs-accent)}
`;

const accentVars = (accent: string): React.CSSProperties =>
  ({ "--zs-accent": accent }) as React.CSSProperties;

export { accentVars };

export const Chevron: React.FC = () => (
  <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
);

interface SectionCardProps {
  icon: React.ReactNode;
  accent: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  icon,
  accent,
  title,
  description,
  action,
  children,
}) => (
  <section className="zs-section" style={accentVars(accent)}>
    <header className="zs-section-head">
      <div className="zs-section-icon">{icon}</div>
      <div className="zs-section-title">
        <span>{title}</span>
        {description && <small>{description}</small>}
      </div>
      {action}
    </header>
    <div className="zs-section-body">{children}</div>
  </section>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="zs-field">
    <label>{label}</label>
    {children}
    {hint && <span className="zs-hint">{hint}</span>}
  </div>
);

export const ToggleRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="zs-row">
    <div className="zs-row-text">
      <span className="zs-row-title">{title}</span>
      <span className="zs-hint">{description}</span>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      className={`zs-switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  </div>
);

export const Callout: React.FC<{
  accent: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ accent, icon, title, badge, children }) => (
  <div className="zs-callout" style={accentVars(accent)}>
    <div className="zs-callout-icon">{icon}</div>
    <div className="zs-callout-body">
      <div className="zs-callout-head">
        <span className="zs-callout-title">{title}</span>
        {badge && (
          <span className="zs-callout-badge">
            <span className="zs-callout-dot" />
            {badge}
          </span>
        )}
      </div>
      <p className="zs-callout-text">{children}</p>
    </div>
  </div>
);

export const StatusChip: React.FC<{
  color: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ color, icon, children }) => (
  <span className="zs-chip" style={accentVars(color)}>
    {icon}
    {children}
  </span>
);