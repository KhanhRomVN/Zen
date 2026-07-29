# 🟢 Đề xuất tối ưu hiệu năng - Zen Project

> File này liệt kê các ý kiến tối ưu để giảm lag, tiết kiệm CPU, RAM, Disk I/O.
> Dựa trên phân tích code ngày 2026-07-29.

---

## 1. Tối ưu CPU

### 1.1 🥇 Chuyển parseAIResponse() sang Web Worker

**Mục tiêu:** Không block main thread khi parse response.

**Cách làm:**
- Tạo file `src/webview-ui/src/features/chat/services/ResponseParser.worker.ts`.
- Chuyển toàn bộ logic `parseAIResponse()` vào Web Worker.
- Giao tiếp qua `postMessage`, main thread chỉ nhận kết quả cuối cùng.

**Lợi ích:** Loại bỏ hoàn toàn CPU block trên main thread khi parse message lớn.
**Rủi ro:** Cần xử lý async, có độ trễ nhỏ khi gửi/nhận message qua worker.

### 1.2 🥇 Dùng message ID làm cache key thay vì content

**File:** `src/webview-ui/src/features/chat/components/ChatBody/index.tsx`

**Hiện tại:**
```typescript
const cache = parseCacheRef.current;
const cached = cache.get(msg.content); // ❌ Cache miss khi streaming
```

**Đề xuất:**
```typescript
const cached = cache.get(msg.id); // ✅ Cache hit ngay cả khi streaming
// Chỉ re-parse khi msg.id thay đổi (message mới) hoặc content thay đổi
```

**Lợi ích:** Giảm 90% số lần parse lại trong quá trình streaming.

### 1.3 🥇 Tăng FLUSH_INTERVAL_MS trong StreamingService

**File:** `src/webview-ui/src/features/chat/services/StreamingService.ts`

**Hiện tại:** `FLUSH_INTERVAL_MS = 8` (~125fps)
**Đề xuất:** `FLUSH_INTERVAL_MS = 16` (~60fps) hoặc `32` (~30fps)

**Lợi ích:** Giảm 50-75% số lần re-render khi streaming.

### 1.4 🥈 Dùng requestAnimationFrame thay vì setInterval để flush

**File:** `src/webview-ui/src/features/chat/services/StreamingService.ts`

**Đề xuất:** Thay vì kiểm tra `Date.now() - lastFlushTime >= FLUSH_INTERVAL_MS`, dùng `requestAnimationFrame` để flush đồng bộ với refresh rate màn hình.

```typescript
let rafId: number | null = null;
const scheduleFlush = () => {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      // flush batch
      rafId = null;
    });
  }
};
```

**Lợi ích:** Tránh re-render không cần thiết giữa các frame.

### 1.5 🥈 Tách QuestionBlock.tsx thành các component nhỏ

**File:** `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/blocks/question/QuestionBlock.tsx` (61.6KB)

**Đề xuất:** Tách thành:
- `SingleChoiceQuestion.tsx`
- `MultiChoiceQuestion.tsx`
- `TextQuestion.tsx`
- `ConfirmQuestion.tsx`
- `QuestionSummary.tsx`
- `QuestionNavigation.tsx`

**Lợi ích:** 
- Giảm code phải load khi không dùng đến.
- React.memo hiệu quả hơn trên component nhỏ.
- Dễ bảo trì hơn.

### 1.6 🥈 Lazy load renderers trong TagRouter

**File:** `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/TagRouter.tsx` (43KB)

**Đề xuất:** Dùng `React.lazy()` + `Suspense` cho các renderer:
```typescript
const WriteToFileRenderer = React.lazy(() => import("./renderers/WriteToFileRenderer"));
const ReplaceInFileRenderer = React.lazy(() => import("./renderers/ReplaceInFileRenderer"));
// ...
```

**Lợi ích:** Chỉ load renderer khi cần, giảm bundle size khởi tạo.

### 1.7 🥉 Dùng useCallback cho render functions trong QuestionBlock

**File:** QuestionBlock.tsx

**Đề xuất:** Bọc `renderSingle`, `renderMulti`, `renderText`, `renderConfirm` trong `useCallback` để tránh tạo lại function object mỗi lần render.

### 1.8 🥉 Virtual scrolling cho danh sách message dài

**Đề xuất:** Khi conversation có >50 messages, dùng `react-window` hoặc `react-virtuoso` để chỉ render các message đang hiển thị.

**Lợi ích:** Giảm đáng kể số lượng DOM nodes, đặc biệt khi có nhiều message.

---

## 2. Tối ưu RAM

### 2.1 🥇 Giới hạn kích thước ConversationCache

**File:** `src/webview-ui/src/features/chat/services/ConversationCache.ts` (2.5KB)

**Đề xuất:**
- Thêm `maxEntries` (ví dụ: 5 conversations).
- Tự động xóa entry cũ nhất khi vượt quá giới hạn.
- Thêm TTL (ví dụ: 30 phút) để xóa cache không dùng.

```typescript
class ConversationCache {
  private static maxEntries = 5;
  private static ttl = 30 * 60 * 1000; // 30 phút
  
  static set(id: string, data: any) {
    // Nếu vượt quá maxEntries, xóa entry cũ nhất
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(id, { data, timestamp: Date.now() });
  }
}
```

### 2.2 🥇 Dọn parseCacheRef khi chuyển conversation

**File:** `src/webview-ui/src/features/chat/components/ChatBody/index.tsx`

**Đề xuất:** Thêm `useEffect` để xóa cache khi `conversationId` thay đổi:
```typescript
useEffect(() => {
  parseCacheRef.current.clear();
  lastParsedMessagesRef.current = [];
}, [conversationId]);
```

### 2.3 🥈 Giảm dữ liệu trong Message objects

**Đề xuất:**
- Không lưu `parseDebugInfo` trong production (chỉ dùng cho debug).
- Xóa `rawRequest`/`rawResponse` sau khi đã parse xong.
- Dùng `WeakMap` cho `parsed` để GC tự động dọn khi message bị xóa.

### 2.4 🥈 Code splitting — Tách bundle

**File:** `src/webview-ui/webpack.config.js`

**Đề xuất:**
- Tách `materialIconMaps.ts` (131.9KB) thành chunk riêng, load async.
- Tách các block components (CodeBlock, GitDiffBlock, TerminalBlock...) thành chunk riêng.
- Tách `react-scan` thành chunk riêng (đã thấy trong dist: `node_modules_react-scan_dist_index_mjs.webview.js` 833KB).

**Lợi ích:** Giảm kích thước bundle chính từ 1.3MB xuống ~500KB.

### 2.5 🥉 Tối ưu QuestionBlock state

**Đề xuất:** Gộp các state `selectedOptions`, `textInputs`, `confirmValues`, `customValues`, `multiCustomValues` vào một object duy nhất dùng `useReducer`.

**Lợi ích:** Giảm số lượng state objects, giảm re-render.

---

## 3. Tối ưu Disk I/O

### 3.1 🥇 Gộp các lần saveConversation — Dùng debounce

**File:** `src/webview-ui/src/features/chat/hooks/llm/useChatLLM.ts`

**Hiện tại:** Gọi `saveConversation()` 3 lần trong một flow `sendMessage()`.

**Đề xuất:**
- Chỉ gọi `saveConversation()` MỘT lần sau khi toàn bộ flow hoàn tất (sau khi parse response và cập nhật parsed data).
- Trong quá trình streaming, không save (chỉ save khi streaming kết thúc).
- Dùng debounce 500ms để gộp các lần save liên tiếp.

```typescript
const debouncedSave = useMemo(
  () => debounce((...args) => saveConversation(...args), 500),
  []
);
```

### 3.2 🥈 Không logChatToWorkspace() khi streaming

**File:** `src/webview-ui/src/features/chat/hooks/llm/useChatLLM.ts`

**Đề xuất:** Chỉ gọi `logChatToWorkspace()` sau khi response hoàn tất, không gọi trong quá trình streaming.

### 3.3 🥈 Lazy load materialIconMaps

**File:** `src/webview-ui/src/utils/fileIconMapper.ts` (3.7KB)

**Đề xuất:** Dùng dynamic import cho `materialIconMaps`:
```typescript
const materialIconMapsPromise = import("./materialIconMaps");
```

Icon có thể được load bất đồng bộ khi cần hiển thị, không cần trong bundle chính.

### 3.4 🥉 Tối ưu GrepHandler — Hạn chế số lượng file tìm kiếm

**File:** `src/handlers/tool/GrepHandler.ts` (10.2KB)

**Đề xuất:**
- Thêm giới hạn số lượng file tối đa khi grep (ví dụ: 100 files).
- Hiển thị cảnh báo nếu vượt quá giới hạn thay vì tìm kiếm tất cả.
- Cache kết quả grep nếu tìm lại cùng pattern trong thời gian ngắn.

### 3.5 🥉 Dùng IndexedDB thay vì localStorage cho conversation

**Đề xuất:** localStorage có giới hạn ~5-10MB. Với conversation dài, nên dùng IndexedDB (không giới hạn, async, không block main thread).

---

## 4. Các tối ưu khác

### 4.1 React.memo cho tất cả MessageBox con

Hiện tại `MessageBox` đã có `React.memo`, nhưng `AIMessageBox` và các component con thì chưa. Nên thêm `React.memo` cho các component thường xuyên re-render.

### 4.2 Dùng useMemo cho parsedMessages ở ChatPanel thay vì ChatBody

**Lý do:** `ChatPanel` (index.tsx) đã gọi `useMessageParsing()` để parse messages. `ChatBody` lại parse lại lần nữa. Nên parse một lần ở ChatPanel và truyền xuống.

### 4.3 Tối ưu useToolExecution — Batch setState

**File:** `useToolExecution.ts`

**Đề xuất:** Gộp nhiều `setToolOutputs`, `setClickedActions`, `setExecutionState` vào một lần gọi dùng `useReducer` hoặc `unstable_batchedUpdates`.

### 4.4 Giảm kích thước production bundle

- Tắt source map trong production build.
- Dùng `TerserPlugin` với aggressive options.
- Tree-shaking các import không dùng.

### 4.5 Thêm performance monitoring

**Đề xuất:** Thêm `React.Profiler` bọc quanh `ChatPanel` và `ChatBody` để đo thời gian render thực tế. Hiện tại code đã có `performance.now()` nhưng chưa có dashboard.

---

## Tổng kết ưu tiên thực hiện

| Ưu tiên | Mục | Impact | Effort |
|---------|-----|--------|--------|
| 🥇 P0 | 1.2 - Cache key = message ID | 🔴 Cao | Thấp (1 dòng) |
| 🥇 P0 | 1.3 - Tăng FLUSH_INTERVAL_MS | 🔴 Cao | Thấp (1 dòng) |
| 🥇 P0 | 3.1 - Gộp saveConversation | 🔴 Cao | Trung bình |
| 🥇 P0 | 2.1 - Giới hạn ConversationCache | 🟠 TB | Thấp |
| 🥈 P1 | 1.4 - requestAnimationFrame flush | 🟠 TB | Thấp |
| 🥈 P1 | 2.2 - Dọn parseCacheRef | 🟠 TB | Thấp (3 dòng) |
| 🥈 P1 | 1.5 - Tách QuestionBlock | 🟠 TB | Cao |
| 🥈 P1 | 3.2 - Không log khi streaming | 🟡 Nhẹ | Thấp |
| 🥉 P2 | 1.1 - Web Worker | 🔴 Cao | Cao |
| 🥉 P2 | 1.6 - Lazy load renderers | 🟠 TB | Trung bình |
| 🥉 P2 | 1.8 - Virtual scrolling | 🟠 TB | Cao |
| 🥉 P2 | 2.4 - Code splitting | 🟠 TB | Trung bình |
| 🥉 P3 | 3.5 - IndexedDB | 🟡 Nhẹ | Cao |