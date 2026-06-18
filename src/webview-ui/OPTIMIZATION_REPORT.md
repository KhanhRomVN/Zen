# BÁO CÁO TỐI ƯU HÓA & XUNG ĐỘT CẤU TRÚC
## Zen Webview UI — Phân tích toàn diện

**Ngày tạo:** 2026-06-18  
**Phạm vi:** `src/webview-ui/src/` (toàn bộ source code)  
**Mục đích:** Liệt kê các vấn đề, xung đột và cơ hội tối ưu hóa theo mức độ ưu tiên

---

## 📋 BẢNG TỔNG HỢP NHANH

| STT | Loại vấn đề | Mức độ | Tác động | File liên quan |
|-----|-------------|--------|----------|----------------|
| 1 | Trùng lặp ExtensionService | ⚠️ NGHIÊM TRỌNG | Breaking, bảo trì hỗn loạn | `services/ExtensionService.ts`, `features/chat/services/`, `features/history/services/` |
| 2 | Duplicate code: `MessageInput` variants | ⚠️ NGHIÊM TRỌNG | Bảo trì khó, bug tiềm ẩn | `features/chat/index.tsx`, `features/home/index.tsx`, `components/MessageInput/index.tsx` |
| 3 | `window.api` không được sử dụng | 🔴 CAO | Code chết, rối | `features/account/index.tsx` |
| 4 | Type definitions phân tán, trùng lặp | 🔴 CAO | Type safety giảm | `types/`, `features/*/types/` |
| 5 | `ModelAccountDrawer` duplicate | 🟠 TRUNG BÌNH | Code trùng | `components/MessageInput/`, `features/chat/components/tools/` |
| 6 | `useI18n` duplicate | 🟠 TRUNG BÌNH | Code trùng, import phức tạp | `hooks/useI18n.ts` vs `features/chat/prompts/` |
| 7 | `ExtensionService` duplicate | 🟠 TRUNG BÌNH | Code trùng | `services/ExtensionService.ts`, `features/chat/services/`, `features/history/services/` |
| 8 | `isFilePathList` không dùng | 🟡 THẤP | Code chết | `features/chat/components/blocks/RichtextBlock.tsx` |
| 9 | File `home.html` root | 🟡 THẤP | Không rõ mục đích | `/home.html` |
| 10 | CSS file không dùng | 🟢 RẤT THẤP | Code chết | `src/webview-ui/src/styles.css` |
| 11 | SCSS modules không dùng | 🟢 RẤT THẤP | Code chết | `types/css.d.ts` |
| 12 | Font file quá lớn | 🟢 RẤT THẤP | Performance | `styles/fonts/*.ttf` |

---

## 🔍 CHI TIẾT TỪNG XUNG ĐỘT

### STT 1: ExtensionService — TRÙNG LẶP NGHIÊM TRỌNG

**Mô tả:**
Có 3 file `ExtensionService.ts` gần như giống hệt nhau ở 3 vị trí khác nhau:
1. `src/services/ExtensionService.ts` (file gốc)
2. `src/features/chat/services/ExtensionService.ts`
3. `src/features/history/services/ExtensionService.ts`

**Vấn đề:**
- Logic postMessage, storage, messageDispatcher được copy-paste
- Nếu sửa một file, 2 file còn lại bị lỗi thời
- Dễ tạo ra bug không đồng bộ
- Tăng bundle size không cần thiết
- Khó theo dõi dependency

**File liên quan:**
```
src/services/ExtensionService.ts
src/features/chat/services/ExtensionService.ts
src/features/history/services/ExtensionService.ts
```

**Giải pháp:**
- Giữ duy nhất file gốc `src/services/ExtensionService.ts`
- Tất cả import khác chuyển về `../../services/ExtensionService`
- Xóa 2 file duplicate

**Mức độ ưu tiên:** ⚠️ **NGHIÊM TRỌNG** — Ảnh hưởng đến toàn bộ ứng dụng

---

### STT 2: Duplicate Code trong MessageInput

**Mô tả:**
`MessageInput` component được sử dụng ở 2 nơi:
1. `features/chat/index.tsx` — inline render với nhiều logic tùy chỉnh
2. `features/home/index.tsx` — sử dụng `components/MessageInput/index.tsx`

**Vấn đề:**
- Logic xử lý message, file upload, mention system bị duplicate
- `features/chat/index.tsx` có hơn 2000 dòng, chứa cả ChatHeader + ChatBody + ChatFooter
- Khó bảo trì, sửa lỗi
- State management phân tán: message state ở ChatPanel, textarea state ở MessageInput

**File liên quan:**
```
src/features/chat/index.tsx (2337 dòng)
src/features/home/index.tsx
src/components/MessageInput/index.tsx (1433 dòng)
src/components/MessageInput/FilesPreviews.tsx
src/components/MessageInput/MentionDropdowns.tsx
```

**Giải pháp:**
- Tách ChatPanel thành: ChatContainer, ChatHeader, ChatBody, ChatFooter
- ChatFooter dùng chung MessageInput
- HomePanel dùng MessageInput với prop `isHomeMode`
- Thống nhất state management qua Context hoặc custom hook

**Mức độ ưu tiên:** ⚠️ **NGHIÊM TRỌNG** — Technical debt lớn

---

### STT 3: `window.api` Không Được Sử Dụng

**Mô tả:**
Trong `features/account/index.tsx`, có function `handleImport`:
```typescript
const result = await (window as any).api?.accounts?.import?.();
```

**Vấn đề:**
- `window.api` không được định nghĩa ở bất kỳ đâu
- Import account không hoạt động
- Code chết, tạo ảo tưởng tính năng đang hoạt động
- Gây confusion cho dev

**File liên quan:**
```
src/features/account/index.tsx (dòng 31-37)
```

**Giải pháp:**
- Xóa hoặc implement đúng API qua extensionService
- Nếu feature không cần thiết, xóa hẳn

**Mức độ ưu tiên:** 🔴 **CAO** — Feature broken

---

### STT 4: Type Definitions Phân Tán & Trùng Lặp

**Mô tả:**
Type definitions xuất hiện ở nhiều nơi:
- `types/chat.ts` — TabInfo
- `features/chat/types/index.ts` — Message, ToolAction
- `features/history/types/index.ts` — ConversationItem
- `features/account/types/index.ts` — Account

**Vấn đề:**
- `TabInfo` được định nghĩa ở `types/chat.ts` và lại được re-export từ `features/chat/types`
- `Message` interface không đồng bộ giữa các file
- `ToolAction` không được export ở root types
- Một số type chỉ dùng 1 lần nhưng ở file riêng biệt

**File liên quan:**
```
src/types/chat.ts
src/types/index.ts
src/types/storage.d.ts
src/types/window.d.ts
src/features/chat/types/index.ts
src/features/history/types/index.ts
src/features/account/types/index.ts
```

**Giải pháp:**
- Tạo thư mục `@types/` hoặc `src/types/` duy nhất
- Chỉ để 1 file `index.ts` export tất cả
- Xóa các file type trong feature (chỉ để local type nếu thực sự private)

**Mức độ ưu tiên:** 🔴 **CAO** — Type safety giảm

---

### STT 5: ModelAccountDrawer Duplicate

**Mô tả:**
`ModelAccountDrawer` xuất hiện ở 2 vị trí:
1. `components/MessageInput/ModelAccountDrawer.tsx` — 902 dòng
2. `features/chat/components/tools/ModelAccountDrawer.tsx` — (nếu có, cần kiểm tra)

**Vấn đề:**
- Component lớn (900+ dòng) bị duplicate
- Logic chọn model/account bị tách rời
- Sửa một nơi bỏ sót nơi khác

**File liên quan:**
```
src/components/MessageInput/ModelAccountDrawer.tsx
```
(kiểm tra thêm: có thể có file tương tự trong `features/chat/components/tools/`)

**Giải pháp:**
- Di chuyển lên `src/components/ModelAccountDrawer/`
- Import từ 1 nơi duy nhất

**Mức độ ưu tiên:** 🟠 **TRUNG BÌNH**

---

### STT 6: useI18n Hook Duplicate

**Mô tả:**
- `hooks/useI18n.ts` — sử dụng trong toàn app
- `features/chat/prompts/index.ts` — có logic i18n riêng

**Vấn đề:**
- Logic dịch thuật bị phân tán
- I18nKey type không được sử dụng thống nhất
- Có thể dẫn đến lỗi dịch thuật không đồng bộ

**File liên quan:**
```
src/hooks/useI18n.ts
src/i18n/index.ts
src/i18n/en.ts
src/i18n/vi.ts
src/features/chat/prompts/index.ts
```

**Giải pháp:**
- Chỉ dùng `src/hooks/useI18n.ts` duy nhất
- Xóa logic i18n trong prompts
- Tất cả component dùng useI18n từ hooks/

**Mức độ ưu tiên:** 🟠 **TRUNG BÌNH**

---

### STT 7: ExtensionService Duplicate (tiếp theo của STT 1)

**Mô tả:**
Ngoài 3 file `ExtensionService.ts`, còn có các file service khác bị duplicate:
- `features/history/services/ExtensionService.ts` (giống hệt)
- `services/ExtensionService.ts` (gốc)
- `features/chat/services/ExtensionService.ts` (giống hệt)

**Vấn đề:**
- Mỗi feature tự quản lý service riêng
- Tăng bundle size
- Khó maintain

**File liên quan:**
```
src/services/ExtensionService.ts
src/features/chat/services/ExtensionService.ts
src/features/history/services/ExtensionService.ts
```

**Giải pháp:** (giống STT 1)

**Mức độ ưu tiên:** 🟠 **TRUNG BÌNH** (đã đề cập ở STT 1)

---

### STT 8: Code Chết trong RichtextBlock

**Mô tả:**
Trong `features/chat/components/blocks/RichtextBlock.tsx`, prop `isFilePathList` được truyền vào nhưng logic xử lý không hoàn chỉnh.

**Vấn đề:**
- Prop `isFilePathList` chỉ được sử dụng để render `renderFileTree()`, nhưng logic parse tree không tối ưu
- File tree chỉ render name, không có full path cho người dùng
- Không có fallback khi parse lỗi

**File liên quan:**
```
src/features/chat/components/blocks/RichtextBlock.tsx
src/features/chat/components/tools/FileToolRenderer.tsx (sử dụng isFilePathList)
```

**Giải pháp:**
- Kiểm tra xem có thực sự cần `isFilePathList`
- Nếu có, hoàn thiện renderFileTree với full path
- Nếu không, xóa prop

**Mức độ ưu tiên:** 🟡 **THẤP**

---

### STT 9: File home.html Không Rõ Mục Đích

**Mô tả:**
File `home.html` nằm ở root project (không trong src).

**Vấn đề:**
- Không được import vào bất kỳ đâu
- Mục đích không rõ ràng
- Có thể là file cũ từ template ban đầu

**File liên quan:**
```
/home.html (1398 dòng)
```

**Giải pháp:**
- Xác minh mục đích
- Nếu không dùng, xóa hoặc move vào thư mục thích hợp (ví dụ `public/`)

**Mức độ ưu tiên:** 🟡 **THẤP**

---

### STT 10: CSS file Không Dùng

**Mô tả:**
`src/webview-ui/src/styles.css` chỉ có 1 dòng `@import "tailwindcss";`.

**Vấn đề:**
- CSS này bị import trong `index.tsx`
- Tailwind được import ở `global.css` rồi
- Gây duplicate, tăng bundle size không cần thiết

**File liên quan:**
```
src/webview-ui/src/styles.css
src/webview-ui/src/index.tsx
src/webview-ui/src/styles/global.css
```

**Giải pháp:**
- Xóa `styles.css`
- Sửa `index.tsx` chỉ import `global.css` và `variables.css`

**Mức độ ưu tiên:** 🟢 **RẤT THẤP**

---

### STT 11: SCSS Modules Không Dùng

**Mô tả:**
Trong `types/css.d.ts`, có declare module cho `.scss` và `.sass`.

**Vấn đề:**
- Không có file `.scss` hay `.sass` nào trong project
- Declare không cần thiết, gây noise

**File liên quan:**
```
src/types/css.d.ts
```

**Giải pháp:**
- Xóa declare module cho .scss, .sass nếu không dùng

**Mức độ ưu tiên:** 🟢 **RẤT THẤP**

---

### STT 12: Font File Quá Lớn

**Mô tả:**
2 file font Inter trong `styles/fonts/` có kích thước ~6MB mỗi file.

**Vấn đề:**
- Extension bundle size lớn (~12MB cho font)
- VS Code extension thường yêu cầu bundle size nhỏ
- Font đã có sẵn trong VS Code (Inter là font mặc định)

**File liên quan:**
```
src/webview-ui/src/styles/fonts/Inter-VariableFont_opsz,wght.ttf (6274 dòng)
src/webview-ui/src/styles/fonts/Inter-Italic-VariableFont_opsz,wght.ttf (6283 dòng)
```

**Giải pháp:**
- Sử dụng font system của VS Code: `var(--vscode-font-family)`
- Hoặc load font từ CDN nếu cần
- Xóa 2 file font khỏi bundle

**Mức độ ưu tiên:** 🟢 **RẤT THẤP** (nhưng ảnh hưởng performance)

---

## 📊 THỐNG KÊ TỔNG HỢP

| Loại vấn đề | Số lượng |
|-------------|----------|
| Duplicate code | 4 |
| Code chết / Không dùng | 4 |
| Structure issue | 2 |
| Type definition phân tán | 1 |
| Performance issue | 1 |

---

## 🔧 KHUYẾN NGHỊ TRIỂN KHAI

### Giai đoạn 1 (Tuần 1) — Critical
1. ✅ Merge `ExtensionService` — giữ 1 file duy nhất
2. ✅ Fix `window.api` — implement hoặc xóa
3. ✅ Thống nhất type definitions

### Giai đoạn 2 (Tuần 2) — Medium
4. ✅ Refactor MessageInput — tách ChatPanel thành các component nhỏ
5. ✅ Hợp nhất ModelAccountDrawer
6. ✅ Hợp nhất useI18n

### Giai đoạn 3 (Tuần 3) — Low
7. ✅ Xóa code chết (isFilePathList, styles.css, home.html, SCSS modules)
8. ✅ Tối ưu font (dùng font system VS Code)

---

## 📝 FILE CẦN XÓA HOẶC DI CHUYỂN

| File | Hành động | Lý do |
|------|-----------|-------|
| `features/chat/services/ExtensionService.ts` | ❌ Xóa | Duplicate |
| `features/history/services/ExtensionService.ts` | ❌ Xóa | Duplicate |
| `src/webview-ui/src/styles.css` | ❌ Xóa | Duplicate import |
| `home.html` | ❌ Xóa / Di chuyển | Không dùng |
| `types/css.d.ts` (SCSS/SASS declarations) | ✏️ Sửa | Không dùng |
| `styles/fonts/*.ttf` | ❌ Xóa | Dùng font system |
| `features/chat/components/tools/ModelAccountDrawer.tsx` (nếu có) | ❌ Xóa | Duplicate |

---

## 📚 FILE CẦN REFACTOR

| File | Hành động | Lý do |
|------|-----------|-------|
| `features/chat/index.tsx` | ✏️ Tách thành nhiều file | Quá lớn (2337 dòng) |
| `components/MessageInput/index.tsx` | ✏️ Tối ưu props | Quá nhiều props (~40) |
| `features/chat/components/tools/ToolRouter.tsx` | ✏️ Tối ưu | Logic phức tạp |
| `features/chat/hooks/useChatLLM.ts` | ✏️ Tách | Quá nhiều trách nhiệm |

---

## ✅ KẾT LUẬN

Dự án có cấu trúc khá tốt nhưng tồn tại nhiều vấn đề về duplicate code và phân tán logic. Ưu tiên hàng đầu là giải quyết duplicate `ExtensionService` và type definitions vì ảnh hưởng đến toàn bộ ứng dụng. Sau đó refactor `MessageInput` và `ChatPanel` để giảm technical debt.

Tổng thời gian ước tính: **2-3 tuần** (tùy độ phức tạp và test coverage).

---

*Báo cáo được tạo tự động bởi Elara AI dựa trên phân tích toàn bộ source code trong `src/webview-ui/src/`.*