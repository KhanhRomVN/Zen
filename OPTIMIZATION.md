# Zen Extension — Phân Tích & Phương Án Tối Ưu Tài Nguyên

> Scan thực hiện: 2026-05-28. Liệt kê tất cả thứ chạy ngầm khi mở VSCode với extension Zen được kích hoạt.

---

## 1. Danh Sách Vấn Đề Hiện Tại

| # | Vấn đề | File | Tài nguyên | Khi nào chạy |
|---|--------|------|-----------|--------------|
| 1 | `ShikiService.initialize()` — load WASM + 24 langs + 5 themes vào RAM ngay lúc activate | `extension.ts:43` | CPU + ~30–60MB RAM | Mở VSCode (background) |
| 2 | `ProcessManager.restoreState()` — tự động restore **tất cả** terminal cũ, spawn `TerminalBridge.js` (Node.js process riêng) | `extension.ts:33` | RAM + 1 child process | Mở VSCode |
| 3 | `ProcessManager._stateInterval` — `setInterval` 1 giây gửi `list` qua socket | `ProcessManager.ts:544` | CPU polling | Khi có terminal |
| 4 | `TerminalBridge.js` `statusInterval` — `setInterval` 500ms đọc `/proc/<pid>/stat` mỗi terminal | `TerminalBridge.ts:248` | CPU + disk I/O | Khi có terminal |
| 5 | `startPingService()` — HTTP GET `google.com/generate_204` mỗi **10 giây** | `ChatController.ts:374` | Network I/O liên tục | Mở panel Zen |
| 6 | `onWillDeleteFiles` listener — đệ quy đọc toàn bộ file trong thư mục trước khi xóa (sync) | `extension.ts:120` | Disk I/O blocking | Mỗi lần xóa file/folder |
| 7 | `ContextManager` constructor — khởi tạo 4 analyzer objects ngay lập tức | `extension.ts:18` | RAM (eager allocation) | Mở VSCode |
| 8 | `createFileSystemWatcher` — watch toàn bộ `src/**` khi user bật Project Context | `ProjectContextHandler.ts:141` | File system events | Khi bật watch |
| 9 | `SmartContextProvider` constructor — khởi tạo 4 sub-analyzer (LSP, import graph, git, pattern) | `ContextManager.ts` | RAM | Mở VSCode |

---

## 2. Phương Án Tối Ưu

| # | Vấn đề | Phương án | Độ khó | Lợi ích |
|---|--------|-----------|--------|---------|
| 1 | ShikiService load sớm | **Lazy init**: chỉ gọi `initialize()` khi lần đầu cần highlight (trong `highlight()`), xóa pre-warm ở `extension.ts:43` | 🟢 Dễ | Tiết kiệm ~30–60MB RAM + CPU lúc startup |
| 2 | Auto-restore terminal | **Opt-in restore**: không tự restore khi activate, chỉ restore khi user mở panel Zen hoặc click nút "Restore terminals" | 🟢 Dễ | Không spawn child process khi không cần |
| 3 | Polling 1s ProcessManager | **Event-driven**: tăng interval lên 3–5s, hoặc chỉ poll khi có terminal đang `busy` | 🟢 Dễ | Giảm 3–5x CPU overhead |
| 4 | Polling 500ms TerminalBridge | **Adaptive polling**: 500ms khi có terminal busy, 2000ms khi tất cả idle | 🟢 Dễ | Giảm 4x disk I/O khi idle |
| 5 | Ping mỗi 10s | **Tăng interval lên 30s** hoặc **chỉ ping khi panel visible** (dùng `webviewView.onDidChangeVisibility`) | 🟢 Dễ | Giảm 3x network request |
| 6 | `onWillDeleteFiles` sync recursive read | **Async + giới hạn depth**: dùng `fs.promises` thay `fs.statSync`, giới hạn max 1000 files, bỏ qua `node_modules/.git` | 🟡 Trung bình | Tránh block UI thread khi xóa folder lớn |
| 7 | ContextManager eager init | **Lazy instantiation**: chỉ tạo analyzer khi `generateContext()` được gọi lần đầu | 🟡 Trung bình | Giảm RAM lúc startup |
| 8 | FileSystemWatcher quá rộng | Pattern hiện tại đã có debounce 2s — **thêm glob exclude** `node_modules,dist,build,.git` vào pattern | 🟢 Dễ | Giảm noise events |
| 9 | SmartContextProvider 4 analyzers | **Lazy init từng analyzer**: chỉ tạo khi được dùng lần đầu | 🟡 Trung bình | Giảm RAM startup |

---

## 3. Ưu Tiên Thực Hiện

### 🔴 Làm ngay (impact cao, effort thấp)

1. **#1 — Xóa pre-warm Shiki** (`extension.ts:43`): Xóa 3 dòng, tiết kiệm nhiều nhất.
2. **#5 — Ping interval**: Đổi 10s → 30s, thêm check `webviewView.visible`.
3. **#3 + #4 — Tăng polling interval**: ProcessManager 1s → 3s, TerminalBridge 500ms → adaptive.

### 🟡 Làm sau (cần refactor nhỏ)

4. **#2 — Opt-in terminal restore**: Chuyển `restoreState()` vào `resolveWebviewView`.
5. **#6 — Async file collection**: Thay `fs.statSync` bằng `fs.promises.stat` trong `onWillDeleteFiles`.

### 🟢 Nice-to-have

6. **#7 + #9 — Lazy ContextManager/SmartContextProvider**: Refactor constructor thành lazy getters.

---

## 4. Ước Tính Cải Thiện

| Metric | Hiện tại | Sau tối ưu |
|--------|----------|-----------|
| RAM lúc startup | ~80–120MB | ~40–60MB |
| Child processes khi idle | 1 (TerminalBridge) | 0 |
| Network requests/phút | 6 (ping) | 2 (ping) |
| CPU polling/giây | 3 ticks (1s + 500ms×2) | ~0.5 ticks khi idle |
| Block UI khi xóa folder | Có (sync) | Không (async) |

