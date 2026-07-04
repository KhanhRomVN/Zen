# Debug Logs for Question Block Rendering Issue

## Mô tả vấn đề
Response thứ 2 (`res2`) chứa `<markdown>` và `<question>` tags nhưng không hiển thị lên giao diện.

## Các log đã thêm

### 1. ResponseParser.ts - Parse Level
**Vị trí**: End of `parseAIResponse()` function

**Log messages**:
- `[Zen][Parser] ⚠️ WARNING: No contentBlocks generated` - Cảnh báo khi parser không tạo được contentBlocks
- `[Zen][Parser] 🎯 Question blocks found` - Log chi tiết về question blocks được parse

**Kiểm tra**:
```
✅ contentBlocks có được tạo không?
✅ Question block có trong contentBlocks không?
✅ Question có schema mới (questions array) hay legacy (options)?
```

---

### 2. ChatBody.tsx - Message Visibility Level
**Vị trí**: `visibleMessages` useMemo và message map loop

**Log messages**:
- `[Zen][ChatBody] 👁️ visibleMessages filter` - Danh sách messages được render
- `[Zen][ChatBody] 📨 Rendering message` - Chi tiết từng message đang render

**Kiểm tra**:
```
✅ res2 có trong messages array không?
✅ res2 có bị filter ra khỏi visibleMessages không? (uiHidden/isCancelled)
✅ contentBlocks của res2 có dữ liệu không?
```

---

### 3. AIMessageBox.tsx - Group Creation & Rendering Level
**Vị trí**: Block grouping loop và render loop

**Log messages**:
- `[Zen][AIMessageBox] 🎯 Adding question group` - Khi question block được thêm vào groups
- `[Zen][AIMessageBox] 📦 Final render groups` - Danh sách groups cuối cùng trước khi render
- `[Zen][AIMessageBox] 🎯 Rendering question block` - Khi QuestionBlock component được render

**Kiểm tra**:
```
✅ Question block có được thêm vào groups không?
✅ Group có bị filter ra trong simple mode không?
✅ Có nextUserMessage nào làm disabled không?
✅ isGenerating có đang true không?
```

---

### 4. QuestionBlock.tsx - Component Level
**Vị trí**: Component mount/update và render decision

**Log messages**:
- `[Zen][QuestionBlock] 🎬 Component render` - Props received khi component render
- `[Zen][QuestionBlock] ⚠️ Not rendering - invalid state` - Khi component return null
- `[Zen][QuestionBlock] 🎨 Render decision` - Decision giữa normal view vs summary view

**Kiểm tra**:
```
✅ Component có nhận đúng props không?
✅ isPaginated = true?
✅ currentQuestion có giá trị không?
✅ Component có bị return null không?
```

---

## Cách sử dụng

### Bước 1: Build và reload extension
```bash
npm run build
# Reload extension trong VS Code
```

### Bước 2: Test với res1 và res2
1. Gửi câu hỏi test để nhận res1 (có question)
2. Trả lời câu hỏi
3. Nhận res2 (có markdown + question)

### Bước 3: Kiểm tra console logs
Mở Developer Tools trong VS Code webview và xem logs theo thứ tự:

```
1. [Zen][Parser] - Parse level
   └─ Kiểm tra contentBlocks có question không
   
2. [Zen][ChatBody] - Visibility level  
   └─ Kiểm tra res2 có trong visibleMessages không
   
3. [Zen][AIMessageBox] - Group level
   └─ Kiểm tra question group có được tạo và render không
   
4. [Zen][QuestionBlock] - Component level
   └─ Kiểm tra component có render hay return null
```

---

## Các nguyên nhân tiềm năng

### Nguyên nhân 1: Parser không tạo contentBlocks
**Dấu hiệu**: 
- Log `⚠️ WARNING: No contentBlocks generated` xuất hiện
- `contentBlocksCount: 0`

**Giải pháp**: Kiểm tra XML structure của res2, có thể tag chưa đóng hoàn toàn

---

### Nguyên nhân 2: Message bị filter
**Dấu hiệu**:
- res2 không có trong `visibleMessages filter` log
- `hiddenCount > 0`

**Giải pháp**: Kiểm tra `message.uiHidden` hoặc `message.isCancelled`

---

### Nguyên nhân 3: Question group bị filter trong simple mode
**Dấu hiệu**:
- Log `🎯 Adding question group` xuất hiện
- Nhưng `hasQuestionGroup: false` trong `Final render groups`
- `isSimpleMode: true`

**Giải pháp**: Question không bị filter trong simple mode, check logic khác

---

### Nguyên nhân 4: Component return null
**Dấu hiệu**:
- Log `⚠️ Not rendering - invalid state` xuất hiện
- `isPaginated: false` hoặc `hasCurrentQuestion: false`

**Giải pháp**: Question props không đúng format, check parser output

---

### Nguyên nhân 5: Disabled state
**Dấu hiệu**:
- Log `Rendering question block` có `disabled: true`
- `nextUserMessageId` có giá trị hoặc `isGenerating: true`

**Giải pháp**: Component vẫn render nhưng bị disable, không phải nguyên nhân chính

---

## Debug Script

Để bật full debug mode, chạy trong browser console:

```javascript
localStorage.setItem('zen_debug_parser', 'true');
```

Để tắt:
```javascript
localStorage.removeItem('zen_debug_parser');
```

---

## Expected Output (Normal Case)

Khi mọi thứ hoạt động đúng, bạn sẽ thấy logs như sau:

```
[Zen][Parser] 🎯 Question blocks found: 1
  Question 1: { hasNewSchema: true, questionsCount: 2, ... }

[Zen][ChatBody] 👁️ visibleMessages filter: { visibleCount: 2, ... }
[Zen][ChatBody] 📨 Rendering message: { 
  messageId: "msg-2", 
  hasQuestion: true,
  blockTypes: ["markdown", "question"]
}

[Zen][AIMessageBox] 🎯 Adding question group: { 
  messageId: "msg-2",
  questionsCount: 2
}
[Zen][AIMessageBox] 📦 Final render groups: { 
  groupTypes: ["markdown", "question"],
  hasQuestionGroup: true
}
[Zen][AIMessageBox] 🎯 Rendering question block: {
  hasQuestions: true,
  disabled: false
}

[Zen][QuestionBlock] 🎬 Component render: {
  isPaginated: true,
  questionsCount: 2
}
[Zen][QuestionBlock] 🎨 Render decision: {
  willRenderSummary: false,
  currentIndex: 0
}
```

Nếu bất kỳ bước nào missing hoặc có giá trị bất thường, đó là nơi cần investigate.
