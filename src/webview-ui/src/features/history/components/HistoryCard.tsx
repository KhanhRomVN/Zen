/**
 * ------------------------------------------------------------------
 * HistoryCard
 * ------------------------------------------------------------------
 * Card hiển thị một hội thoại trong danh sách lịch sử.
 * Lazy-load tin nhắn khi hover/click, hiển thị model, số msg, token,
 * custom tooltip bám theo con chuột và context menu.
 *
 * Main features:
 * - Avatar provider (favicon), tiêu đề, thời gian, model, tổng msg
 * - Token pill (kèm chữ tok) màu theo ngưỡng sử dụng
 * - Hover: accent bar, nút hành động nhanh (copy, xóa)
 * - Custom tooltip (portal): bám theo chuột, hiện/ẩn tức thì
 * - Context menu: Xóa, Copy nội dung, Mở thư mục conv
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React from 'react';
import { createPortal } from 'react-dom';

// ── UI ──
import { Trash2, Copy, FolderOpen, Zap, Eye, Clock } from 'lucide-react';

// ── Services ──
import { extensionService } from '../../../services/ExtensionService';

// ── Types ──
import { ConversationItem } from '../types';

// ─── Interfaces ─────────────────────────────────────────────────────────
interface HistoryCardProps {
  item: ConversationItem;
  onClick: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatDate: (timestamp: number) => string;
  providerFavicons?: Record<string, string>;
  /** Conversation này thuộc provider view-only (session_cleanup / no-auth) */
  isViewOnly?: boolean;
  /** Hội thoại này đang được mở trong Chat */
  selected?: boolean;
}

/** Vị trí con trỏ (viewport) mà tooltip bám theo. */
interface TooltipPoint {
  x: number;
  y: number;
}

// ─── Constants ──────────────────────────────────────────────────────────
const TOOLTIP_PREVIEW_CHARS = 600;
const TOOLTIP_OFFSET = 14;
const STYLE_ID = 'history-card-styles';

const FAVICON_DOMAINS: Array<[string[], string]> = [
  [['openai', 'chatgpt', 'gpt'], 'openai.com'],
  [['anthropic', 'claude'], 'anthropic.com'],
  [['google', 'gemini'], 'google.com'],
  [['openrouter'], 'openrouter.ai'],
  [['deepseek'], 'deepseek.com'],
  [['grok', 'xai', 'x.ai'], 'x.ai'],
  [['zenmux'], 'zenmux.ai'],
  [['moonshot', 'kimi'], 'moonshot.cn'],
  [['qwen', 'alibaba', 'aliyun', 'dashscope'], 'qwen.ai'],
  [['groq'], 'groq.com'],
  [['mistral'], 'mistral.ai'],
  [['glm', 'zai', 'z-ai', 'zhipu', 'bigmodel'], 'bigmodel.cn'],
  [['cohere'], 'cohere.com'],
  [['perplexity'], 'perplexity.ai'],
  [['together'], 'together.ai'],
  [['fireworks'], 'fireworks.ai'],
  [['meta', 'llama'], 'meta.com'],
  [['siliconflow'], 'siliconflow.cn'],
  [['baichuan'], 'baichuan-ai.com'],
  [['minimax'], 'minimaxi.com'],
  [['01wanwu', 'yi-'], '01.ai'],
];

const CARD_CSS = `
.hc-root { position: relative; width: 100%; }
.hc-card { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 9px 10px 9px 12px; border-radius: 10px; border: 1px solid transparent; background: transparent; cursor: pointer; overflow: hidden; outline: none; transition: background-color .15s ease, border-color .15s ease, transform .12s ease; }
.hc-card:hover, .hc-card:focus-visible { background: var(--hover-bg); border-color: color-mix(in srgb, var(--border-color, #3e3e42) 70%, transparent); }
.hc-card:focus-visible { border-color: var(--vscode-focusBorder, #6366f1); }
.hc-card:active { transform: scale(.994); }
.hc-card.selected { background: var(--hover-bg); border-color: color-mix(in srgb, var(--vscode-focusBorder, #6366f1) 45%, transparent); }
.hc-card.selected .hc-accent { height: 56%; }
.hc-accent { position: absolute; left: 0; top: 50%; width: 3px; height: 0; border-radius: 0 3px 3px 0; background: var(--vscode-focusBorder, #6366f1); transform: translateY(-50%); transition: height .18s ease; }
.hc-card:hover .hc-accent, .hc-card:focus-visible .hc-accent { height: 56%; }
.hc-avatar { flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--primary-text, #ccc) 7%, transparent); border: 1px solid color-mix(in srgb, var(--border-color, #3e3e42) 60%, transparent); font-size: 12px; font-weight: 700; color: var(--secondary-text, #858585); overflow: hidden; }
.hc-avatar img { width: 16px; height: 16px; border-radius: 3px; }
.hc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.hc-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hc-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; line-height: 1.3; color: var(--primary-text); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hc-side { position: relative; flex-shrink: 0; display: grid; align-items: center; justify-items: end; }
.hc-side > * { grid-area: 1 / 1; }
.hc-time { font-size: 10px; font-weight: 500; color: var(--secondary-text, #858585); transition: opacity .12s ease; }
.hc-actions { display: flex; gap: 2px; opacity: 0; pointer-events: none; transition: opacity .12s ease; }
.hc-card:hover .hc-time, .hc-card:focus-within .hc-time { opacity: 0; }
.hc-card:hover .hc-actions, .hc-card:focus-within .hc-actions { opacity: 1; pointer-events: auto; }
.hc-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; border: none; background: transparent; color: var(--secondary-text, #858585); cursor: pointer; transition: background-color .12s ease, color .12s ease; }
.hc-icon-btn:hover { background: color-mix(in srgb, var(--primary-text, #ccc) 12%, transparent); color: var(--primary-text); }
.hc-icon-btn.danger:hover { background: color-mix(in srgb, var(--error-color, #f44336) 16%, transparent); color: var(--error-color, #f44336); }
.hc-meta { gap: 8px; }
.hc-model { max-width: 55%; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--primary-text, #ccc) 7%, transparent); color: var(--secondary-text, #858585); font-size: 10px; font-weight: 500; line-height: 15px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hc-stat { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 500; color: var(--secondary-text, #858585); flex-shrink: 0; }
.hc-spacer { flex: 1; }
.hc-viewonly { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: .03em; color: #ca8a04; background: color-mix(in srgb, #eab308 14%, transparent); border: 1px solid color-mix(in srgb, #eab308 35%, transparent); flex-shrink: 0; }
.hc-token { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; flex-shrink: 0; color: var(--tone); background: color-mix(in srgb, var(--tone) 14%, transparent); border: 1px solid color-mix(in srgb, var(--tone) 32%, transparent); }

.hc-tip { position: fixed; z-index: 2000; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 12px; overflow: hidden; pointer-events: none; border-radius: 12px; background: var(--tertiary-bg, #2d2d30); border: 1px solid var(--border-color, #3e3e42); box-shadow: 0 12px 32px rgba(0,0,0,.35); }
.hc-tip-title { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--primary-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.hc-tip-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.hc-tip-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 500; color: var(--secondary-text, #858585); background: color-mix(in srgb, var(--primary-text, #ccc) 7%, transparent); }
.hc-tip-chip img { width: 10px; height: 10px; border-radius: 2px; }
.hc-tip-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.hc-tip-stat { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; border-radius: 8px; background: color-mix(in srgb, var(--primary-text, #ccc) 5%, transparent); }
.hc-tip-stat b { font-size: 13px; font-weight: 700; color: var(--primary-text); }
.hc-tip-stat span { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text, #858585); }
.hc-tip-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text, #858585); opacity: .8; }
.hc-tip-preview { font-size: 12px; line-height: 1.5; color: var(--primary-text); white-space: pre-wrap; word-break: break-word; padding: 8px 10px; border-radius: 4px; background: color-mix(in srgb, var(--primary-text, #ccc) 5%, transparent); display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
.hc-tip-muted { font-size: 12px; color: var(--secondary-text, #858585); font-style: italic; }
.hc-skel { height: 9px; border-radius: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--primary-text, #ccc) 6%, transparent), color-mix(in srgb, var(--primary-text, #ccc) 14%, transparent), color-mix(in srgb, var(--primary-text, #ccc) 6%, transparent)); background-size: 200% 100%; animation: hc-shimmer 1.2s linear infinite; }
@keyframes hc-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.hc-tip-hint { font-size: 10px; color: var(--secondary-text, #858585); opacity: .75; }

.hc-menu { position: fixed; z-index: 1000; min-width: 190px; padding: 4px; border-radius: 10px; background: var(--tertiary-bg, #2d2d30); border: 1px solid var(--border-color, #3e3e42); box-shadow: 0 8px 24px rgba(0,0,0,.28); }
.hc-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 12px; border: none; border-radius: 6px; background: transparent; color: var(--primary-text); font-size: 12px; text-align: left; cursor: pointer; }
.hc-menu-item:hover { background: var(--hover-bg); }
.hc-menu-item.danger { color: var(--error-color, #f44336); }
.hc-menu-item.danger:hover { background: color-mix(in srgb, var(--error-color, #f44336) 12%, transparent); }
`;

// ─── Helpers (pure) ─────────────────────────────────────────────────────
/** Chèn CSS dùng chung vào document.head đúng 1 lần cho mọi card. */
const ensureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID))
    return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CARD_CSS;
  document.head.appendChild(el);
};

/** Màu token theo ngưỡng sử dụng. */
const getTokenTone = (n: number): string => {
  if (n >= 500000) return '#ef4444';
  if (n >= 100000) return '#f97316';
  if (n >= 50000) return '#ca8a04';
  if (n >= 10000) return '#16a34a';
  return '#6366f1';
};

const formatTokens = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

/** Tách nội dung người dùng khỏi wrapper XML của prompt. */
const parseUserContent = (raw: string): string => {
  const content = raw || '';
  const match = content.match(
    /## User Message\n<user-message>\n([\s\S]*?)\n<\/user-message>/,
  );
  if (match) return match[1];
  let cleaned = content
    .replace(/^<user-message>\n?/, '')
    .replace(/\n?<\/user-message>[\s\S]*$/, '');
  if (cleaned.startsWith('```') && cleaned.includes('```', 3)) {
    cleaned = cleaned.split('```')[1]?.trim() || cleaned;
  }
  return cleaned || '';
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** "Just now", "2m ago", "Yesterday 12:30", "dd/mm/yy hh:mm" */
const formatTimeText = (timestamp: number): string => {
  if (!timestamp) return '';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const d = new Date(timestamp);
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (days === 0) {
    if (hours === 0) return minutes <= 0 ? 'Just now' : `${minutes}m ago`;
    return `${hours}h ago`;
  }
  if (days === 1) return `Yesterday ${hhmm}`;
  if (days < 7) return `${days}d ago`;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${hhmm}`;
};

const getFaviconUrlSync = (pid: string): string => {
  if (!pid) return '';
  const lower = pid.toLowerCase();
  const hit = FAVICON_DOMAINS.find(([keys]) =>
    keys.some((k) => lower.includes(k)),
  );
  const domain = hit ? hit[1] : `${lower}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
};

/**
 * Tính style cho tooltip theo vị trí con chuột: đặt lệch phải-dưới con trỏ,
 * tự lật lên trên / sang trái khi thiếu chỗ trong viewport.
 */
const getTooltipStyle = (p: TooltipPoint): React.CSSProperties => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(340, vw - 16);
  const left = Math.max(8, Math.min(p.x + TOOLTIP_OFFSET, vw - width - 8));
  const spaceBelow = vh - p.y - TOOLTIP_OFFSET - 8;
  const spaceAbove = p.y - TOOLTIP_OFFSET - 8;
  const below = spaceBelow >= 200 || spaceBelow >= spaceAbove;
  return below
    ? {
        left,
        width,
        top: p.y + TOOLTIP_OFFSET,
        maxHeight: Math.min(320, spaceBelow),
      }
    : {
        left,
        width,
        bottom: vh - p.y + TOOLTIP_OFFSET,
        maxHeight: Math.min(320, spaceAbove),
      };
};

// ─── Component ──────────────────────────────────────────────────────────
const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onClick,
  onDelete,
  providerFavicons,
  isViewOnly = false,
  selected = false,
}) => {
  // ── State ──
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [messageFetchError, setMessageFetchError] = React.useState<
    string | null
  >(null);
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const [tooltip, setTooltip] = React.useState<TooltipPoint | null>(null);
  const [failedFavicon, setFailedFavicon] = React.useState<string | null>(null);

  // ── Refs ──
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const loadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Derived ──
  const userContent = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return parseUserContent(messages[i].content);
    }
    return '';
  }, [messages]);

  // Tổng số msg (user + assistant không lỗi); trước khi tải dùng messageCount
  const totalMsgs = React.useMemo(() => {
    if (!messages.length) return item.messageCount ?? 0;
    return messages.filter((m: any) => m.role === 'user' || !m.isError).length;
  }, [messages, item.messageCount]);

  const messagesModel = React.useMemo(() => {
    const m = messages.find(
      (x: any) => x.role === 'assistant' && (x.modelId || x.providerId),
    );
    return {
      providerId: (m?.providerId as string) || null,
      modelId: (m?.modelId as string) || null,
    };
  }, [messages]);

  const providerId = item.providerId || item.provider || messagesModel.providerId;
  const modelId = item.modelId || messagesModel.modelId;
  const favicon = providerId
    ? providerFavicons?.[providerId] || getFaviconUrlSync(providerId)
    : null;
  const showFavicon = !!favicon && failedFavicon !== favicon;

  const tokens = item.totalTokenUsage ?? 0;
  const tone = getTokenTone(tokens);

  const timestamp = item.lastModified || item.timestamp || item.createdAt || 0;
  const timeText = formatTimeText(timestamp);
  const displayTitle = item.title || userContent || item.preview || 'Untitled';

  // ── Callbacks ──
  // Lazy load messages only when user hovers, focuses or clicks
  const triggerLoad = React.useCallback(() => {
    if (shouldLoad || isLoadingMessages || messages.length > 0) return;
    setShouldLoad(true);
  }, [shouldLoad, isLoadingMessages, messages.length]);

  const hideTooltip = React.useCallback(() => setTooltip(null), []);

  // ── Effects ──
  React.useLayoutEffect(() => {
    ensureStyles();
  }, []);

  // Fetch messages when shouldLoad becomes true
  React.useEffect(() => {
    if (!shouldLoad) return;

    // Check cache first
    const cached = (window as any).ConversationCache?.get(item.id);
    if (cached && cached.messages && cached.messages.length > 0) {
      setMessages(cached.messages);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    setMessageFetchError(null);
    const requestId = `hist-card-${Date.now()}`;
    extensionService.postMessage({
      command: 'getConversation',
      conversationId: item.id,
      requestId,
    });

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (
        data.command === 'conversationResult' &&
        data.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        if (data.data?.messages) {
          setMessages(data.data.messages);
          if ((window as any).ConversationCache) {
            (window as any).ConversationCache.set(item.id, {
              messages: data.data.messages,
              conversationId: item.id,
            });
          }
        } else {
          setMessageFetchError('No messages found');
        }
        setIsLoadingMessages(false);
      }
    };

    window.addEventListener('message', handler);
    loadTimeoutRef.current = setTimeout(() => {
      window.removeEventListener('message', handler);
      setIsLoadingMessages(false);
    }, 5000);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      window.removeEventListener('message', handler);
    };
  }, [shouldLoad, item.id]);

  // Đóng context menu khi click ra ngoài
  React.useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuVisible]);

  // Ẩn tooltip khi cuộn danh sách
  React.useEffect(() => {
    if (!tooltip) return;
    window.addEventListener('scroll', hideTooltip, true);
    return () => window.removeEventListener('scroll', hideTooltip, true);
  }, [!!tooltip, hideTooltip]);

  // ── Handlers ──
  const handleOpen = () => {
    hideTooltip();
    triggerLoad();
    onClick();
  };

  const handleCopyContent = () => {
    const requestId = `copy-${Date.now()}`;
    extensionService.postMessage({
      command: 'getConversation',
      conversationId: item.id,
      requestId,
    });
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (
        data.command === 'conversationResult' &&
        data.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        if (data.data?.messages) {
          const text = data.data.messages
            .map((msg: any) => {
              const content =
                msg.role === 'user'
                  ? parseUserContent(msg.content) || msg.content
                  : msg.content;
              return `[${String(msg.role).toUpperCase()}]\n${content}`;
            })
            .join('\n\n');
          navigator.clipboard.writeText(text.trim());
        }
      }
    };
    window.addEventListener('message', handler);
    setTimeout(() => window.removeEventListener('message', handler), 5000);
  };

  const handleOpenConversationFolder = () => {
    extensionService.postMessage({
      command: 'openConversationFolder',
      conversationId: item.id,
    });
  };

  const menuItems = [
    {
      icon: <Trash2 size={13} />,
      label: 'Delete conversation',
      danger: true,
      action: (e: React.MouseEvent) => onDelete(item.id, e),
    },
    {
      icon: <Copy size={13} />,
      label: 'Copy content',
      danger: false,
      action: () => handleCopyContent(),
    },
    {
      icon: <FolderOpen size={13} />,
      label: 'Open conversation folder',
      danger: false,
      action: () => handleOpenConversationFolder(),
    },
  ];

  // ── Render ──
  return (
    <div className='hc-root'>
      <div
        ref={cardRef}
        className={`hc-card${selected ? ' selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
        role='button'
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        onMouseEnter={(e) => {
          triggerLoad();
          setTooltip({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={hideTooltip}
        onFocus={(e) => {
          triggerLoad();
          // Chỉ hiện tooltip khi focus bằng bàn phím (không có tọa độ chuột)
          if (e.currentTarget.matches(':focus-visible')) {
            const r = e.currentTarget.getBoundingClientRect();
            setTooltip({ x: r.left + 24, y: r.bottom - TOOLTIP_OFFSET });
          }
        }}
        onBlur={hideTooltip}
        onContextMenu={(e) => {
          e.preventDefault();
          hideTooltip();
          triggerLoad();
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setMenuVisible(true);
        }}
      >
        <span className='hc-accent' />

        {/* Avatar provider */}
        <div className='hc-avatar'>
          {showFavicon ? (
            <img
              src={favicon as string}
              alt=''
              onError={() => setFailedFavicon(favicon)}
            />
          ) : (
            (providerId || '?').charAt(0).toUpperCase()
          )}
        </div>

        <div className='hc-body'>
          {/* Row 1: tiêu đề + thời gian / hành động nhanh */}
          <div className='hc-row'>
            <span className='hc-title'>{displayTitle}</span>
            <div className='hc-side'>
              <span className='hc-time'>{timeText}</span>
              <div className='hc-actions'>
                <button
                  type='button'
                  className='hc-icon-btn'
                  title='Copy content'
                  aria-label='Copy content'
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyContent();
                  }}
                >
                  <Copy size={12} />
                </button>
                <button
                  type='button'
                  className='hc-icon-btn danger'
                  title='Delete conversation'
                  aria-label='Delete conversation'
                  onClick={(e) => {
                    e.stopPropagation();
                    hideTooltip();
                    onDelete(item.id, e);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: model, tổng msg, badges */}
          <div className='hc-row hc-meta'>
            {modelId && <span className='hc-model'>{modelId}</span>}
            <span className='hc-stat' title='Total messages'>
              {totalMsgs} msg
            </span>
            <span className='hc-spacer' />
            {isViewOnly && (
              <span className='hc-viewonly'>
                <Eye size={9} />
                View Only
              </span>
            )}
            {tokens > 0 && (
              <span
                className='hc-token'
                style={{ '--tone': tone } as React.CSSProperties}
                title={`${tokens.toLocaleString()} tokens`}
              >
                <Zap size={9} />
                {formatTokens(tokens)} tok
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Custom tooltip (bám theo chuột, không delay) */}
      {tooltip &&
        createPortal(
          <div
            className='hc-tip'
            role='tooltip'
            style={getTooltipStyle(tooltip)}
          >
            <div className='hc-tip-title'>{displayTitle}</div>

            <div className='hc-tip-chips'>
              {providerId && (
                <span className='hc-tip-chip'>
                  {showFavicon && <img src={favicon as string} alt='' />}
                  {providerId}
                </span>
              )}
              {modelId && <span className='hc-tip-chip'>{modelId}</span>}
              {timestamp > 0 && (
                <span className='hc-tip-chip'>
                  <Clock size={10} />
                  {new Date(timestamp).toLocaleString()}
                </span>
              )}
            </div>

            <div className='hc-tip-stats'>
              <div className='hc-tip-stat'>
                <b>{totalMsgs}</b>
                <span>msg</span>
              </div>
              <div className='hc-tip-stat'>
                <b style={{ color: tokens > 0 ? tone : undefined }}>
                  {formatTokens(tokens)}
                </b>
                <span>tok</span>
              </div>
            </div>

            <div className='hc-tip-label'>Latest message</div>
            {isLoadingMessages ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className='hc-skel' style={{ width: '92%' }} />
                <div className='hc-skel' style={{ width: '78%' }} />
                <div className='hc-skel' style={{ width: '54%' }} />
              </div>
            ) : messageFetchError ? (
              <div className='hc-tip-muted'>{messageFetchError}</div>
            ) : userContent || item.preview ? (
              <div className='hc-tip-preview'>
                {(userContent || item.preview).slice(0, TOOLTIP_PREVIEW_CHARS)}
              </div>
            ) : (
              <div className='hc-tip-muted'>No content</div>
            )}

            <div className='hc-tip-hint'>Click to open · Right-click for more</div>
          </div>,
          document.body,
        )}

      {/* Context menu */}
      {menuVisible &&
        createPortal(
          <div
            className='hc-menu'
            style={{
              top: Math.min(menuPosition.y, window.innerHeight - 140),
              left: Math.min(menuPosition.x, window.innerWidth - 200),
            }}
          >
            {menuItems.map((m) => (
              <button
                key={m.label}
                type='button'
                className={`hc-menu-item${m.danger ? ' danger' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuVisible(false);
                  m.action(e);
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default HistoryCard;