/**
 * ------------------------------------------------------------------
 * SidebarWidthToggle
 * ------------------------------------------------------------------
 * Nút ở góc phải trên cùng của Home để chuyển nhanh giữa dạng hẹp
 * (mặc định) và dạng rộng bằng cách maximize/restore secondary
 * sidebar của VS Code (message toggleMaximizedSidebar gửi cho
 * extension). Trạng thái rộng/hẹp do Home đo từ bề rộng thực của
 * webview nên luôn đúng kể cả khi người dùng dùng icon gốc của VS Code.
 *
 * Yêu cầu: element cha có position: relative.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────
interface SidebarWidthToggleProps {
  isWide: boolean;
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = `
  .zen-width-toggle {
    position: absolute; top: 8px; right: 18px; z-index: 20;
    width: 28px; height: 28px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    border: none; border-radius: 6px; cursor: pointer;
    background: transparent;
    color: var(--vscode-descriptionForeground, #8b95a8);
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .zen-width-toggle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.2));
    color: var(--vscode-foreground, #e8ecf4);
  }
  .zen-width-toggle:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #3b82f6);
    outline-offset: 1px;
  }
`;

// ─── Component ──────────────────────────────────────────────────────────
const SidebarWidthToggle: React.FC<SidebarWidthToggleProps> = ({ isWide }) => {
  const label = isWide
    ? "Restore secondary sidebar width"
    : "Maximize secondary sidebar";

  const handleClick = () => {
    (window as any).vscodeApi?.postMessage({
      command: "toggleMaximizedSidebar",
    });
  };

  return (
    <>
      <style>{styles}</style>
      <button
        type="button"
        className="zen-width-toggle"
        onClick={handleClick}
        title={label}
        aria-label={label}
        aria-pressed={isWide}
      >
        {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </>
  );
};

export default SidebarWidthToggle;