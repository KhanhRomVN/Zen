# Implementation Tasks

## Task List

- [x] 1. Create SnapshotManager (Extension Host)
  - Create `src/utils/SnapshotManager.ts` as a singleton class
  - Implement `saveSnapshot(conversationId, actionId, filePath, operation, beforeContent, afterContent)` — writes `<snapshotsDir>/<actionId>.json`, silently ignores errors, skips ignored paths (`.git`, `khanhromvn-zen`, `node_modules`, `.vscode`)
  - Implement `getSnapshot(conversationId, actionId)` — reads and parses snapshot JSON, returns null if not found
  - Implement `getSnapshotsDir(conversationId)` — returns `~/khanhromvn-zen/projects/<md5hash>/<conversationId>/snapshots/`
  - **Requirements:** 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.4, 4.1, 4.2, 8.3

- [x] 2. Integrate SnapshotManager into FileHandler + add handleGetSnapshot
  - In `handleWriteFile`: read `beforeContent` before writing (when `fileExists`), call `SnapshotManager.saveSnapshot` after successful write if `conversationId` and `actionId` present
  - In `handleReplaceInFile`: call `SnapshotManager.saveSnapshot` after successful replace using existing `content` (before) and `newContent` (after) if `conversationId` and `actionId` present
  - Add `handleGetSnapshot(message, webviewView)` method — reads snapshot via SnapshotManager, posts `getSnapshotResult` with data or error
  - **Requirements:** 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.3

- [x] 3. Add getSnapshot routing in ChatController
  - Add `case "getSnapshot": await this.fileHandler.handleGetSnapshot(message, webviewView); break;` to the switch-case in `handleMessage()`
  - **Requirements:** 4.4

- [x] 4. Pass actionId in useToolExecution write/replace messages
  - In `write_to_file` case of `executeSingleAction`: add `actionId: action.actionId` to the `extensionService.postMessage` payload
  - In `replace_in_file` case of `executeSingleAction`: add `actionId: action.actionId` to the `extensionService.postMessage` payload
  - **Requirements:** 3.1, 3.2, 3.3

- [x] 5. Create DiffView component
  - Create `src/webview-ui/src/components/ChatPanel/ChatBody/components/ToolActions/DiffView.tsx`
  - Implement `computeUnifiedDiff(before, after, contextLines=3)` using LCS algorithm — returns `DiffLine[]` with types `"added" | "removed" | "context" | "separator"`
  - Render diff lines: removed lines in red (`--vscode-gitDecoration-deletedResourceForeground`) with `-` prefix, added lines in green (`--vscode-gitDecoration-addedResourceForeground`) with `+` prefix, context lines with space prefix
  - Header showing filename and `+X -Y` stats
  - `max-height: 400px`, `overflow-y: auto`, monospace font
  - **Requirements:** 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

- [x] 6. Create FullContentView component
  - Create `src/webview-ui/src/components/ChatPanel/ChatBody/components/ToolActions/FullContentView.tsx`
  - Implement `getLanguage(filePath)` mapping file extensions to language names
  - Render content with syntax highlighting (use existing `shiki` or fallback to plain `<pre>` with line numbers)
  - Line numbers in gutter
  - Header showing filename, total line count, and badge "CREATE" (if `beforeContent === null`) or "REWRITE" (if `beforeContent` is non-null)
  - `max-height: 400px`, `overflow-y: auto`
  - **Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5

- [x] 7. Create InlineViewer component
  - Create `src/webview-ui/src/components/ChatPanel/ChatBody/components/ToolActions/InlineViewer.tsx`
  - Props: `loading`, `error`, `snapshot`, `filePath`, `onOpenFile`
  - Render loading spinner when `loading === true`
  - Render error message + "Open in Editor" button when `error !== null`
  - Render `<FullContentView>` when `snapshot.operation === "write"`
  - Render `<DiffView>` when `snapshot.operation === "replace"`
  - **Requirements:** 5.3, 5.4, 5.5, 5.6

- [x] 8. Update FileToolItem to toggle InlineViewer on header click
  - Add `conversationId?: string` prop
  - Add state: `isViewerOpen`, `snapshotData`, `snapshotLoading`, `snapshotError`
  - Replace current `ToolHeader` onClick (which calls `openFile`) with `handleHeaderClick`: for `write_to_file`/`replace_in_file` when `isCompleted && !isPartial`, toggle `isViewerOpen` and lazy-load snapshot via `messageDispatcher`; for other tools keep existing `openFile` behavior
  - Render `<InlineViewer>` below `ToolHeader` when `isSnapshotTool && isViewerOpen`
  - **Requirements:** 5.1, 5.2, 5.3, 5.4, 5.7, 5.8

- [x] 9. Pass conversationId down to FileToolItem
  - Trace the prop chain from `ChatPanel/index.tsx` → `ChatBody` → `MessageBox` → `ToolActions/index.tsx` → `FileToolItem`
  - Pass `conversationId` (from `conversationIdRef.current` or equivalent) through each component in the chain
  - **Requirements:** 5.1, 5.2
