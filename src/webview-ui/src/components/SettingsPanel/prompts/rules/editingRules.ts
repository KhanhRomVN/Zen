export const EDITING_RULES = `CRITICAL CLARIFICATION RULES (STRICTLY ENFORCED):

═══════════════════════════════════════════════════════════════════
RULE 1: MANDATORY READ_FILE BEFORE REPLACE_IN_FILE (CRITICAL)
═══════════════════════════════════════════════════════════════════
Bạn PHẢI tuân theo quy trình nghiêm ngặt này khi sử dụng <replace_in_file>:

1. **SỬ DỤNG ĐẦU TIÊN replace_in_file TRÊN MỘT FILE:**
   ✅ PHẢI gọi <read_file> trước để lấy nội dung hiện tại
   ❌ KHÔNG BAO GIỜ sử dụng <replace_in_file> mà không đọc tệp trước
   
   Ví dụ (ĐÚNG):
   <read_file>
   <path>src/test.ts</path>
   </read_file>
   
   ... (sau khi nhận được nội dung tệp)
   
   <replace_in_file>
   <path>src/test.ts</path>
   <diff>...</diff>
   </replace_in_file>

2. **replace_in_file TIẾP THEO SAU MỘT replace_in_file TRƯỚC ĐÓ:**
   ✅ PHẢI gọi <read_file> lại trước <replace_in_file> tiếp theo
   ⚠️ Lý do: Tệp có thể được tự động định dạng bởi trình chỉnh sửa (VSCode, v.v.)
   ❌ KHÔNG BAO GIỜ cho rằng nội dung tệp không thay đổi
   
   Ví dụ (ĐÚNG):
   Yêu cầu 1:
   <read_file><path>src/test.ts</path></read_file>
   <replace_in_file><path>src/test.ts</path>...</replace_in_file>
   
   Yêu cầu 2 (sau đó):
   <read_file><path>src/test.ts</path></read_file>  ← PHẢI đọc lại!
   <replace_in_file><path>src/test.ts</path>...</replace_in_file>

3. **KHI BẠN KHÔNG CẦN ĐỌC LẠI read_file:**
   ✅ Nếu bạn đã <read_file> nhưng chưa thực hiện <replace_in_file> nào
   
   Ví dụ (ĐÚNG - không đọc dư thừa):
   <read_file><path>src/test.ts</path></read_file>
   ... (phân tích nội dung)
   <replace_in_file><path>src/test.ts</path>...</replace_in_file>  ← OK, không cần đọc lại

4. **QUY TẮC THEO DÕI:**
   - Theo dõi theo tệp: "Tôi đã đọc tệp này chưa?" + "Tôi đã thay thế sau khi đọc chưa?"
   - Nếu "đã thay thế sau khi đọc" = CÓ → PHẢI đọc lại trước khi thay thế tiếp theo
   - Nếu "đã đọc nhưng chưa thay thế" = CÓ → Có thể thay thế mà không cần đọc lại

═══════════════════════════════════════════════════════════════════
RULE 1.5: PREVENT INFINITE REPLACE_IN_FILE LOOP (CRITICAL)
═══════════════════════════════════════════════════════════════════
**CƠ CHẾ THEO DÕI:**
- Theo dõi số lần <replace_in_file> LIÊN TIẾP trên CÙNG MỘT FILE
- Nếu đã <replace_in_file> trên file X ≥ 2 lần LIÊN TIẾP mà vẫn có lỗi
  → PHẢI gọi <read_file> trên file X để xem toàn bộ nội dung hiện tại

**TẠI SAO QUY TẮC NÀY TỒN TẠI:**
- File có thể bị auto-format bởi VSCode/Prettier
- Spacing/indentation có thể thay đổi sau mỗi replace
- SEARCH block không match được do indentation sai
- Blind replace without re-reading = infinite loop

**QUY TRÌNH ĐÚNG:**
Yêu cầu 1: <replace_in_file> trên file.ts → thất bại
Yêu cầu 2: <replace_in_file> trên file.ts → thất bại lần nữa
Yêu cầu 3: ⚠️ DỪNG! Phải <read_file> trên file.ts trước
           → Phân tích trạng thái hiện tại
           → Sau đó <replace_in_file> với SEARCH block chính xác

**VÍ DỤ - SAI (VÒNG LẶP VÔ HẠN):**
Yêu cầu 1: <replace_in_file path="test.ts"> ... </replace_in_file> → lỗi
Yêu cầu 2: <replace_in_file path="test.ts"> ... </replace_in_file> → lỗi
Yêu cầu 3: <replace_in_file path="test.ts"> ... </replace_in_file> → lỗi (VÒNG LẶP!)

**VÍ DỤ - ĐÚNG (CÓ ĐỌC):**
Yêu cầu 1: <replace_in_file path="test.ts"> ... </replace_in_file> → lỗi
Yêu cầu 2: <replace_in_file path="test.ts"> ... </replace_in_file> → lỗi
Yêu cầu 3: <read_file path="test.ts"> → Đọc trạng thái hiện tại
Yêu cầu 4: <replace_in_file path="test.ts"> → Bây giờ sử dụng spacing CHÍNH XÁC từ kết quả đọc

**THỰC HIỆN:**
- Duy trì bộ đếm cho mỗi file: Map<filePath, consecutiveReplaceCount>
- Đặt lại bộ đếm khi <read_file> được gọi trên file đó
- Nếu bộ đếm ≥ 2 → Bắt buộc <read_file> trước <replace_in_file> tiếp theo`;
