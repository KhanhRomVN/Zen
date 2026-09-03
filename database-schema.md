# Schema File Conversation History

Tài liệu mô tả cấu trúc file `<conversationId>.json` lưu trạng thái conversation trong Zen Extension.

---

## File: `<conversationId>.json`

File lưu trạng thái của một conversation trong Zen Extension, nằm tại:
`~/.khanhromvn-zen/projects/{projectHash}/{conversationId}.json`

### Cấu trúc tổng quát

```json
{
  "messages": [...],
  "backendConversationId": "uuid",
  "metadata": { ... },
  "toolOutputs": { ... },
  "singleLineReviewActions": { ... },
  "conversationFileStats": { ... }
}
```

Các field `toolOutputs`, `singleLineReviewActions`, `conversationFileStats` chỉ xuất hiện khi có dữ liệu tương ứng.

### `messages`

Mảng các message. Mỗi message thuộc một trong ba loại: `user`, `assistant`, hoặc kết quả tool (role `user`, có `uiHidden`).

#### Field chung

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | string | ID duy nhất của message |
| `role` | string | `user` hoặc `assistant` |
| `content` | string | Nội dung message |
| `timestamp` | number | Thời gian (ms since epoch) — thường có ở assistant message |

#### Message `user` (yêu cầu người dùng)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `providerId` | string | Provider được chọn (VD: `deepseek`) |
| `modelId` | string | Model được chọn (VD: `deepseek-expert`) |
| `accountId` | string | UUID của tài khoản |
| `websiteUrl` | string | URL website của provider |
| `email` | string | Email tài khoản |

#### Message `assistant` (phản hồi từ AI)

Ngoài field chung, còn có:

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `conversationId` | string | ID của conversation |
| `response_message_id` | number | ID phản hồi |
| `token_usage` | number | Số token đã sử dụng |
| `rawResponse` | string | Phản hồi gốc từ provider |
| `parsed` | object | Kết quả parse: `actions`, `contentBlocks`, `displayText`, `question`, ... |
| `parseDebugInfo` | object | Thông tin debug quá trình parse |

#### Message kết quả tool

Role `user`, ẩn khỏi UI (`uiHidden: true`).

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `actionIds` | array | ID các action tương ứng |
| `uiHidden` | boolean | Luôn `true` cho tool result |
| `rawRequest` | string | Yêu cầu gốc gửi tới tool |

### `metadata`

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | string | ID lưu trữ: `zen-chat:{sessionId}:{folderPath}:{conversationId}` |
| `sessionId` | number | Session ID (timestamp ms) |
| `folderPath` | string | Đường dẫn workspace |
| `title` | string | Tiêu đề conversation |
| `lastModified` | number | Thời gian sửa cuối (ms) |
| `messageCount` | number | Tổng số message |
| `createdAt` | number | Thời gian tạo (ms) |
| `totalRequests` | number | Tổng số request |
| `totalTokenUsage` | number | Tổng token đã dùng |