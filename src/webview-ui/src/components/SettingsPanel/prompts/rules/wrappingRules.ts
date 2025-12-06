export const WRAPPING_RULES = `CRITICAL TEXT BLOCK WRAPPING RULES (25 RULES - STRICTLY ENFORCED):

═══════════════════════════════════════════════════════════════════
RULE GROUP 1: WHAT MUST BE WRAPPED (MANDATORY)
═══════════════════════════════════════════════════════════════════
1. Nội dung <task_progress> PHẢI LUÔN được bọc trong khối code \`\`\`text
   - KHÔNG CÓ NGOẠI LỆ - Ngay cả khi chỉ có 1 mục nhiệm vụ
   - Định dạng: \`\`\`text
<task_progress>...</task_progress>
\`\`\`

2. TẤT CẢ mã bên trong thẻ <content> của <write_to_file> PHẢI được bọc trong \`\`\`text
   - Định dạng: <content>
\`\`\`text
YOUR_CODE_HERE
\`\`\`
</content>

3. TẤT CẢ mã trong thẻ <diff> (CẢ phần SEARCH và REPLACE) PHẢI được bọc trong \`\`\`text
   - Định dạng: <<<<<<< SEARCH
\`\`\`text
OLD_CODE
\`\`\`
=======
\`\`\`text
NEW_CODE
\`\`\`
>>>>>>> REPLACE

═══════════════════════════════════════════════════════════════════
RULE GROUP 2: WRAPPER FORMAT (EXACT SYNTAX) - CRITICAL
═══════════════════════════════════════════════════════════════════
4. Khối văn bản PHẢI bắt đầu CHÍNH XÁC bằng: \`\`\`text (chữ thường "text", không có khoảng trắng)
   ❌ BỊ CẤM: \`\`\`typescript, \`\`\`python, \`\`\`javascript, \`\`\`java, \`\`\`cpp, \`\`\`bash, v.v.
   ✅ CHỈ ĐƯỢC CHO PHÉP: \`\`\`text

5. Khối văn bản PHẢI kết thúc chính xác bằng: \`\`\` (ba dấu backtick, không có gì khác)

6. KHÔNG có nội dung nào được phép trước \`\`\`text hoặc sau \`\`\` đóng

7. Mỗi mục có thể bọc nhận được khối \`\`\`text...\`\`\` RIÊNG BIỆT của nó

8. 🔥 QUAN TRỌNG: KHÔNG BAO GIỜ sử dụng các marker hàng rào mã dành riêng cho ngôn ngữ
   - Ngay cả khi mã là TypeScript/Python/Java/v.v., bạn PHẢI sử dụng \`\`\`text
   - Phát hiện ngôn ngữ KHÔNG phải là trách nhiệm của bạn
   - Parser mong đợi CHỈ \`\`\`text cho TẤT CẢ các khối mã

═══════════════════════════════════════════════════════════════════
RULE GROUP 3: WHAT SHOULD NOT BE WRAPPED
═══════════════════════════════════════════════════════════════════
9. Thẻ <thinking> và giải thích KHÔNG NÊN được bọc
10. Các thẻ công cụ XML (<read_file>, <write_to_file>, v.v.) KHÔNG NÊN được bọc
11. Văn bản giải thích Tiếng Việt KHÔNG NÊN được bọc
12. KHÔNG bọc nhiều phần tử khác nhau trong một khối văn bản

═══════════════════════════════════════════════════════════════════
RULE GROUP 4: STRUCTURE REQUIREMENTS
═══════════════════════════════════════════════════════════════════
13. Thẻ <content></content> là BẮT BUỘC bên trong TẤT CẢ các thao tác <write_to_file>
14. KHÔNG BAO GIỜ bỏ qua thẻ <content> - điều này sẽ gây ra lỗi phân tích
15. Mã bên trong <content> PHẢI được bọc: <content>\`\`\`text
CODE\`\`\`</content>

═══════════════════════════════════════════════════════════════════
RULE GROUP 5: INDENTATION PRESERVATION (CRITICAL)
═══════════════════════════════════════════════════════════════════
16. Bạn PHẢI bảo tồn THỤT LỀ CHÍNH XÁC (khoảng trắng/tab) từ mã gốc
17. Đếm khoảng trắng cẩn thận - nếu bản gốc sử dụng 2 khoảng trắng, giữ 2 khoảng trắng
18. KHÔNG áp dụng tự động định dạng (Prettier, ESLint, PEP8, v.v.)
19. Trong <replace_in_file>, khối SEARCH PHẢI khớp thụt lề CHÍNH XÁC từng ký tự

═══════════════════════════════════════════════════════════════════
RULE GROUP 6: VALIDATION CHECKLIST (BEFORE SENDING RESPONSE)
═══════════════════════════════════════════════════════════════════
20. Trước khi gửi phản hồi, xác minh:
    ✓ Mọi <task_progress> đều được bọc trong \`\`\`text...\`\`\`
    ✓ Mọi khối <content> đều có trình bọc \`\`\`text
    ✓ Mọi phần SEARCH/REPLACE đều có trình bọc \`\`\`text
    ✓ Không có văn bản giải thích nào bên trong khối \`\`\`text
    ✓ Thụt lề khớp chính xác với mã gốc

21. Nếu bạn quên bọc <task_progress>, hệ thống sẽ từ chối phản hồi của bạn

═══════════════════════════════════════════════════════════════════
CORRECT FORMAT EXAMPLES
═══════════════════════════════════════════════════════════════════

✅ Example 1 - Task Progress (CORRECT):
<read_file>
<path>test.ts</path>
\`\`\`text
<task_progress>
- [ ] Phân tích cấu trúc dự án
- [ ] Kiểm tra file hiện tại
- [ ] Thêm hàm mới
</task_progress>
\`\`\`
</read_file>

✅ Example 2 - Write To File (CORRECT):
<write_to_file>
<path>src/new-file.ts</path>
<content>
\`\`\`text
export function myFunction() {
  console.log("Hello");  // 2 spaces indent
  return true;
}
\`\`\`
</content>
</write_to_file>

✅ Example 3 - Replace In File (CORRECT):
<replace_in_file>
<path>src/helper.ts</path>
<diff>
<<<<<<< SEARCH
\`\`\`text
function oldFunction() {
  return "old";
}
\`\`\`
=======
\`\`\`text
function newFunction() {
  return "new";
}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>

═══════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════
INCORRECT FORMAT EXAMPLES (WILL BE REJECTED)
═══════════════════════════════════════════════════════════════════

❌ Example 1 - Task Progress NOT wrapped (CRITICAL ERROR):
<read_file>
<path>test.ts</path>
<task_progress>
- [ ] Do something
</task_progress>
</read_file>

❌ Example 2 - Missing <content> tag:
<write_to_file>
<path>test.ts</path>
\`\`\`text
function test() {}
\`\`\`
</write_to_file>

❌ Example 3 - Code not wrapped:
<write_to_file>
<path>test.ts</path>
<content>
function test() {}
</content>
</write_to_file>

❌ Example 4 - Using language-specific marker (CRITICAL ERROR):
<write_to_file>
<path>src/utils/helper.ts</path>
<content>
\`\`\`typescript
function helper() {
  return true;
}
\`\`\`
</content>
</write_to_file>
🔥 REASON: Must use \`\`\`text instead of \`\`\`typescript

❌ Example 5 - Using Python marker (CRITICAL ERROR):
<write_to_file>
<path>calculator.py</path>
<content>
\`\`\`python
def add(a, b):
    return a + b
\`\`\`
</content>
</write_to_file>
🔥 REASON: Must use \`\`\`text instead of \`\`\`python

❌ Example 6 - Using Java marker in SEARCH block (CRITICAL ERROR):
<replace_in_file>
<path>Main.java</path>
<diff>
<<<<<<< SEARCH
\`\`\`java
public class Main {
}
\`\`\`
=======
\`\`\`text
public class Main {
    public static void main(String[] args) {}
}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>
🔥 REASON: BOTH SEARCH and REPLACE must use \`\`\`text

❌ Example 7 - Mixed markers (CRITICAL ERROR):
<replace_in_file>
<path>script.sh</path>
<diff>
<<<<<<< SEARCH
\`\`\`bash
echo "old"
\`\`\`
=======
\`\`\`shell
echo "new"
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>
🔥 REASON: BOTH blocks must use \`\`\`text (not bash, not shell)

❌ Example 8 - Mixing content in text block:
\`\`\`text
Some explanation text here
<task_progress>
- [ ] Task 1
</task_progress>
More text here
\`\`\`

═══════════════════════════════════════════════════════════════════
FINAL REMINDER (CRITICAL - READ TWICE)
═══════════════════════════════════════════════════════════════════
1. If you output <task_progress> without wrapping it in \`\`\`text...\`\`\`, 
   the system will FAIL to parse your response and the user will see an error.
   ALWAYS wrap <task_progress> in \`\`\`text code blocks - NO EXCEPTIONS!

2. 🔥 NEVER use language-specific code fence markers:
   ❌ \`\`\`typescript  ❌ \`\`\`python    ❌ \`\`\`javascript
   ❌ \`\`\`java        ❌ \`\`\`cpp       ❌ \`\`\`bash
   ❌ \`\`\`shell       ❌ \`\`\`go        ❌ \`\`\`rust
   ❌ \`\`\`php         ❌ \`\`\`ruby      ❌ \`\`\`swift
   
   ✅ ONLY USE: \`\`\`text (for ALL code, regardless of language)

3. This rule applies to:
   - <content> blocks in <write_to_file>
   - SEARCH sections in <replace_in_file>
   - REPLACE sections in <replace_in_file>
   - <task_progress> blocks
   - ALL other code blocks

4. If you use \`\`\`typescript or any language marker, the parser will FAIL
   and your response will be rejected.

═══════════════════════════════════════════════════════════════════

CRITICAL INDENTATION RULES:
- Read and preserve the EXACT number of spaces or tabs at the beginning of each line
- If original code uses 2 spaces for indentation, keep 2 spaces
- If original code uses 4 spaces, keep 4 spaces
- If original code uses tabs, keep tabs
- Do NOT apply auto-formatting (like Prettier, ESLint, or PEP8)
- Do NOT change indentation to match your preferred style
- Example: If you see "  return a + b;" (2 spaces), you MUST write "  return a + b;" (2 spaces)
- When using <replace_in_file>, the SEARCH block MUST match indentation EXACTLY character-by-character
- When using <write_to_file>, preserve the indentation style of existing files in the project

═══════════════════════════════════════════════════════════════════
CORRECT FORMAT EXAMPLES
═══════════════════════════════════════════════════════════════════

✅ Example 1 - Task Progress (CORRECT):
<read_file>
<path>test.ts</path>
\`\`\`text
<task_progress>
- [ ] Phân tích cấu trúc dự án
- [ ] Kiểm tra file hiện tại
- [ ] Thêm hàm mới
- [ ] Xác nhận kết quả
</task_progress>
\`\`\`
</read_file>

✅ Example 2 - Replace In File with TypeScript Code (CORRECT - use \`\`\`text for ALL code):
<replace_in_file>
<path>src/utils/helper.ts</path>
<diff>
<<<<<<< SEARCH
\`\`\`text
function oldFunction() {
  return "old";  // Exactly 2 spaces - MUST match original file
}
\`\`\`
=======
\`\`\`text
function newFunction() {
  return "new";
}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>

✅ Example 3 - Write Python File (CORRECT - use \`\`\`text even for Python):
<write_to_file>
<path>src/calculator.py</path>
<content>
\`\`\`text
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
\`\`\`
</content>
</write_to_file>

✅ Example 4 - Write Java File (CORRECT - use \`\`\`text even for Java):
<write_to_file>
<path>src/Main.java</path>
<content>
\`\`\`text
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
\`\`\`
</content>
</write_to_file>

✅ Example 5 - Write To File with Code (CORRECT - has <content> tag and preserves 2-space indent):
<write_to_file>
<path>src/new-file.ts</path>
<content>
\`\`\`text
export function myFunction() {
  console.log("Hello World");  // Exactly 2 spaces indent
  return true;                 // Exactly 2 spaces indent
}
\`\`\`
</content>
</write_to_file>

INCORRECT FORMAT EXAMPLES:
❌ Example 1 - Missing <content> tag (CRITICAL ERROR):
<write_to_file>
<path>test.ts</path>
\`\`\`text
function test() {
  return true;
}
\`\`\`
</write_to_file>

❌ Example 2 - code without text wrapper:
<write_to_file>
<path>test.ts</path>
<content>
function test() {
  return true;
}
</content>
</write_to_file>

❌ Example 3 - only new code wrapped in replace_in_file:
<replace_in_file>
<path>test.ts</path>
<diff>
<<<<<<< SEARCH
function oldFunction() {
  return "old";
}
=======
\`\`\`text
function newFunction() {
  return "new";
}
\`\`\`
>>>>>>> REPLACE
</diff>
</replace_in_file>

❌ Example 4 - wrapping everything:
\`\`\`text
<thinking>...</thinking>
<write_to_file>...</write_to_file>
\`\`\`

❌ Example 5 - mixing content in text block:
\`\`\`text
Some explanation
function test() {}
More text
\`\`\`

❌ Example 6 - wrong indentation (file uses 2 spaces, but you wrote 4 spaces):
<write_to_file>
<path>test.ts</path>
<content>
\`\`\`text
function test() {
    return true;  // ❌ WRONG: 4 spaces, but file uses 2 spaces
}
\`\`\`
</content>
</write_to_file>

REMEMBER: 
- <task_progress> content MUST be wrapped in \`\`\`text...\`\`\`
- ALL CODE in <replace_in_file> (both SEARCH and REPLACE sections) MUST be wrapped in \`\`\`text...\`\`\`
- ALL CODE in <write_to_file> MUST be wrapped in \`\`\`text...\`\`\` AND placed inside <content></content> tags
- The <content></content> tags are MANDATORY in <write_to_file> - NEVER skip them
- Each code block gets its own separate \`\`\`text...\`\`\` wrapper!
- Structure: <write_to_file><path>...</path><content>\`\`\`text...code...\`\`\`</content></write_to_file>
- CRITICAL: Preserve EXACT indentation (spaces/tabs) from original code - count spaces carefully!
- When using <replace_in_file>, SEARCH block MUST match original indentation character-by-character
- Example: "  return a + b;" (2 spaces) → you MUST write "  return a + b;" (2 spaces), NOT "    return a + b;" (4 spaces)`;
