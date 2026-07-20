import React, { useState, useEffect, useRef } from 'react';
import { logger, type LogEntry } from '../utils/logger';

interface LogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogDrawer: React.FC<LogDrawerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchText, setSearchText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLogs(logger.getLogs());
      const unsubscribe = logger.subscribe(() => {
        setLogs(logger.getLogs());
      });
      return () => {
        unsubscribe();
      };
    }
  }, [isOpen]);

  const handleClear = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const handleCopyAll = async () => {
    const text = logs.map(log => {
      const date = new Date(log.timestamp);
      const time = date.toLocaleTimeString();
      const dataStr = log.data ? ' ' + JSON.stringify(log.data, null, 2) : '';
      return `[${time}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const handleCopyLog = async (log: LogEntry, index: number) => {
    const date = new Date(log.timestamp);
    const time = date.toLocaleTimeString();
    const dataStr = log.data ? '\n' + JSON.stringify(log.data, null, 2) : '';
    const text = `[${time}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy log:', err);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    const fullText = formatLogEntry(log);
    return fullText.toLowerCase().includes(searchLower);
  });

  const highlightText = (text: string, search: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === search.toLowerCase() 
        ? <mark key={i} style={{ background: '#ffd70080', color: 'inherit' }}>{part}</mark>
        : part
    );
  };

  const formatLogEntry = (log: LogEntry) => {
    // Return raw message without any parsing
    let text = log.message;
    if (log.data) {
      // Append data as is, without JSON.stringify which adds extra escaping
      if (typeof log.data === 'string') {
        text += ' ' + log.data;
      } else {
        text += ' ' + JSON.stringify(log.data);
      }
    }
    return text;
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
        }}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: '70vh',
          backgroundColor: 'var(--vscode-editor-background)',
          borderTop: '1px solid var(--vscode-panel-border)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--vscode-panel-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 14v2.2l1.6 1"/>
              <path d="M16 4h2a2 2 0 0 1 2 2v.832"/>
              <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/>
              <circle cx="16" cy="16" r="6"/>
              <rect x="8" y="2" width="8" height="4" rx="1"/>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Console Logs</span>
            <span style={{ 
              fontSize: '11px', 
              color: 'var(--vscode-descriptionForeground)',
              backgroundColor: 'var(--vscode-badge-background)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              {filteredLogs.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClear}
              title="Clear all logs"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                color: 'var(--vscode-foreground)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/>
                <path d="m5.082 11.09 8.828 8.828"/>
              </svg>
            </button>
            <button
              onClick={handleCopyAll}
              title="Copy all logs"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                color: copiedIndex === -1 ? '#4caf50' : 'var(--vscode-foreground)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {copiedIndex === -1 ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                color: 'var(--vscode-foreground)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Logs */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '12px 16px', 
            fontFamily: 'monospace', 
            fontSize: '12px', 
            lineHeight: '1.6', 
            whiteSpace: 'pre-wrap',
            backgroundColor: 'var(--vscode-editor-background)',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: 'var(--vscode-descriptionForeground)',
              fontSize: '13px',
            }}>
              {searchText ? 'No logs match your search' : 'No logs yet'}
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const fullText = formatLogEntry(log);
              
              // Color based on log level
              const levelColors = {
                log: 'var(--vscode-foreground)', // Default/normal color
                info: 'var(--vscode-descriptionForeground)', // Dimmed/darker gray
                warn: '#ffc107', // Yellow/amber
                error: '#f44336', // Red
              };
              
              const color = levelColors[log.level] || levelColors.log;
              
              return (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <div style={{
                      borderTop: '1px solid var(--vscode-panel-border)',
                      margin: '8px 0',
                      opacity: 0.3,
                    }} />
                  )}
                  <div style={{ color }}>
                    {highlightText(fullText, searchText)}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default LogDrawer;
