# Code Comment Convention

This document defines the standard comment structure for all source files in the Phantoma project.

---

## 1. File Header

Every file **must** start with a block comment describing the file's purpose and listing its main exports/functions/features.

```ts
/**
 * ------------------------------------------------------------------
 * <File Title>
 * ------------------------------------------------------------------
 * <Brief description — what this file does, when to use it, key responsibilities.>
 *
 * Main <functions|features|types>:
 * - itemA() : <short description>
 * - itemB() : <short description>
 * - itemC() : <short description>
 * ------------------------------------------------------------------
 */
```

**Example (Service):**

```ts
/**
 * ------------------------------------------------------------------
 * IndexedDB Service
 * ------------------------------------------------------------------
 * General wrapper for IndexedDB with Promise-based API.
 * Used across the renderer when structured data storage is needed
 * with large capacity, index-based queries, or transactions.
 *
 * Main functions:
 * - open()      : Open database (create/upgrade if needed)
 * - get()       : Get a record by key
 * - getAll()    : Get all records in a store
 * - put()       : Add or update a record
 * - delete()    : Delete a record by key
 * - clear()     : Clear all records in a store
 * ------------------------------------------------------------------
 */
```

**Example (UI Component):**

```ts
/**
 * ------------------------------------------------------------------
 * FooterBar
 * ------------------------------------------------------------------
 * Status bar displayed at the bottom of the Code editor module.
 * Shows LSP (Language Server Protocol) status for the active file,
 * including install prompts, initialization progress, and connection state.
 *
 * Main features:
 * - Detects and displays the LSP server for the current file type
 * - Shows install prompt (⚠) for detected but not installed LSP servers
 * - Shows checkmark for installed and active LSP servers
 * - Displays real-time LSP initialization progress bar with percentage
 * - Auto-hides progress bar after diagnostics are ready
 * ------------------------------------------------------------------
 */
```

---

## 2. Section Dividers

Use dividers to group related code blocks. There are **two levels**:

| Level | Format | Usage |
|-------|--------|-------|
| **Section** (top-level) | `// ─── <Name> ───` (3 dashes, extends to column 80) | Imports, Interfaces, Constants, Component, Class, Singleton, Hook, Store... |
| **Sub-section** (inside a block) | `// ── <Name> ──` (2 dashes) | Import groups, State, Effects, Callbacks, Handlers, Render... |

### Standard Sections by File Type

| File Type       | Typical Top-Level Sections                                |
|-----------------|-----------------------------------------------------------|
| **Services**    | Imports, Interfaces, Constants, Class, Singleton          |
| **Components**  | Imports, Interfaces, Constants, Component                 |
| **Hooks**       | Imports, Types, Constants, Hook                           |
| **Utils**       | Imports, Constants, Functions                             |
| **Types**       | Imports, Types                                            |
| **Stores**      | Imports, Interfaces, Constants, Store                     |

### Example (Service)

```ts
// ─── Imports ────────────────────────────────────────────────────────────
import { apiService } from './api.service';

// ─── Interfaces ─────────────────────────────────────────────────────────
interface DatabasePathResponse {
  path: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT = 5000;

// ─── Class ──────────────────────────────────────────────────────────────
class DatabaseService {
  // ...
}

// ─── Singleton ──────────────────────────────────────────────────────────
export const databaseService = new DatabaseService();
```

---

## 3. Import Sub-Grouping

Within the `// ─── Imports ───` section, group imports by category using sub-section comments (`// ── <Category> ──`). Order from external to internal:

```
// ── React ──        → react, react-dom
// ── UI ──           → lucide-react, radix-ui, custom UI libs
// ── Hooks ──        → custom hooks
// ── Services ──     → service modules
// ── Stores ──       → Zustand stores
// ── Utils ──        → cn, format, shared helpers
// ── Types ──        → type-only imports
```

**Example:**

```ts
// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useEffect, useCallback } from 'react';

// ── UI ──
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

// ── Hooks ──
import { useCodeStore } from '../hooks/useCodeStore';

// ── Services ──
import {
  getLSPServer,
  isLSPInstalled,
  isLSPDismissed,
  type LSPServer,
} from '../services/lsp.service';

// ── Utils ──
import { cn } from '@renderer/shared/utils/cn';
```

**Rules:**
- Only add a category comment if there are imports for it — skip empty categories.
- Put `type` imports inline with their module group, not in a separate group.
- Order: external packages → internal modules (ascending depth).

---

## 4. Internal Sub-Sections (Components & Hooks)

Inside a component or hook function body, group logic with sub-section comments (`// ── <Name> ──`). Use this standard order:

| Sub-section   | Content |
|---------------|---------|
| `State`       | `useState` declarations |
| `Store`       | `useXStore` / Zustand selectors |
| `Refs`        | `useRef` declarations |
| `Derived`     | Computed values from state/store (`useMemo` or plain derivations) |
| `Callbacks`   | `useCallback` definitions |
| `Effects`     | `useEffect` blocks |
| `Handlers`    | Event handler functions (`handleX`, `onX`) |
| `Render`      | The `return` JSX |

**Example:**

```tsx
// ─── Component ──────────────────────────────────────────────────────────
export function FooterBar({ className }: FooterBarProps) {
  // ── State ──
  const [activeLSP, setActiveLSP] = useState<LSPServer | null>(null);
  const [pendingLSP, setPendingLSP] = useState(false);

  // ── Store ──
  const projects = useCodeStore((s) => s.projects);
  const currentProjectId = useCodeStore((s) => s.currentProjectId);

  // ── Derived ──
  const project = projects.find((p) => p.id === currentProjectId);
  const activeFileTabId = project?.activeFileTabId ?? null;

  // ── Callbacks ──
  const checkLSP = useCallback(() => {
    // ...
  }, [activeFileTabId]);

  // ── Effects ──
  useEffect(() => {
    const timer = setTimeout(checkLSP, 1500);
    return () => clearTimeout(timer);
  }, [checkLSP]);

  // ── Handlers ──
  const handleLSPClick = () => {
    // ...
  };

  // ── Render ──
  return (
    <div>...</div>
  );
}
```

**Rules:**
- Only add sub-sections that have content — skip empty ones.
- Keep the standard order even if some sections are empty (for consistency across files).
- For small components (under ~30 lines), sub-sections may be omitted — use judgment.

---

## 5. Full Examples
### 5.1 Service

File: `src/renderer/src/services/api.service.ts`

```ts
/**
 * ------------------------------------------------------------------
 * API Service
 * ------------------------------------------------------------------
 * Base HTTP client for the Go backend server. Handles request/response,
 * health check, and base URL management.
 *
 * Main functions:
 * - setBaseUrl()   : Update base URL
 * - get()          : Send GET request
 * - post()         : Send POST request
 * - request()      : Send HTTP request with full options
 * - healthCheck()  : Check backend connection status
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ApiResponse } from '@renderer/types/api';

// ─── Constants ──────────────────────────────────────────────────────────
const DEFAULT_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

// ─── Class ──────────────────────────────────────────────────────────────
class ApiService {
  // ...
}

// ─── Singleton ──────────────────────────────────────────────────────────
export const apiService = new ApiService();
```

### 5.2 UI Component

File: `src/renderer/src/modules/Code/components/FooterBar.tsx`

```tsx
/**
 * ------------------------------------------------------------------
 * FooterBar
 * ------------------------------------------------------------------
 * Status bar displayed at the bottom of the Code editor module.
 * Shows LSP status for the active file, including install prompts,
 * initialization progress, and connection state.
 *
 * Main features:
 * - Detects and displays the LSP server for the current file type
 * - Shows install prompt for detected but not installed LSP servers
 * - Displays real-time LSP initialization progress bar
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useEffect, useCallback } from 'react';

// ── UI ──
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

// ── Hooks ──
import { useCodeStore } from '../hooks/useCodeStore';

// ── Services ──
import {
  getLSPServer,
  isLSPInstalled,
  isLSPDismissed,
  type LSPServer,
} from '../services/lsp.service';

// ── Utils ──
import { cn } from '@renderer/shared/utils/cn';

// ─── Interfaces ─────────────────────────────────────────────────────────
interface FooterBarProps {
  className?: string;
}

interface LSPInitStatus {
  isInitializing: boolean;
  progress: number;
  currentFile: string | null;
  language: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────
export function FooterBar({ className }: FooterBarProps) {
  // ── State ──
  const [activeLSP, setActiveLSP] = useState<LSPServer | null>(null);
  const [pendingLSP, setPendingLSP] = useState(false);
  const [lspInitStatus, setLspInitStatus] = useState<LSPInitStatus>({...});

  // ── Store ──
  const projects = useCodeStore((s) => s.projects);
  const setForceShowLSPOverlay = useCodeStore((s) => s.setForceShowLSPOverlay);

  // ── Derived ──
  const project = projects.find((p) => p.id === currentProjectId);

  // ── Callbacks ──
  const checkLSP = useCallback(() => {...}, [activeFileTabId]);

  // ── Effects ──
  useEffect(() => {...}, [checkLSP]);
  useEffect(() => {...}, []);

  // ── Handlers ──
  const handleLSPClick = () => {...};

  // ── Render ──
  return <div>...</div>;
}
```

### 5.3 Custom Hook

```ts
/**
 * ------------------------------------------------------------------
 * useScanStatus
 * ------------------------------------------------------------------
 * Polls the backend for the current scan status and provides
 * real-time progress updates to the UI.
 *
 * Main features:
 * - Auto-polls every 2s while a scan is running
 * - Stops polling when scan completes or component unmounts
 * - Exposes progress percentage, current task, and ETA
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';

// ── Services ──
import { scanService } from '@renderer/services';

// ─── Types ──────────────────────────────────────────────────────────────
interface ScanStatus {
  progress: number;
  currentTask: string;
  eta: string;
  isRunning: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2000;

// ─── Hook ───────────────────────────────────────────────────────────────
export function useScanStatus(scanId: string | null): ScanStatus {
  // ── State ──
  const [status, setStatus] = useState<ScanStatus>({...});

  // ── Effects ──
  useEffect(() => {
    // ...
  }, [scanId]);

  return status;
}
```

### 5.4 Utility

```ts
/**
 * ------------------------------------------------------------------
 * Format Utilities
 * ------------------------------------------------------------------
 * Shared formatting helpers used across the renderer for dates,
 * file sizes, IP addresses, and other display values.
 *
 * Main functions:
 * - formatBytes()   : Convert byte count to human-readable string
 * - formatDate()    : Format ISO date string to locale display
 * - formatDuration(): Convert milliseconds to "Xh Ym Zs" format
 * ------------------------------------------------------------------
 */

// ─── Constants ──────────────────────────────────────────────────────────
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

// ─── Functions ──────────────────────────────────────────────────────────
export function formatBytes(bytes: number, decimals = 2): string {
  // ...
}

export function formatDate(isoString: string, locale = 'vi-VN'): string {
  // ...
}
```

### 5.5 Types

```ts
/**
 * ------------------------------------------------------------------
 * API Types
 * ------------------------------------------------------------------
 * Shared TypeScript type definitions for API request/response shapes.
 *
 * Main types:
 * - ApiResponse<T>    : Standard API response wrapper
 * - PaginatedResponse : Response with pagination metadata
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 5.6 Store

```ts
/**
 * ------------------------------------------------------------------
 * Target Store
 * ------------------------------------------------------------------
 * Zustand store for managing target list state across components.
 * Handles fetching, caching, selection, and optimistic updates.
 *
 * Main actions:
 * - fetchTargets()    : Load targets from backend
 * - selectTarget()    : Toggle selection for a single target
 * - deleteTargets()   : Delete selected targets with optimistic UI
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Store ──
import { create } from 'zustand';

// ── Services ──
import { targetService } from '@renderer/services';

// ── Types ──
import { Target } from '@renderer/types';

// ─── Interfaces ─────────────────────────────────────────────────────────
interface TargetState {
  targets: Target[];
  selected: Set<string>;
  loading: boolean;
}

interface TargetActions {
  fetchTargets: () => Promise<void>;
  selectTarget: (id: string) => void;
  deleteTargets: (ids: string[]) => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────────────
export const useTargetStore = create<TargetState & TargetActions>((set, get) => ({
  // ...
}));
```

---

## 6. Quick Reference

### Divider Levels

```
// ─── Top-Level Section ───     ← 3 dashes, for: Imports, Interfaces, Component, Class...
// ── Sub-Section ──             ← 2 dashes, for: import groups, State, Effects, Callbacks, Render...
```

### Import Group Order

```
// ── React ──        → react, react-dom
// ── UI ──           → lucide-react, radix-ui, custom UI libs
// ── Hooks ──        → custom hooks
// ── Services ──     → service modules
// ── Stores ──       → Zustand stores
// ── Utils ──        → cn, format, shared helpers
// ── Types ──        → type-only imports
```

### Component Internal Order

```
State → Store → Refs → Derived → Callbacks → Effects → Handlers → Render
```

---

## 7. Checklist

- [ ] **File header** exists with title, description, and main items list
- [ ] **Top-level sections** (`// ─── X ───`) group major code blocks
- [ ] **Import sub-groups** use `// ── X ──` format (not bare `// X`)
- [ ] **Sub-sections** (`// ── X ──`) organize logic inside components/hooks (State, Effects, Render...)
- [ ] **File header comment** is written in **Vietnamese** (comments inside code body may be in English or Vietnamese)