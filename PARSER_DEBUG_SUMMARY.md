# Parser Debug Summary

## Vấn đề

Response không hiển thị UI mặc dù log `[Zen][Stream Complete]` cho thấy content đã được nhận.

## Debug logs đã thêm

### Logs luôn luôn hiển thị (không cần enable debug mode):

1. **ChatBody.tsx**:
   - `[Zen][ChatBody] Parsing message:` - Khi bắt đầu parse message
   - `[Zen][ChatBody] Cache miss, calling parseAIResponse` - Khi cache miss
   - `[Zen][ChatBody] parseAIResponse returned:` - Kết quả từ parser
   - `[Zen][ChatBody] Cache hit` - Khi cache hit

2. **ResponseParser.ts**:
   - `[Zen][Parser] 🚀 parseAIResponse called` - Khi parser được gọi
   - `[Zen][Parser] ✅ Parse complete` - Khi parse xong
   - `[Zen][Parser] ⚠️ WARNING: No contentBlocks generated` - Khi không có blocks

### Logs chỉ hiện khi enable debug mode:

Enable bằng: `localStorage.setItem('zen_debug_parser', 'true')`

- `[Zen][Parser] 📥 Parsing content:` - Content ban đầu
- `[Zen][ThinkingParser] 📥 Input:` - Input vào ThinkingParser
- `[Zen][Parser] 🧠 After thinking extraction:` - Sau khi extract thinking
- `[Zen][Parser] 🔍 Starting scan loop:` - Bắt đầu scan tools
- `[Zen][Parser] 🏷️ Found tag:` - Tìm thấy tool tag

## Cách debug

1. **Mở VSCode DevTools Console**
2. **Gửi message và xem logs**:
   - Nếu không thấy `[Zen][ChatBody] Parsing message` → Component không render
   - Nếu không thấy `[Zen][Parser] 🚀 parseAIResponse called` → Parser không được gọi
   - Nếu thấy `Parse complete` nhưng `contentBlocksCount: 0` → Parser không tạo được blocks
3. **Check contentPreview** trong logs để xem content thực tế

## Các fix đã thực hiện

1. **Partial tag handling**: Parser bỏ qua partial tags như `<thinking` (chưa có `>`)
2. **ThinkingParser**: Xử lý partial thinking tags ở cuối content
3. **Debug logs**: Thêm logs chi tiết để dễ debug
4. **Warning suppression**: Không warning khi content chỉ là partial tag

## Test

```bash
node tests/parser/test/streaming-test.test.js
```
