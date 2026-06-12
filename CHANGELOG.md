# Changelog

All notable changes to the "Zen" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] - 2026-06-12

### ✨ Added
- **Qwen server-side conversation tree support (`parent_id`)**: Zen now captures `parent_id` from Qwen's SSE stream metadata after each response and automatically sends it as `parent_message_id` on the next request. This eliminates an extra server-side HTTP round-trip (previously ~200–500 ms latency) that was required to look up the current node in Qwen's tree-based message history. Context is preserved correctly across all follow-up turns without relying on the server fallback
- **Debug logging for model selection**: Key model lifecycle events are now logged to the browser console under the `[Zen]` prefix — `resetSession`, new session pin, model resolve, stream metadata accept/reject, and `initialMessageData` consumption. Filter by `[Zen]` in DevTools to trace model race conditions without code changes

### 🐛 Fixed
- **Model switch race condition when sending from HomePanel**: Multiple interacting race conditions caused the wrong model to be used after switching models in HomePanel
  1. **`lastUsedModelRef` was cleared too late**: `resetSession()` set `lastUsedModelRef = null` synchronously, but the effect that called `sendMessage` with the new model could run before `isApiUrlReady` resolved — leaving a window where another effect or stream callback could overwrite the ref with stale data. Fixed by pinning `model` and `account` from the caller into `lastUsedModelRef` / `lastUsedAccountRef` immediately when `isNewSession` is detected, before any async operations
  2. **Stream metadata silently overwrote user's model choice**: After req1 completed, the SSE stream returned `meta.providerId` / `meta.modelId` from the server. These were unconditionally written back to `lastUsedModelRef`, which could overwrite the newly selected model if the server echoed a different value (e.g. from a cached session). Fixed by only updating the ref when the server confirms the same model that was sent, or when the ref is empty
  3. **`initialMessageData` consumed with stale closure values**: The `useEffect` in `ChatPanel` that fires `sendMessage` when `initialMessageData` arrives captured `initialMessageData.model` through the closure. Capturing into an explicit local `const` before the call ensures the correct model reaches `sendMessage` synchronously regardless of React render timing
- **"Used model by account" badge shown on every Qwen message**: The metadata change detection in `MessageBox` included `conversationId` in its comparison. Qwen returns a new `conversation_id` in the SSE metadata of every response, causing `metaChanged = true` on every turn and re-rendering the badge repeatedly. Removed `conversationId` from the badge diff check — only `providerId`, `modelId`, `accountId`, and `email` now trigger a new badge, matching the behaviour of other providers

### 🔧 Improved
- **`resetSession` no longer pre-clears `lastUsedModelRef`**: Previously `resetSession()` set both model and account refs to `null`. This created a gap between the reset and the subsequent `sendMessage` call where tool-execution requests (which pass no model) could fail to resolve a model. The refs are now left untouched by `resetSession` and overwritten by `sendMessage` at the correct time (isNewSession pin or resolve phase)

---

## [1.4.8] - 2026-06-11

### 🐛 Fixed
- **Diff view no longer shows false diagnostics**: Files opened via the "UPDATE" button (snapshot diff view) now use a virtual `zen-diff://` URI scheme instead of writing temp `.ts`/`.tsx` files to disk. VSCode language servers (TypeScript, ESLint, etc.) do not run on virtual scheme documents, eliminating spurious errors in the Problems panel for files outside any `tsconfig.json`. Syntax highlighting is fully preserved

---

## [1.4.7] - 2026-06-10

### ✨ Added
- **3-mode permission system**: Replaced the previous 4-mode system (`bypassPermissions`, `acceptEdits`, `auto`, `plan`) with a simpler 3-mode model — **Full Access** (all tools auto), **Approval** (reads auto, everything else requires approval), **Read Only** (reads auto, writes and commands blocked). Old saved values auto-migrate on load
- **Permission mode injected into every AI request**: Every user-initiated request now includes a `<permission-mode>` tag containing the active mode and a description of all 3 modes. Auto/tool-flush requests receive a compact version with only the active mode name and category, keeping token usage minimal
- **Mode-switch detection in AI instructions**: The system prompt now instructs the AI to compare the current message's permission category (`action` vs `read-only`) with the previous message's category. If a switch from `action` → `read-only` is detected mid-task, the AI stops execution, notifies the user, and asks them to switch to a higher permission mode before continuing
- **New AI constraints added**: `SCOPE-LOCK` (only edit files directly related to the task), `READ-INTENT` (declare `READ-FOR-EDIT` vs `READ-FOR-CONTEXT` in thinking block), `CONVENTION-CHECK` (search for a similar file before creating new ones), `EDIT-SAFETY` (re-read file after 2 failed `replace_in_file` attempts), `COMMAND-FAILURE` (structured stderr triage), `PARTIAL-BATCH` (report partial success, fix failed ops independently)
- **3-pass thinking process**: Added **Pass 3 (Impact)** to the AI's thinking workflow — triggered only when a task affects more than 2 files. Checks for indirectly affected files, breaking changes, and whether tests or docs need updating

### 🔧 Improved
- **`GlobalPermissionButton` in chat footer updated**: Dropdown now shows the 3 new modes with updated icons (Zap / ShieldCheck / Eye) and correct i18n labels
- **`ToolSettingsDrawer` updated**: Settings drawer rebuilt with the 3-mode model and typed `PermissionMode` entries — eliminates previous TypeScript type mismatch errors

---

## [1.4.6] - 2026-06-10

### ✨ Added
- **`read_file` tool now shows line range in UI**: The file tool item displays `(start-end)` after the filename when a line range is requested. If no range is specified, shows `(1-N)` where N is the total line count of the file
- **Error message display for file tools**: When `replace_in_file`, `write_to_file`, `search_files`, `list_files`, `delete_file`, or `delete_folder` fail, the error message is now shown inline below the tool header in a red error box — previously only the dot color changed to red with no visible message
- **Auto-format document after file writes**: `write_to_file` and `replace_in_file` now trigger VSCode's built-in `editor.action.formatDocument` command after writing, then save the file. This respects the project's existing Prettier/ESLint formatter config. Formatting failures are silently ignored if no formatter is installed

### 🐛 Fixed
- **`replace_in_file` dedup incorrectly skipping sequential edits on the same file**: The DEDUP logic (designed to skip duplicate writes from DeepSeek stream resumption) used file path alone as the dedup key. This caused the first `replace_in_file` to be silently skipped when a single response contained two or more `replace_in_file` calls targeting the same file with different diffs (e.g., renaming `FunA → FunC` and `FunB → FunD`). Fixed by using `path + diff content` as the composite key — only truly identical diffs on the same file are now treated as duplicates
- **Race condition overwrite between concurrent `write_to_file` operations**: `handleReplaceInFile` already used `FileLockManager` to serialize writes, but `handleWriteFile` did not. Concurrent `write_to_file` calls on the same file could interleave their read-modify-write cycles. Fixed by wrapping the full write + checkpoint + snapshot block in `fileLockManager.acquire()` with `try/finally` release

### 🔧 Improved
- **Eliminated streaming UI jitter for long markdown responses**: Auto-scroll during streaming now uses `scrollIntoView({ behavior: "instant" })` instead of `"smooth"`. The previous smooth scroll conflicted with the continuously growing DOM height, causing the viewport to jump back and forth on every chunk. Manual scroll-to-bottom (via the button) retains smooth behavior. Auto-scroll is also throttled via `requestAnimationFrame` to one scroll per render frame
- **Persistent markdown parse cache across re-renders**: `ChatBody` now uses a `useRef`-backed parse cache instead of a per-render `Map`. Old messages are no longer re-parsed on every streaming chunk, reducing CPU load for long conversations
- **`MarkdownWithPaths` wrapped in `React.memo`**: Prevents markdown blocks from re-rendering when only unrelated props change during streaming. The expensive `marked.parse()` + DOM walk is skipped unless `content` or `knownFilePaths` size actually changes

---

## [1.4.5] - 2026-06-09

### 🐛 Fixed
- **Clicking "CREATE" file tool item no longer opens the file**: When a `write_to_file` tool creates a new file (no prior snapshot exists), clicking the file item in the timeline now opens the file directly instead of sending a `getSnapshot` request that would hang for 10 seconds before falling back. Fixed by detecting `!fileStatsMap[rawPath]` (file did not exist before the tool ran) and excluding these entries from `isSnapshotTool`
- **Auto-send request fired after clicking Stop during `run_command`**: When the X (stop) button was clicked while a `run_command` tool was still streaming output, the pending command resolver would still resolve once the process was killed, triggering an automatic tool-result flush back to the AI. This caused an unexpected request to be sent containing a partial command output. Fixed by introducing an `isStoppedRef` flag that is set to `true` on stop and checked before every auto-flush in `useToolExecution`. The flag resets to `false` on the next real user message

---

## [1.4.4] - 2026-06-08

### ✨ Added
- **Copy button on TerminalBlock command and output areas**: Each terminal tool block now shows a copy icon in the top-right corner of both the command header and the output area. The button is hidden by default and fades in on hover. Clicking copies the full text to the clipboard and briefly shows a green checkmark for 1.5 s
- **Scrollable output area in TerminalBlock**: The output wrapper now has `overflow-y: auto` with a visible 6 px scrollbar, allowing users to scroll through long command output without the block growing unbounded

### 🔧 Improved
- **Consistent text style across TerminalBlock command and output**: The command header now uses the same `font-family`, `font-size: 12px`, and `color: var(--vscode-terminal-foreground)` as the xterm output — previously the header used a smaller, dimmer `descriptionForeground` style
- **Collapsed TerminalBlock command text style fixed**: When a terminal tool block is in collapsed mode, the command preview text now matches the expanded style (`12px`, `terminal-foreground`) instead of the previous `11px` / `descriptionForeground` / `opacity: 0.8` which made it look faded and small
- **Stop button no longer reverts conversation history**: Clicking the X (stop) button in the chat input now only aborts the in-flight stream and marks the partial assistant message as cancelled. Previously it triggered a full `revertConversation` that deleted the current user turn and all prior tool-call turns back to the nearest user message, wiping potentially hundreds of req/res pairs from the UI
- **Cross-platform `run_command` execution**: `ProcessManager` now detects the host OS at runtime. On Windows it spawns `cmd.exe /d /s /c`, on macOS/Linux it uses `$SHELL -c` (falling back to `/bin/sh`). Kill signals also use OS-appropriate methods (`SIGTERM` on Unix, default `kill()` on Windows)
- **Cross-platform `search_files` tool**: Replaced the hardcoded `grep -rIlE` shell command with `rgPath` from `@vscode/ripgrep` (already bundled). Works identically on Windows, macOS, and Linux

### 🐛 Fixed
- **`toolOutputs` not restored when reopening a past conversation**: Two bugs caused terminal output to always appear empty (gray dot, no output) after switching away and back to a conversation
  1. `ConversationHandler.handleGetConversation` was returning only `{ messages, conversationId }` — it silently dropped `toolOutputs` and `backendConversationId` that were present in the stored JSON
  2. `saveConversation` in `ConversationService` correctly wrote `toolOutputs` to disk but did not include it when syncing to the in-memory `ConversationCache`, so cache-hit loads also lost the data
- **`ConversationService.saveConversation` syntax error**: A duplicate `metadata: {` key introduced by a previous edit caused a TypeScript parse error that broke the entire save path. Fixed by removing the extraneous nested key

### ⚙️ Configuration
- **First-chunk SSE timeout raised to 5 minutes**: Both the Elara server (`chat.controller.ts`) and the Zen client (`useChatLLM.ts`) now wait up to 5 minutes (300 s / 305 s with client buffer) before aborting a stream that has not produced its first chunk. The previous 30 s / 35 s limit was too aggressive for large prompts or slow upstream providers

---

## [1.4.2] - 2026-06-07

### 🐛 Fixed
- **Model/account selection now scoped per workspace**: Previously, selecting a model or account in HomePanel used a single global cache key (`zen-model-selection:global`), causing all open VSCode windows to share and overwrite each other's selection. HomePanel now reads `window.__zenWorkspaceFolderPath` (injected by `ZenChatViewProvider`) and passes it as `folderPath` to `ChatFooter`, so each workspace maintains its own independent model/account cache. Falls back to the global key when no workspace folder is open
- **Race condition in model/account cache loading**: The `isLoadingCache` flag was set to `false` immediately in a `finally` block even when the actual data load was still pending inside an async `storage.get()` call. This caused the UI to briefly appear ready before the cached selection was applied. Additionally, if `folderPath` changed (e.g., fast workspace switch) while a `storage.get()` was in-flight, the stale callback could overwrite the new workspace's selection. Both issues are fixed with a `cancelled` cleanup flag in the `useEffect` — stale callbacks are ignored and `isLoadingCache` is now only cleared after the async load fully resolves or rejects

---

## [1.4.1] - 2026-06-06

### ✨ Added
- **Context usage progress circle in ChatHeader**: A small SVG ring indicator now appears next to the token counter in the chat header. It fills up as the conversation grows relative to the model's average context limit. Color transitions from green → yellow → orange → red as usage increases (thresholds: 50%, 70%, 85%). Hover shows the exact percentage. Only visible for models with a defined `avg_context_limit`
- **`avg_context_limit` field in provider config**: New field added to all model definitions in `provider-config.ts`. Set to `100,000` for `deepseek-instant` and `deepseek-expert` (reflecting their practical context degradation point), `null` for all other models

### 🔧 Improved
- **Provider config data enriched into `currentModel`**: ChatPanel now fetches provider config from `/v1/providers` and merges the matching model entry (including `avg_context_limit`) into `currentModel` before passing it to ChatHeader. This allows the header to display model-specific metadata without changes to the message flow
- **Graceful PoW challenge failure handling**: DeepSeek's `create_pow_challenge` endpoint occasionally returns a truncated or empty response body (typically under rate limiting). The server now wraps the JSON parse step in a `try/catch` — if the challenge fails, the completion request proceeds without a PoW token and a warning is logged instead of crashing the stream. Applies to both chat and file upload flows
- **Improved PoW challenge diagnostic logging**: Added `DEBUG`-level logs for the raw challenge response status, body length, and preview. If the challenge body is missing or malformed, a descriptive `WARN` is emitted with context, making it easier to distinguish rate limiting from network drops

### 🐛 Fixed
- **`providers.find is not a function` crash on ChatPanel mount**: The `/v1/providers` response is wrapped in `{ success, data: [...] }`. The fetch in ChatPanel was passing the raw response object to `setProviders`, causing `.find()` to fail on the next render. Fixed by extracting `res.data` (with an `Array.isArray` guard as fallback)
- **`title` prop type error on SVG element**: React's `SVGProps<SVGSVGElement>` does not accept a `title` attribute directly. Replaced with an inline `<title>` child element inside the SVG, which is the correct SVG/accessibility pattern

---

## [1.3.8] - 2026-06-01

### ✨ Added
- **Ctrl+Z / Ctrl+Y undo-redo in MessageInput**: Both HomePanel and ChatPanel now support full undo/redo in the message textarea. Ctrl+Z steps back through typing history, Ctrl+Y and Ctrl+Shift+Z step forward. The undo stack is managed manually to work around React's controlled-input model which normally blocks native browser undo. Stack is reset on send and when an external `initialValue` is injected
- **Draft auto-save for HomePanel**: The HomePanel message input now persists its content across extension reloads, matching the existing draft behaviour in ChatPanel. Draft is saved under the key `draft:home` with a 500 ms debounce and is cleared on send. If a suggestion `initialValue` is provided it takes priority over the saved draft
- **Daily usage chart on HomePanel**: New `DailyUsageChart` component renders an SVG line chart of today's request activity broken down by hour (00h–23h). Future hours are dimmed with an overlay. Hovering shows a tooltip with request count and token count for that hour slot. Chart is responsive via `ResizeObserver` and adapts x-axis label density to the available width
- **Redesigned AI model distribution card**: Replaced the flat progress-bar list with a new `ModelDistributionCard` component featuring a donut chart (SVG arc segments), a two-column model legend with provider favicons, and an expand/collapse toggle when more than 4 models are present. Hovering an arc segment shows a tooltip with request count, token count, and percentage
- **Recent chats list expanded**: HomePanel now shows up to 10 recent conversations (previously 3)
- **Terminal input bar**: When a `run_command` tool block has an active `onInput` handler, a `TerminalInputBar` is now rendered below the xterm output. Users can type multi-line input (auto-resizes up to 3 lines) and submit with Enter, sending the text directly to the running process
- **Terminal cleanup on command finish**: After a `run_command` completes, the extension now automatically posts a `removeTerminal` message to clean up the terminal process, preventing resource leaks
- **`toolOutputs` persisted to disk**: Tool outputs are now included in the conversation save payload so they survive extension reloads and tab switches

### 🔧 Improved
- **File tree listing vs. content context split**: `FileSystemAnalyzer` now distinguishes between *listing* patterns (only system/build folders: `node_modules`, `.git`, `dist`, etc.) and *content* patterns (listing + media, binary, lock files). The workspace file picker shown to users uses listing-only filtering so image and log files are visible; AI context building uses the full filter. `getFileTree` accepts a `forListing` flag and passes `--no-ignore` to ripgrep when listing so `.gitignore`d files still appear in the picker
- **`isConversationStarted` includes pending initial message**: The ChatFooter model badge now hides correctly while a HomePanel message is in-flight (before the first assistant reply arrives), preventing a flash of the "Select Model" badge
- **`hasInitialMessage` guard on WelcomeUI**: The WelcomeUI splash screen is suppressed while an initial message from HomePanel is being processed, avoiding a brief flicker of the empty-state UI
- **Draft restore respects `initialValue`**: When `ChatFooter` restores a saved draft on mount, it skips the restore if an `initialValue` was explicitly provided (e.g. a clicked suggestion), so the suggestion always wins

### 🐛 Fixed
- **`toolOutputs` restored on conversation load**: When loading a saved conversation, `toolOutputs` from the persisted payload are now applied to state so tool result blocks render correctly after a reload
- **New chat tab resets conversation state**: `setCurrentConversationId("")` is now called synchronously when loading a tab with no existing `conversationId`, preventing stale IDs from leaking into the next session

---

## [1.3.7] - 2026-05-31

### ✨ Added
- **DeepSeek INCOMPLETE response auto-continuation**: DeepSeek truncates very long responses mid-stream with `quasi_status: "INCOMPLETE"`. The Elara server now automatically detects this signal and calls `POST /api/v0/chat/continue` to resume the stream seamlessly — up to 10 continuations per response. The full response is delivered to the client as a single uninterrupted stream
- **"Continuing long response…" indicator in Zen**: When the Elara server is auto-continuing a DeepSeek response, Zen now shows a subtle animated indicator (pulsing dot + text) above the processing spinner so users know the AI is still generating rather than stalled
- **`isContinuing` state in `useChatLLM`**: New boolean state exported from the hook, set to `true` while the server is fetching continuation chunks. Automatically reset on stream end, stop, error, or session reset

---

## [1.3.6] - 2026-05-31

### 🐛 Fixed
- **Missing first message box when sending from HomePanel a second time**: A chain of three bugs caused the first user message to disappear from the chat UI on subsequent HomePanel sends while the AI response still appeared correctly
  1. `hasProcessedInitial` ref was never reset between sessions — ChatPanel is kept alive with `display:none` so it never unmounts. Fixed by resetting the ref when `selectedTab.tabId` changes
  2. `currentConversationIdRef` still held the previous session's ID when the new `sendMessage` fired — React state updates are async so `setCurrentConversationId("")` was too late. Fixed by resetting the ref synchronously
  3. `messagesRef.current` still contained messages from the previous session — `sendMessage` used these as `filteredMessages`, making the request appear as a continuation (`messages: 3`) instead of a new session (`messages: 1`), which caused the first message box to be filtered out by the `isReq1` logic

### ✨ Added
- **`resetSession()` in `useChatLLM`**: New function that synchronously resets all session refs (`currentConversationIdRef`, `messagesRef`, `backendConversationIdRef`, `lastUsedModelRef`, `lastUsedAccountRef`) and all related states in one call. Used by ChatPanel on every tab change to guarantee a clean slate before `sendMessage` runs

---

## [1.3.5] - 2026-05-31

### 🐛 Fixed
- **`run_command` incorrectly blocked**: Removed the `command substitution` (`$(...)`) security rule from `SecurityValidator` — it was blocking valid commands like `echo $(pwd)` and `npm run build --prefix $(dirname $0)`. Genuinely dangerous patterns (pipe to shell, fork bomb, `rm -rf /`, etc.) are still enforced
- **Ghost send from HomePanel**: When sending a message from HomePanel, ChatPanel mounted and called `sendMessage` immediately before `apiUrl` finished loading from storage (async). If the backend wasn't running on the default port 8888, the request failed silently — the UI showed "Thinking... Xs" but nothing was sent to the server. Fixed by adding an `isApiUrlReady` flag; the message is now only sent after the storage promise resolves

### 🔧 Improved
- **Clearer permission mode labels** (Vietnamese UI): Renamed all 4 modes so users immediately understand which tools run automatically
  - `bypassPermissions`: "Cho phép toàn bộ" → **"Toàn quyền tự động"** (all tools run automatically)
  - `acceptEdits`: "Tự động sửa File" → **"Tự động trừ Terminal"** (reads + writes auto, only `run_command` requires approval)
  - `auto`: "Tự động Đọc file" → **"Chỉ tự động đọc"** (only reads auto, writes + commands require approval)
  - `plan`: "Chỉ đọc (Read Only Plan)" → **"Chỉ đọc (Chặn sửa)"** (reads auto, writes + commands are blocked)

---

## [1.3.4] - 2026-05-31

### 🐛 Fixed
- **Permission mode per-workspace**: Permission mode (Full Access / Auto Edits / Auto Reads / Read Only) and tool permissions are now independent per workspace. Previously all workspaces shared the same setting via global storage — now each workspace stores its own value using a workspace-scoped key prefix
- **Error message styling**: Error text in chat now uses normal foreground color and font size instead of the dimmed, small style inherited from tool subtitles

### ✨ Added
- **Error message i18n**: Common hardcoded error strings (e.g. "Provider returned empty response", "Search text not found", "Path is out of scope") are now translated via the i18n system. Vietnamese translations included for all 17 error keys under the new `errors.*` namespace

---

## [1.3.3] - 2026-05-28

### 🐛 Fixed
- **list_files**: Folders containing only media files (`.png`, `.jpg`, `.svg`, etc.) now return correct results instead of empty listings
- Separated listing ignore patterns from content ignore patterns — media/binary files are shown when listing but still excluded from AI context

### 🔧 Improved
- `FileSystemAnalyzer` now uses `shouldIgnoreForListing()` for directory traversal and `shouldIgnore()` for context building, giving more accurate results in both cases
- Ripgrep scan in listing mode uses `--no-ignore` to ensure all files are visible regardless of `.gitignore`

---

## [1.3.2] - 2026-05-14

### ✨ Added
- **Fuzzy Match Validation**: New `validateFuzzyMatch` handler to preview and confirm fuzzy replacements before applying them
- **Security Validator**: Introduced `SecurityValidator` to block path traversal and writes outside the workspace

### 🐛 Fixed
- `replace_in_file` no longer silently fails when search text contains regex special characters
- Fixed race condition in `FileLockManager` that could cause concurrent writes to corrupt files

### 🔧 Improved
- `LoggerService` now logs structured JSON for all file operations, making debugging easier
- Checkpoint creation is now skipped for files larger than 50 MB to avoid memory spikes

---

## [1.3.1] - 2026-04-30

### ✨ Added
- **Delete Folder Tool**: Agent can now delete entire directories with recursive checkpoint backup before removal
- **Add to Context** command in Explorer context menu — right-click any file to inject it into the current conversation context

### 🐛 Fixed
- History panel no longer shows duplicate entries after reloading the window
- Fixed `resolveWorkspacePathWithFallback` throwing unhandled rejection when both candidate paths fail

### 🔧 Improved
- Conversation cards in history now display total token count alongside request count
- Settings panel saves changes immediately on blur instead of requiring an explicit save button click

---

## [1.3.0] - 2026-04-10

### ✨ Added
- **Multi-provider Support**: Added Grok (xAI) and DeepSeek as built-in providers alongside OpenAI, Claude, and Gemini
- **Provider Icons**: Distinct SVG icons for each provider shown in the chat header and settings panel
- **Streaming Abort**: Users can now cancel an in-progress streaming response with a stop button
- **Read-only History Mode**: Loaded conversations are locked to prevent accidental edits

### 🐛 Fixed
- Gemini streaming responses were occasionally missing the final token — resolved by flushing the buffer on stream end
- Fixed settings panel not persisting API keys when switching providers rapidly

### 🔧 Improved
- WebSocket server now retries on a random port if the default port is already in use
- Reduced initial extension activation time by lazy-loading the file system analyzer

---

## [1.2.2] - 2026-03-18

### 🐛 Fixed
- `write_to_file` failed silently when the target directory did not exist — now creates parent directories automatically
- Checkpoint diff view showed incorrect line numbers for files with Windows-style line endings (`\r\n`)
- Fixed webview not reloading provider list after adding a new API key in settings

### 🔧 Improved
- `getFileLineCount` now skips binary files (`.exe`, `.bin`, `.wasm`, etc.) instead of returning garbled counts
- Improved error messages for `replace_in_file` when the search block is not found

---

## [1.2.1] - 2026-03-05

### ✨ Added
- **Checkpoint Revert Confirmation Dialog**: Added a confirmation prompt before reverting a file to a previous checkpoint state
- **Action ID Tracking**: Each checkpoint now stores the `actionId` of the tool call that created it, enabling smarter reactivation of tool buttons

### 🐛 Fixed
- Revert button was re-enabled after a successful revert, allowing double-revert — now correctly disabled after use
- Fixed diff icon color not updating when switching between VSCode light and dark themes

### 🔧 Improved
- Checkpoint dividers in chat are now collapsible to reduce visual clutter in long conversations
- `CheckpointManager` singleton now clears stale entries older than 24 hours on startup

---

## [1.2.0] - 2026-02-18

### ✨ Added
- **Checkpoint System**: Full file checkpoint infrastructure — every write and replace operation creates a restorable snapshot
- **Diff View Integration**: Click the diff icon (🗎) on any checkpoint to open VSCode's native diff editor comparing the checkpoint with the current file
- **Revert Button**: Click the revert icon (↶) to restore a file to its state at that checkpoint
- **Dual Icon Interface**: Checkpoint dividers show two distinct action icons with color-coded hover states
  - Diff icon: Blue hover (`#3b82f6`)
  - Revert icon: Orange hover (`#f59e0b`)
- **`bypassIgnore` Flag**: File operations now accept a `bypassIgnore` flag to access files normally excluded by `.gitignore` or pattern rules

### 🔧 Improved
- `buildFileTreeWithRg` now falls back to recursive `buildFileTree` when ripgrep is unavailable
- Context builder respects `.gitignore` via `git check-ignore` for more accurate workspace scoping

---

## [1.1.2] - 2026-01-28

### 🐛 Fixed
- `search_files` returned no results on Windows due to incorrect path separator in the grep command
- Fixed conversation auto-save not triggering when the webview was hidden in the background
- Agent capability checks were case-sensitive, causing some tool names to be incorrectly blocked

### 🔧 Improved
- `FuzzyMatcher` now normalizes line endings before comparison, reducing false negatives on cross-platform projects
- History panel loads conversations lazily — only fetches full content when a card is expanded

---

## [1.1.1] - 2026-01-14

### ✨ Added
- **Recent Files & Folders**: The file picker now surfaces recently accessed files and folders at the top of the list
- **`RecentItemsManager`**: New manager class that tracks the last 20 accessed files and folders per workspace

### 🐛 Fixed
- Fixed `list_files` returning an error for the workspace root when called with `.` as the path
- Settings panel crashed on first open if no providers were configured — now shows an empty state with a prompt to add a provider

### 🔧 Improved
- Workspace file cache TTL reduced from 10 minutes to 5 minutes for better freshness
- Extension now activates on `onStartupFinished` instead of `*` to avoid slowing down VSCode startup

---

## [1.1.0] - 2025-12-30

### ✨ Added
- **Agent Tool System**: Structured tool execution framework with `read_file`, `write_to_file`, `replace_in_file`, `list_files`, `search_files`, and `run_command`
- **Tool Permission Modes**: Three permission levels — `prompt` (ask each time), `auto` (allow read-only tools silently), and `plan` (allow reads, prompt for writes)
- **Streaming Response Parser**: Incremental XML-based parser that extracts tool calls from streaming AI output in real time
- **`run_command` Tool**: Agent can execute shell commands in the workspace terminal with output capture
- **Collapsible Tool Requests**: Tool invocation blocks in chat are collapsible to keep the conversation readable

### 🔧 Improved
- Replaced polling-based webview communication with event-driven message passing for lower latency
- `ContextManager` now batches file reads to reduce I/O overhead when building large contexts

### 🐛 Fixed
- Fixed markdown code blocks not rendering correctly when the language identifier contained uppercase letters

---

## [1.0.1] - 2025-12-15

### 🐛 Fixed
- Extension failed to activate on VSCode versions below 1.75 due to use of `vscode.workspace.fs.stat` — added compatibility shim
- WebSocket server port conflict on machines running multiple VSCode windows — now uses dynamic port allocation
- Chat panel lost scroll position after receiving a streaming response chunk

### 🔧 Improved
- Reduced extension bundle size by 18% by removing unused polyfills from the webpack output
- API key input fields in settings now use `password` type to prevent accidental exposure

---

## [1.0.0] - 2025-12-08

### 🎉 Initial Release

The first stable release of **Zen — Free AI Chat For ALL LLM** for Visual Studio Code.

### ✨ Added

#### Core Features
- **Multi-LLM Chat Interface**: Integrated AI chat panel in the VSCode sidebar with support for OpenAI, Claude, and Gemini
- **WebSocket Communication**: Real-time bidirectional communication between the extension host and webview
- **Context Management**: Intelligent workspace analysis and context building for AI interactions
- **Agent Capability System**: Extensible permission and capability management framework

#### Chat Panel
- **Streaming Responses**: Real-time token-by-token streaming with typing indicators
- **Code Syntax Highlighting**: Automatic syntax highlighting for code blocks using Shiki
- **Copy Code**: One-click copy button on every code block
- **Markdown Rendering**: Full markdown support including tables, lists, and inline code

#### File Operations
- **`read_file`**: Read and analyze any workspace file
- **`write_to_file`**: Create new files with AI-generated content
- **`replace_in_file`**: Smart diff-based content replacement with fuzzy matching fallback
- **`list_files`**: Browse directory structures
- **`search_files`**: Regex search across the workspace

#### Conversation Management
- **History Panel**: Browse and reload previous conversations
- **Conversation Cards**: Preview with provider badge, timestamps, and request count
- **New Chat**: Start fresh while preserving history
- **Auto-save**: Automatic persistence to VSCode global state

#### Settings Panel
- **Provider Configuration**: Add and manage AI providers and models
- **API Key Management**: Secure credential storage in VSCode settings
- **Context Configuration**: Adjust context window size and behavior

#### Developer Experience
- **Theme Awareness**: Automatic light/dark theme adaptation
- **Command Palette**: `Zen: Open Chat`, `Zen: New Chat`, `Zen: Open Settings`, `Zen: View History`
- **Activity Bar Icon**: Dedicated sidebar entry point
- **Error Handling**: User-friendly error messages for all failure modes

### 📦 Package Information
- **Publisher**: KhanhRomVN
- **License**: MIT
- **VSCode Engine**: ^1.50.0
- **Categories**: AI, Chat

---

For more information, visit: [https://github.com/KhanhRomVN/Zen](https://github.com/KhanhRomVN/Zen)
