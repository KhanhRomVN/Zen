# 🔴 Các điểm nghi ngờ gây Lag - Zen Project

> File này liệt kê các điểm nghi ngờ gây chậm/giật/lag do tiêu tốn CPU, RAM, Disk I/O.
> Dựa trên phân tích code ngày 2026-07-29.

---

## 2. RAM - Các điểm nghi ngờ gây chiếm RAM

### 2.1 ConversationCache — Cache không giới hạn

**File:** `src/webview-ui/src/features/chat/services/ConversationCache.ts` (2.5KB)

**Vấn đề:**
- Cache toàn bộ messages, toolOutputs, singleLineReviewActions trong memory.
- Không có cơ chế giới hạn kích thước cache (max entries) hoặc TTL.
- Khi chuyển qua lại giữa nhiều conversation, cache tích lũy không được dọn.

**Mức độ:** 🟠 Trung bình

### 2.2 parseCacheRef — Map parse result

**File:** `src/webview-ui/src/features/chat/components/ChatBody/index.tsx`

**Vấn đề:**
- `parseCacheRef` lưu `Map<string, ParsedResponse>` với key là `msg.content`.
- Không có cơ chế cleanup khi chuyển conversation.
- Mỗi entry chứa toàn bộ `ParsedResponse` (contentBlocks, actions, displayText...).

**Mức độ:** 🟡 Nhẹ — Map sẽ được GC khi component unmount.

### 2.3 Message objects — Chứa quá nhiều dữ liệu

**File:** `src/webview-ui/src/features/chat/types/message.ts` (2.8KB)

**Vấn đề:**
- Mỗi message object có thể chứa: `parsed` (toàn bộ ParsedResponse), `parseDebugInfo`, `rawRequest`, `rawResponse`, `thinking`, `uploadedFiles`, `attachedItems`, `questionAnswers`.
- Khi có 100+ messages trong một conversation, tổng dung lượng RAM có thể lên đến hàng MB.
- `messagesRef` và `messages` state lưu trùng lặp dữ liệu.

**Mức độ:** 🟠 Trung bình — Ảnh hưởng khi conversation dài.

### 2.4 materialIconMaps.ts — Map tĩnh 131.9KB

**File:** `src/webview-ui/src/utils/materialIconMaps.ts` (131.9KB)

**Vấn đề:**
- File chứa map icon khổng lồ (hàng nghìn icons) được import và giữ trong memory.
- Được bundle vào webview.js chính.

**Mức độ:** 🟡 Nhẹ — Map tĩnh, chỉ chiếm RAM 1 lần.

### 2.5 Webview bundle size — 1.3MB + 4.6MB map

**File:** `src/webview-ui/dist/webview.js` (1.3MB), `webview.js.map` (4.6MB)

**Vấn đề:**
- Bundle chính quá lớn, chứa tất cả component, icon, parser.
- Map file 4.6MB không cần thiết trong production.

**Mức độ:** 🟠 Trung bình — Ảnh hưởng thời gian tải ban đầu.

### 2.6 ReplaceInFileHistoryManager — Lưu toàn bộ lịch sử

**File:** `src/handlers/ReplaceInFileHistoryManager.ts` (14.6KB)

**Vấn đề:**
- Lưu toàn bộ lịch sử thay đổi file trong memory.
- Mỗi lần replace_in_file, thêm một entry mới.

**Mức độ:** 🟡 Nhẹ — Chỉ ảnh hưởng khi làm việc với nhiều file.

---

## 3. Disk I/O - Các điểm nghi ngờ gây I/O đĩa

### 3.1 ConversationService.saveConversation() — Gọi quá nhiều lần

**File:** `src/webview-ui/src/features/chat/services/ConversationService.ts` (7.3KB)

**Vấn đề:**
- Được gọi 3 lần trong một flow `sendMessage()`:
  1. Sau khi thêm user message vào state
  2. Sau khi nhận response và cập nhật state
  3. Sau khi parse response và cập nhật parsed data
- Mỗi lần gọi `storage.set()` (localStorage/Web Storage API) + `extensionService.postMessage` (ghi file JSON qua backend).
- Trong quá trình streaming, không nên save liên tục như vậy.

**Mức độ:** 🔴 Nghiêm trọng

### 3.2 logChatToWorkspace() — Log mỗi message

**File:** `src/webview-ui/src/features/chat/services/ConversationService.ts`

**Vấn đề:**
- Gọi 2 lần mỗi response (user message + assistant message).
- Gửi `extensionService.postMessage` để backend ghi log ra file.

**Mức độ:** 🟡 Nhẹ

### 3.3 Backend File Handlers

**File:** `src/handlers/tool/ReadFileHandler.ts` (5.2KB), `WriteToFileHandler.ts` (5.5KB), `ReplaceInFileHandler.ts` (11.7KB), `GrepHandler.ts` (10.2KB), `ListFilesHandler.ts` (4.2KB)

**Vấn đề:**
- Mỗi handler thực hiện I/O đĩa (đọc/ghi/tìm kiếm file).
- `GrepHandler` tìm kiếm regex trên nhiều file có thể gây I/O nặng.
- `ListFilesHandler` duyệt toàn bộ thư mục.

**Mức độ:** 🟡 Nhẹ — Đây là chức năng cần thiết, nhưng có thể tối ưu.

### 3.4 useConversationPersistence — Lưu định kỳ

**File:** `src/webview-ui/src/features/chat/hooks/persistence/useConversationPersistence.ts` (2.9KB)

**Vấn đề:**
- Hook lưu conversation vào localStorage định kỳ.
- Có thể gây I/O không cần thiết khi không có thay đổi.

**Mức độ:** 🟡 Nhẹ

---

## Tổng kết mức độ ưu tiên

| Mức độ | Số lượng | Mô tả |
|--------|----------|-------|
| 🔴 Nghiêm trọng | 3 | parseAIResponse, ChatBody parsedMessages, saveConversation |
| 🟠 Trung bình | 6 | QuestionBlock, TagRouter, sendMessage, StreamingService, ConversationCache, Message objects, Bundle size |
| 🟡 Nhẹ | 7 | useToolExecution, parseCacheRef, materialIconMaps, ReplaceInFileHistory, logChatToWorkspace, Backend handlers, useConversationPersistence |