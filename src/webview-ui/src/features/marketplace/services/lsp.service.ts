/**
 * ------------------------------------------------------------------
 * LSP Service
 * ------------------------------------------------------------------
 * Quản lý LSP servers: detect language, check installed, mark installed
 * ------------------------------------------------------------------
 */

import type { LSPServer } from '../constants/lsp-servers';

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    pyw: 'python',
    rs: 'rust',
    go: 'go',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',
    html: 'html',
    htm: 'html',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
  };

  return extMap[ext] || '';
}

/**
 * Get LSP server info for a given filename
 */
export function getLSPServerByLanguage(language: string, servers: LSPServer[]): LSPServer | null {
  return servers.find(s => s.id === language) || null;
}

const INSTALLED_KEY = 'lsp-installed-servers';

/**
 * Check if an LSP server is marked as installed
 */
export function isLSPInstalled(serverId: string): boolean {
  try {
    const installed = JSON.parse(localStorage.getItem(INSTALLED_KEY) || '[]');
    return installed.includes(serverId);
  } catch {
    return false;
  }
}

/**
 * Mark an LSP server as installed
 */
export function markLSPInstalled(serverId: string): void {
  try {
    const installed = JSON.parse(localStorage.getItem(INSTALLED_KEY) || '[]');
    if (!installed.includes(serverId)) {
      installed.push(serverId);
      localStorage.setItem(INSTALLED_KEY, JSON.stringify(installed));
    }
  } catch {
    // ignore
  }
}

/**
 * Unmark an LSP server as installed
 */
export function unmarkLSPInstalled(serverId: string): void {
  try {
    const installed = JSON.parse(localStorage.getItem(INSTALLED_KEY) || '[]');
    const filtered = installed.filter((id: string) => id !== serverId);
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}
