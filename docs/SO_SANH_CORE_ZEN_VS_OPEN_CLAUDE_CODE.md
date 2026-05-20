# So sánh core: `Zen - AI Agent VSCode Extension` vs `temp/open-claude-code`

Tài liệu này tập trung vào “core” (kiến trúc, context, chat/session, tools/permissions, luồng agent) của 2 codebase:

- **Zen**: extension VSCode (TypeScript) + webview UI.
- **open-claude-code**: CLI agent (Node/ESM) với kiến trúc `v2/`.

## 1) Mục tiêu sản phẩm & “runtime”
### Zen
- **Runtime**: chạy trong **VSCode Extension Host** (Node.js) và **Webview** (React UI).
- **Trải nghiệm**: panel chat trong VSCode, tương tác qua `webview.postMessage` và command.
- **Core định hướng**: tích hợp sâu với workspace (file tree, tab đang mở, git changes), quản lý “project context” trong thư mục riêng ở home.

Gợi ý điểm vào:
- `src/extension.ts` (activate, wiring các manager/handler)
- `src/controllers/handlers/*.ts` (bridge webview ↔ extension)

### open-claude-code (v2)
- **Runtime**: CLI chạy trong terminal (Node.js ESM), vòng lặp agent + streaming + tools.
- **Trải nghiệm**: chat trong terminal, có commands như `/compact`, `/tokens`, `/clear`, `/model` (xem `temp/open-claude-code/README.md`).
- **Core định hướng**: “agent loop” tổng quát cho nhiều provider + tool calls + hooks + context window compaction.

Gợi ý điểm vào:
- `temp/open-claude-code/v2/src/index.mjs`
- `temp/open-claude-code/v2/src/core/agent-loop.mjs`

## 2) Context: tạo, quản lý và “giới hạn cửa sổ”

### Zen: tạo context theo “project/workspace”
**Module chính**:
- `src/context/ContextManager.ts`: điều phối việc tạo context.
- `src/context/ContextBuilder.ts`: format/đóng gói context string.
- `src/context/SmartContextProvider.ts` + các analyzer (`FileSystemAnalyzer`, `WorkspaceAnalyzer`, …): chọn file liên quan, thống kê line count, git changes, tab đang mở.

**Cách dùng** (mô hình):
- UI gửi `requestContext` → `src/controllers/handlers/ProjectContextHandler.ts` gọi `ContextManager.generateContext(task, isFirstRequest, projectContext)`.
- `isFirstRequest=true` thì Zen **chỉ** lấy “related files” ở lần đầu để tiết kiệm token.

**Điểm đáng chú ý**:
- Zen “context” là **một chuỗi** (string) tổng hợp rất giàu thông tin workspace (tree, file counts, git changes, open tabs, …).
- Zen có khái niệm `workspace.md` như “knowledge” theo project (xem phần 3).

### open-claude-code: Context Manager + auto-compaction theo token
**Module chính**:
- `temp/open-claude-code/v2/src/core/context-manager.mjs`: ước lượng token + micro-compact + full compact.
- `temp/open-claude-code/v2/src/core/agent-loop.mjs`: gọi `shouldCompact()`/`compact()` trước khi gọi model.

**Cách dùng** (mô hình):
- `ContextManager.addMessage(messages, msg)` tự động compact khi vượt ngưỡng.
- Compaction chiến lược:
  - **Micro-compaction**: cắt ngắn tool_result cũ (giữ tham chiếu, truncate nội dung).
  - **Full compaction**: tạo 1 “summary message” thay thế phần lịch sử cũ, giữ lại các message gần nhất.

**Điểm đáng chú ý**:
- Context là **mảng messages** (đúng format “chat messages”), có blocks (`text`, `thinking`, `tool_use`, `tool_result`…).
- Token count dùng heuristic theo ký tự (4 chars ~ 1 token) trong code hiện tại.

### Khác biệt cốt lõi về context
- Zen thiên về **workspace-aware prompt string** (đậm đặc metadata dự án) + tối ưu “lần đầu”.
- open-claude-code thiên về **context window manager** cho “chat messages” + **tự động compaction** khi gần đầy.

## 3) Chat / History / Session: lưu ở đâu, format gì, phạm vi nào?

### Zen: log theo project (workspace path hash) vào `~/khanhromvn-zen/`
**Module chính**:
- `src/controllers/handlers/ConversationHandler.ts`: đọc/ghi history, rename, rollback, xóa, lưu terminal output…
- `src/controllers/handlers/ProjectContextHandler.ts`: đọc `workspace.md` và trả về `treeView`, `rootPath`, `homedir`.

**Vị trí lưu**:
- `~/khanhromvn-zen/projects/<md5(workspacePath)>/`
  - `<conversationId>.json`: mảng log entries (messages)
  - `workspace.md`: “project knowledge”
  - `<chatUuid>/terminal_outputs/<outputUuid>.json`: output terminal theo chat

**Đặc điểm**:
- Tách bạch:
  - “Conversation/Chat log” (`*.json`)
  - “Project knowledge” (`workspace.md`)
  - “Terminal outputs” theo chat
- Có `FileLockManager` để tránh race khi ghi file.

### open-claude-code: session theo project vào `~/.claude/`
**Module chính**:
- `temp/open-claude-code/v2/src/core/session.mjs`: save/resume/teleport.

**Vị trí lưu**:
- `~/.claude/projects/<sha256(projectDir)[:16]>/session.json`

**Nội dung session**:
- `messages`, `systemPrompt`, `turnCount`, `tokenUsage`, `model`, metadata thời gian…
- Có “teleport” export/import session dạng base64 để chuyển máy.

### Khác biệt cốt lõi về chat/session
- Zen: lưu nhiều file “conversation logs” và artifacts theo chat, gắn chặt vào workspace VSCode.
- open-claude-code: session 1 file JSON, nhấn mạnh **resume/teleport** và tracking token usage.

## 4) Tools / Permissions / Hooks

### Zen: capabilities + permission validator (agent actions)
**Module chính**:
- `src/agent/AgentCapabilityManager.ts`: validate permissions rồi dispatch action (`read/edit/add/execute`).
- `src/controllers/handlers/AgentHandler.ts`: nhận message từ UI để update permissions / execute action.

**Mô hình**:
- UI → extension gửi `action` → validate (workspace-root scoped) → thực thi capability.
- Permission được update động qua handler.

### open-claude-code: tool system + permissions + hooks trong agent loop
**Module chính**:
- `temp/open-claude-code/v2/src/core/agent-loop.mjs`: khi có `tool_use`:
  - chạy `hooks` (pre/post, stop)
  - check `permissions.check(toolName, input)`
  - gọi `tools.call(toolName, input)`
  - append `tool_result` và **tiếp tục vòng lặp** (recursive continuation)

**Mô hình**:
- Tools là “first-class” trong message blocks; agent loop tự orchestrate.
- Hooks cho phép chặn tool, sửa result, hoặc ngăn agent “stop”.

### Khác biệt cốt lõi về tools
- Zen: tools/capabilities là API nội bộ extension, chủ yếu phục vụ UI và giới hạn theo workspace.
- open-claude-code: tools là hệ thống runtime “agentic loop”, có hooks + permission gate ngay trong vòng lặp.

## 5) Luồng xử lý tổng thể (end-to-end)

### Zen (VSCode)
1. Webview UI gửi message (chat/request context/agent action…)
2. Extension handler nhận message (`src/controllers/handlers/*`)
3. Tạo context (`src/context/*`) + gọi model (phần provider nằm ở các module khác trong repo)
4. Ghi log conversation (`ConversationHandler`) + cập nhật UI qua `webview.postMessage`

### open-claude-code (CLI)
1. Người dùng nhập prompt/command
2. `agent-loop` tạo system prompt, giữ state (`messages`, tokenUsage…)
3. Gọi provider (Anthropic/OpenAI/Google) + streaming
4. Nếu có tool calls: chạy hooks/permissions/tools, append tool_result và chạy tiếp
5. Save/resume session qua `SessionManager`

## 6) Bảng tóm tắt nhanh

| Chủ đề | Zen (VSCode extension) | open-claude-code (CLI v2) |
|---|---|---|
| “Context” | Tạo **string** giàu thông tin workspace | Quản lý **messages** + token threshold |
| Giới hạn context | Tối ưu theo “first request” + chọn file liên quan | Auto-compaction (micro + full) |
| Lưu chat/history | `~/khanhromvn-zen/projects/<md5>/...` nhiều file | `~/.claude/projects/<sha256>/session.json` |
| Knowledge theo project | `workspace.md` (read/update) | system prompt + session messages (không tách workspace.md theo kiểu Zen) |
| Tools & permissions | Capabilities (read/edit/add/execute) + validator | Tools/hook/permission gate trong agent loop |
| UI | Webview (React) trong VSCode | Terminal UI/CLI |

## 7) Gợi ý “mapping” nếu muốn học/port ý tưởng qua lại

- Nếu muốn Zen có “auto-compaction” như open-claude-code:
  - cân nhắc quản lý context ở cấp “messages array” + token counter + summarize/compact khi gần đầy (tương tự `context-manager.mjs`).
- Nếu muốn open-claude-code có “project knowledge” như Zen:
  - tách riêng một `workspace.md` (hoặc memory file) per project, có tool `read_workspace_context`/`update_workspace_context` kiểu Zen.

