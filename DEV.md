# DEV — Hướng dẫn chạy Zen Extension trong môi trường phát triển

Tài liệu này hướng dẫn bạn chạy thử Zen trong **Extension Development Host** của VSCode, với workflow dev gọn nhất: **chỉ cần 1 terminal** để watch build, và **Run & Debug** để chạy Extension Host.

## 0) Yêu cầu trước khi chạy

- Node.js + npm (khuyến nghị Node 20+).
- VSCode bản có hỗ trợ debug extension (thường là VSCode desktop).

Cài dependency một lần:

```bash
npm install
```

## 1) Chạy chế độ dev (1 terminal)

### Terminal — watch build (EXT + Webview UI + dọn DTS)

Chạy:

```bash
npm run watch
```

`npm run watch` sẽ chạy đồng thời:
- `watch:extension` (webpack --watch)
- `watch:webview` (watch UI trong `src/webview-ui`)
- `bash remove-dts-files.sh watch` (dọn các `*.d.ts`/`*.d.ts.map` sinh ra trong UI)

## 2) Chạy Extension Host (Run & Debug)

Trong VSCode:

1. Mở tab **Run & Debug**
2. Chọn cấu hình **`Run Zen Extension`**
3. Nhấn **Start Debugging (F5)**

Khi chạy, VSCode sẽ mở một cửa sổ mới: **Extension Development Host**. Zen sẽ xuất hiện ở Activity Bar (sidebar).

Ghi chú về cấu hình debug:
- File: `.vscode/launch.json`
- `preLaunchTask` hiện là `npm: compile` (chạy build một lần trước khi debug).
  - Nếu bạn đang dùng watch ở Terminal 1, bạn vẫn có thể giữ preLaunchTask (an toàn), hoặc chỉnh lại nếu muốn tối ưu (tuỳ nhu cầu).

## 3) Reload tối ưu khi sửa code

Trong quá trình dev, “reload tối ưu” phụ thuộc vào bạn sửa phần nào:

### 3.1 Sửa code extension backend (TypeScript trong `src/`, ví dụ `src/extension.ts`, `src/controllers/*`)

Bạn cần **reload Extension Host** để nạp lại `dist/extension.js`.

Cách nhanh:
- Trong cửa sổ **Extension Development Host**:
  - Mở Command Palette → chạy `Developer: Reload Window`

Nếu chỉ muốn “restart extension host” theo kiểu debug:
- Dừng debug rồi chạy lại (chậm hơn nhưng chắc chắn).

### 3.2 Sửa UI Webview (React trong `src/webview-ui/src/*`)

Thông thường watch UI sẽ rebuild bundle `src/webview-ui/dist/webview.js`. Để UI load lại bundle mới, bạn có các cách:

- Cách nhanh nhất: **Reload Window** trong Extension Development Host (`Developer: Reload Window`).
- Cách nhẹ hơn (tuỳ tình trạng):
  - Đóng tab/view Zen (ẩn view) rồi mở lại Zen ở Activity Bar để webview được khởi tạo lại.

Nếu bạn thấy UI vẫn “cache” nội dung cũ:
- Dùng `Developer: Reload Window` là chắc chắn nhất.

### 3.3 Sửa CSS/asset (images/media) hoặc CSP/HTML webview

Các thay đổi về HTML/CSP/asset resolve thường cần:
- `Developer: Reload Window` trong Extension Development Host.

## 4) Một số mẹo dev hữu ích

- Log backend:
  - Trong VSCode (cửa sổ chính hoặc Extension Host) → Output panel → chọn kênh log phù hợp (Extension Host / Debug Console).
- Khi UI không nhận message:
  - Kiểm tra `webview.onDidReceiveMessage` trong `src/providers/ZenChatViewProvider.ts`.
  - Kiểm tra router `command` trong `src/controllers/ChatController.ts`.
- Khi file ops/terminal không chạy:
  - Kiểm tra permissions của agent (mặc định deny-all) và luồng `updateAgentPermissions` / `executeAgentAction`.

## 5) Lệnh nhanh (tóm tắt)

```bash
# Cài dependency
npm install

# Watch dev (extension + webview + dọn d.ts)
npm run watch
```
