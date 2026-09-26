# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của Zen Extension.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.khanhromvn-zen/`

Zen Extension sử dụng:
- **File System** — Project conversation history, custom LSP packages

---

## 📁 File System

### Project Conversation History

**Path:** `~/.khanhromvn-zen/projects/{projectHash}/`

Mỗi project có một folder riêng, hash MD5 từ workspace path (tính bởi `PathService`).

#### Cấu trúc thư mục

```
~/.khanhromvn-zen/
├── projects/
│   └── {projectHash}/                          ← hash MD5 của workspace path
│       └── {conversationId}/                   ← folder riêng cho mỗi conversation
│           ├── {conversationId}.json           ← file JSON chứa toàn bộ dữ liệu conversation
│           ├── checkpoints/                    ← snapshot file trước khi bị sửa/xóa
│           │   └── ckpt_{ts}_{hex}.json
│           └── replace_history/                ← lịch sử từng lần replace_in_file thành công
│               └── {fileHash}_v{n}.json
└── lsp/
    ├── typescript-language-server/
    ├── pyright/
    ├── rust-analyzer/
    ├── gopls/
    └── ...
```

> **Migration:** Các file `.json` cũ (nằm thẳng trong `{projectHash}/`) được tự động migrate sang cấu trúc mới khi mở History panel (`migrateAllConversationsInDir`) hoặc khi truy cập lazy từng conversation (`migrateConversationIfNeeded`). Backward-compatible hoàn toàn.

---

### `{conversationId}.json` — Dữ liệu chính

Được lưu bởi `SaveConversationStateHandler` (debounce 1s, chỉ ghi khi có thay đổi).

```jsonc
{
  "messages": [
    {
      "id": "uuid",
      "role": "user" | "assistant",
      "content": "...",
      "timestamp": 1700000000000,
      "modelId": "gpt-4o",
      "providerId": "chatgpt",
      "token_usage": 1234,
      "rawRequest": "...",       // chỉ có ở user message
      "uploadedFiles": [],       // files đính kèm
      "providerFid": "...",      // Qwen provider message ID (nếu có)
      "providerParentId": "..."  // Qwen parent message ID (nếu có)
    }
  ],
  "backendConversationId": "...",   // ID phía server (Qwen, v.v.)
  "metadata": {
    "id": "conversationId",
    "title": "Tên cuộc trò chuyện",
    "createdAt": 1700000000000,
    "lastModified": 1700000000000,
    "totalRequests": 5,
    "totalTokenUsage": 12000,
    "tabId": 1,
    "folderPath": null | "/path/to/folder",
    "diagnosticEnabled": true,
    "useSkillEnabled": false
  },
  "toolOutputs": {
    "{messageId}-action-{idx}": { "output": "...", "isError": false }
  },
  "singleLineReviewActions": {},
  "conversationFileStats": {}
}
```

**Giới hạn:** Tối đa **30 file JSON** per project. `GetHistoryHandler.enforceHistoryLimit()` tự động xóa file cũ nhất khi vượt ngưỡng (cùng với folder conversation tương ứng).

---

### `checkpoints/` — Snapshot file trước khi thay đổi

Được tạo bởi `CheckpointManager` trước mỗi thao tác `create_file`, `write_to_file`, `replace_in_file`, `delete_file`.

**Path:** `~/.khanhromvn-zen/projects/{projectHash}/{conversationId}/checkpoints/`

**File name pattern:** `ckpt_{timestamp}_{4hex}.json`

```jsonc
{
  "id": "ckpt_1700000000000_ab12cd34",
  "type": "create" | "modify" | "delete",
  "filePath": "/absolute/path/to/file.ts",
  "content": "nội dung file trước khi thay đổi (null nếu type=create)",
  "timestamp": 1700000000000
}
```

**Giới hạn:**
- Bỏ qua files > 10MB
- Bỏ qua `.git/`, `node_modules/`, `.khanhromvn-zen/`, `.vscode/`
- Chỉ hoạt động khi `FeatureSettingsService.checkpointEnabled = true`

**Dùng để revert:** `CheckpointManager.revertToCheckpoint(conversationId, revertTimestamp)` — xóa tất cả checkpoints có `timestamp > revertTimestamp`, khôi phục file theo thứ tự ngược (mới nhất trước).

---

### `replace_history/` — Lịch sử replace_in_file

Được tạo bởi `ReplaceInFileHistoryManager` sau mỗi lần `replace_in_file` thành công.

**Path:** `~/.khanhromvn-zen/projects/{projectHash}/{conversationId}/replace_history/`

**File name pattern:** `{fileHash}_v{version}.json`
- `fileHash` = 8 ký tự đầu của MD5(filePath)
- `version` = số nguyên tăng dần, bắt đầu từ `0` (baseline) rồi `1`, `2`, ...

```jsonc
{
  "id": "replace_1700000000000_ab12cd34",
  "filePath": "/absolute/path/to/file.ts",
  "version": 1,
  "fullContent": "toàn bộ nội dung file sau khi replace",
  "errorCount": 0,
  "warningCount": 2,
  "lineCount": 145,
  "timestamp": 1700000000000,
  "messageId": "msg-uuid",
  "messageTimestamp": 1700000000000,
  "responseNumber": 3     // response thứ mấy trong conversation (1-based)
}
```

**Version 0 (baseline):** Tự động tạo khi replace lần đầu, lưu nội dung gốc của file trước khi bất kỳ thay đổi nào xảy ra.

**Revert theo message:** Khi người dùng revert một message, gọi `deleteVersionsFromResponseNumber()` hoặc `deleteVersionsFromTimestamp()` để xóa tất cả versions liên quan đến message đó trở đi.

---

### Custom LSP Storage

**Path:** `~/.khanhromvn-zen/lsp/{packageName}/`

Mỗi LSP package được cài đặt vào folder riêng:

- `~/.khanhromvn-zen/lsp/typescript-language-server/` — TypeScript/JavaScript LSP
- `~/.khanhromvn-zen/lsp/pyright/` — Python LSP
- `~/.khanhromvn-zen/lsp/rust-analyzer/` — Rust LSP
- `~/.khanhromvn-zen/lsp/gopls/` — Go LSP

> **Lưu ý:** Khi `zen_use_custom_lsp = true`, extension tự động cài đặt LSP packages khi detect file type chưa có LSP.

---

## 🔄 Luồng dữ liệu

```
User gửi message
  └─→ SaveConversationStateHandler (debounce 1s)
        └─→ {conversationId}.json (ghi toàn bộ messages + metadata)

AI thực hiện replace_in_file
  ├─→ CheckpointManager.createCheckpoint()
  │     └─→ checkpoints/ckpt_{ts}_{hex}.json
  └─→ ReplaceInFileHistoryManager.saveHistory()
        └─→ replace_history/{fileHash}_v{n}.json

User revert message
  ├─→ CheckpointManager.revertToCheckpoint()    (khôi phục files)
  └─→ ReplaceInFileHistoryManager.deleteVersionsFromResponseNumber()  (dọn history)

User xem history
  └─→ GetHistoryHandler.handleGetHistory()
        ├─→ Đọc {conversationId}.json → lấy metadata.title
        └─→ enforceHistoryLimit() → giữ tối đa 30 conversations
```

---

## 🔒 Security

### File Permissions

```bash
chmod 700 ~/.khanhromvn-zen
chmod 755 ~/.khanhromvn-zen/lsp
chmod 755 ~/.khanhromvn-zen/projects
```

### Backup

```bash
# Backup toàn bộ (bao gồm conversations + LSP packages)
tar -czf zen-backup-$(date +%Y%m%d).tar.gz ~/.khanhromvn-zen/

# Backup chỉ conversations
tar -czf zen-conversations-$(date +%Y%m%d).tar.gz ~/.khanhromvn-zen/projects/

# Restore
tar -xzf zen-backup-20240101.tar.gz -C ~/
```

---

## 📖 Related

- [`README.md`](./README.md) — Project overview
- [`package.json`](./package.json) — Extension manifest
- [`src/services/PathService.ts`](./src/services/PathService.ts) — Path computation
- [`src/managers/CheckpointManager.ts`](./src/managers/CheckpointManager.ts) — Checkpoint logic
- [`src/managers/ReplaceInFileHistoryManager.ts`](./src/managers/ReplaceInFileHistoryManager.ts) — Replace history logic
- [`src/handlers/conversation/SaveConversationStateHandler.ts`](./src/handlers/conversation/SaveConversationStateHandler.ts) — Save logic
- [`src/handlers/conversation/GetHistoryHandler.ts`](./src/handlers/conversation/GetHistoryHandler.ts) — History listing
