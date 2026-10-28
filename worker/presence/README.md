# zen-presence

Cloudflare Worker (Durable Object + WebSocket) đếm số người đang online dùng Zen. Không có secret hay biến môi trường cần điền.

## Files cần có

- `worker.js`
- `wrangler.toml`

## Deploy lên một Cloudflare account

```bash
cd worker/presence

# Đăng xuất account cũ (bỏ qua nếu chưa đăng nhập)
npx wrangler logout

# Đăng nhập account muốn deploy
npx wrangler login

# Kiểm tra đang dùng đúng account
npx wrangler whoami

# Deploy (tự tạo Durable Object PresenceRoom, migration SQLite và binding PRESENCE)
npx wrangler deploy
```

Sau khi deploy, URL có dạng:

```
https://zen-presence.<subdomain-của-account>.workers.dev
```

## Lưu ý

- Nếu account có nhiều account con, wrangler sẽ hỏi chọn account khi deploy; hoặc thêm `account_id = "..."` vào `wrangler.toml`.
- Đổi account thì URL đổi theo, cần cập nhật endpoint tương ứng ở client.
- Không cần tạo binding thủ công trên dashboard; dropdown Durable Object ở dashboard chỉ liệt kê namespace đã được tạo bởi lần deploy này.

## Kiểm tra sau khi deploy

```bash
# Số người đang online
curl -s https://zen-presence.<subdomain>.workers.dev/
# -> {"online":0}

# WebSocket upgrade (phải dùng HTTP/1.1, kỳ vọng 101 Switching Protocols)
curl -s -i --http1.1 --max-time 5 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  https://zen-presence.<subdomain>.workers.dev/ | head -n 8
```

## Giao thức

- `GET /` (không upgrade): trả `{ "online": number }`.
- `GET /` với `Upgrade: websocket`: mở kết nối; mỗi khi có kết nối mở hoặc đóng, server đẩy `{ "online": number }` tới mọi client.
- Client gửi chuỗi `ping`, server tự trả `pong` (không đánh thức Durable Object).