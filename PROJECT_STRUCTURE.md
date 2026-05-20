# Cấu trúc dự án Zen (VSCode Extension)

Tài liệu này mô tả nhanh **cấu trúc thư mục/file** trong repo Zen và vai trò của từng phần để bạn định vị code dễ hơn.

## 1) Ở mức repo root

- `package.json`
  - Khai báo extension metadata (activation, contributes, commands…).
  - Scripts build/watch: `compile`, `watch`, `watch:extension`, `watch:webview`, `package`…
- `webpack.config.js`
  - Build phần extension backend → `dist/extension.js`.
- `tsconfig*.json`
  - `tsconfig.json`: cấu hình TS chính.
  - `tsconfig.extension.json`: cho extension.
  - `tsconfig.test.json`: cho test.
- `.vscode/launch.json`
  - Cấu hình debug: `Run Zen Extension` (Extension Host).
- `.vscode/tasks.json`
  - Các task (ví dụ npm compile) phục vụ preLaunch.
- `remove-dts-files.sh`
  - Script xoá các file `*.d.ts`/`*.d.ts.map` sinh ra trong `src/webview-ui/src` (có chế độ `watch`).
- `README.md`, `CHANGELOG.md`, `LICENSE`
  - Tài liệu dự án.
- `images/`, `media/`
  - Asset icon/ảnh cho extension và webview.
- `dist/` (không thấy trong listing nhưng thường sẽ được tạo)
  - Output build của extension backend.

## 2) Thư mục `src/` (code chính)

### 2.1 Entry point & wiring

- `src/extension.ts`
  - Điểm vào `activate()`: khởi tạo storage/context/services, tạo `ZenChatViewProvider`, đăng ký commands.
- `src/providers/ZenChatViewProvider.ts`
  - Cung cấp Webview View (sidebar), dựng HTML webview, tạo `ChatController`, bridge message UI ↔ backend.
- `src/controllers/ChatController.ts`
  - Router `command` từ UI sang các handler: file, terminal, backup, context, agent, diagnostics…

### 2.2 Nhóm “manager/service” (hạ tầng)

- `src/managers/`
  - Các “dịch vụ nền”: quản lý terminal/process, backup/checkpoint, file lock…
- `src/services/`
  - Service dùng chung (ví dụ highlight với Shiki).
- `src/storage-manager.ts`
  - Lưu trữ bằng `globalStorage`/migrate (tuỳ implementation).

### 2.3 Nhóm “context” (ngữ cảnh dự án)

- `src/context/`
  - `ContextManager`: gom/chuẩn hoá context cho chat.
  - `ProjectStructureManager`: cây thư mục + blacklist + watch (để build project context).
  - Các manager “phụ trợ” khác (vd Recent items…).

### 2.4 Nhóm “agent” (capability/permission)

- `src/agent/`
  - Quản lý quyền của agent (read file, edit file, chạy lệnh…) + thực thi action theo policy.

### 2.5 Nhóm “controllers/handlers” (router theo command)

- `src/controllers/handlers/`
  - Mỗi handler phụ trách 1 nhóm command:
    - Conversation: lịch sử, log, load conversation…
    - File: read/write/replace/list/search…
    - Terminal: run/stop/list terminals…
    - Backup: snapshot/diff/revert…
    - System: theme, open file, open diff, external…
    - Project context: get project context, watch…
    - Agent: update permissions, execute action…

## 3) Thư mục `src/webview-ui/` (giao diện React)

Đây là UI chạy trong webview:

- `src/webview-ui/src/`
  - Source React/TS: components, services, state…
- `src/webview-ui/dist/`
  - Bundle build output cho webview (ví dụ `webview.js`) — được load từ backend webview HTML.
- `src/webview-ui/package.json`
  - Script build/watch của UI (được gọi từ root scripts như `watch:webview`).

## 4) Thư mục test

- `test/`
  - Test cho extension (tuỳ cấu hình).

## 5) “Đường đi” build/watch (tóm tắt)

- Extension backend: `webpack.config.js` → `dist/extension.js`
- Webview UI: `src/webview-ui` build/watch → `src/webview-ui/dist/webview.js`
- Dọn `*.d.ts` do UI sinh ra: `bash remove-dts-files.sh` hoặc `bash remove-dts-files.sh watch`

---

Gợi ý đọc code theo thứ tự để hiểu flow nhanh:
1) `src/extension.ts` → 2) `src/providers/ZenChatViewProvider.ts` → 3) `src/controllers/ChatController.ts` → 4) `src/controllers/handlers/*` → 5) `src/webview-ui/src/*`

