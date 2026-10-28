# AGENTS.md

## Dev environment tips
- Webview UI nằm ở `src/webview-ui` (React + webpack): build bằng `npm run build`, watch bằng `npm run watch`.
- Kiểm tra type: `cd src/webview-ui && npx tsc --noEmit -p .`.
- CSP của webview (`src/providers/ChatViewProvider.ts`) đã cho phép `https:` / `wss:` trong `connect-src`.

## Chatroom
- `src/webview-ui/src/features/chatroom` dùng Tencent Cloud Chat (`@tencentcloud/chat`), không còn mock data.
- Cấu hình (endpoint token, group id) ở `constants/config.ts`.
- Profile người dùng (userId, name, country) lưu qua `extensionService.getStorage()` với key `zen_chatroom_profile` (hook `useChatProfile`); chưa có profile thì `ProfileDrawer` hiện ra trước khi vào phòng.
- `userSig` lấy từ Cloudflare Worker `worker/trtc/worker.js` (POST `{ userId }`); `TRTC_SDK_APP_ID` và `TRTC_SDK_SECRET_KEY` đặt ở đầu file, điền lúc deploy, không commit secret.
- Số người online dùng Cloudflare Durable Object riêng ở `worker/presence/` (`worker.js` + `wrangler.toml`, deploy bằng `npx wrangler deploy` trong thư mục đó): client mở WebSocket tới worker, server đẩy `{ online: number }`; GET thường trả `{ online }`.