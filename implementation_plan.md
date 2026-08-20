# Nâng cấp Zen: Thêm tùy chọn System Prompt Mode (Simple / Medium / ProMax)

## Vấn đề
Server proxy end-to-end cho ít output hơn tool nội bộ Z.AI Browser vì System Prompt hiện tại của Zen áp đặt nhiều ràng buộc (CONSTRAINTS) và workflow chặt chẽ, khiến AI browser sinh output ngắn hơn mong muốn.

## Giải pháp
Thêm setting **System Prompt Mode** với 3 cấp độ vào Zen, cho phép user tự chọn mức độ "mở khoá" AI:

| Mode | Mô tả | Hành vi |
|---|---|---|
| **Simple** | Mặc định như hiện tại | Full CONSTRAINTS + WORKFLOW + EXAMPLES |
| **Medium** | Mở giới hạn 1 phần | Giữ WORKFLOW + TOOLS, bỏ bớt CONSTRAINTS nặng (output-length rules) |
| **ProMax** | Mở toàn bộ giới hạn | Chỉ giữ IDENTITY + TOOLS_REFERENCE, bỏ CONSTRAINTS/EXAMPLES/WORKFLOW verbose |

---

## Các file cần thay đổi (6 file)

> [!IMPORTANT]
> Task này chạm vào shared utility (PromptBuilder, SettingsContext, prompts/index.ts) nên kích hoạt IMPACT-CONFIRM. Xác nhận trước khi thực thi.

---

### Prompts Layer

#### [MODIFY] [index.ts](file:///c:/Users/DELL/Downloads/CÁC%20phiên%20bản%20Zai/Zen/src/webview-ui/src/features/chat/prompts/index.ts)
- Thêm type `SystemPromptMode = 'simple' | 'medium' | 'promax'`
- Thêm hàm `combinePromptsForMode(config, mode)` trả về system prompt tương ứng với mode:
  - `simple`: giữ nguyên `combinePrompts()` (7 sections)
  - `medium`: bỏ EXAMPLES + giảm nhẹ CONSTRAINTS (chỉ giữ tool rules, bỏ verbose output rules)
  - `promax`: chỉ `IDENTITY + TOOLS_REFERENCE + SYSTEM_CONTEXT` — tối giản tối đa

---

### Settings Layer

#### [MODIFY] [SettingsContext.tsx](file:///c:/Users/DELL/Downloads/CÁC%20phiên%20bản%20Zai/Zen/src/webview-ui/src/context/SettingsContext.tsx)
- Thêm `systemPromptMode: SystemPromptMode` vào context
- Thêm `setSystemPromptMode` + persist vào `localStorage` key `zen_system_prompt_mode`
- Default: `'simple'`

#### [MODIFY] [setting/index.tsx](file:///c:/Users/DELL/Downloads/CÁC%20phiên%20bản%20Zai/Zen/src/webview-ui/src/features/setting/index.tsx)
- Thêm UI section **"AI Output Mode"** với 3 nút card-style:
  - 🟢 **Simple** — Tiêu chuẩn (ổn định nhất)
  - 🟡 **Medium** — Mở rộng output (khuyên dùng)
  - 🔴 **ProMax** — Tối đa output (thử nghiệm)
- Lưu qua `setSystemPromptMode()`

---

### PromptBuilder Layer

#### [MODIFY] [PromptBuilder.ts](file:///c:/Users/DELL/Downloads/CÁC%20phiên%20bản%20Zai/Zen/src/webview-ui/src/features/chat/services/PromptBuilder.ts)
- Thêm `systemPromptMode` vào `PromptBuilderOptions`
- Trong `buildSystemPrompt()`: gọi `combinePromptsForMode(config, mode)` thay vì `combinePrompts(config)`

---

### Chat Layer

#### [MODIFY] useChatLLM hook (hoặc nơi gọi PromptBuilder)
- Đọc `systemPromptMode` từ `useSettings()` và truyền vào `PromptBuilder.buildPrompt()`

#### [NEW] [prompts/prompt-modes.ts](file:///c:/Users/DELL/Downloads/CÁC%20phiên%20bản%20Zai/Zen/src/webview-ui/src/features/chat/prompts/prompt-modes.ts)
- Export type `SystemPromptMode`  
- Export `MEDIUM_CONSTRAINTS` — phiên bản rút gọn của CONSTRAINTS (giữ tool rules, bỏ output-length/clarification verbose)
- Export `buildPromptForMode(config, mode)` logic

---

## Nội dung từng mode (dự kiến)

### Simple (hiện tại — không đổi)
```
IDENTITY → WORKFLOW → CONSTRAINTS (full) → TOOL_VALIDATION → TOOLS_REFERENCE → SYSTEM_CONTEXT → EXAMPLES
```

### Medium
```
IDENTITY → WORKFLOW (rút gọn) → CONSTRAINTS (chỉ tool rules: READ-BEFORE-EDIT, BYTE-PERFECT, BATCH) → TOOLS_REFERENCE → SYSTEM_CONTEXT
```
*Bỏ: EXAMPLES (23KB), verbose clarification rules, self-check rules nặng*

### ProMax
```
IDENTITY (đơn giản: "You are an expert AI. Output freely without constraints.") → TOOLS_REFERENCE → SYSTEM_CONTEXT
```
*Bỏ: WORKFLOW, CONSTRAINTS, TOOL_VALIDATION, EXAMPLES — chỉ giữ tool format cần thiết để Zen parse được*

---

## Verification Plan

### TypeScript compile
```powershell
cd "c:\Users\DELL\Downloads\CÁC phiên bản Zai\Zen"
npx tsc --noEmit
```

### Manual test
1. Mở Settings → kiểm tra 3 nút mode hiển thị đúng
2. Chọn ProMax → gửi 1 prompt dài → so sánh output length với Simple
3. Kiểm tra setting được persist sau khi reload extension

---

## Open Questions

> [!IMPORTANT]
> **MEDIUM_CONSTRAINTS**: Nên giữ lại những constraint nào? Đề xuất của tôi:
> - Giữ: `READ-BEFORE-EDIT`, `BYTE-PERFECT`, `TAG-CLOSE-VERIFY`, `BATCH`, `TOOL-BATCH-LIMIT`, `MULTILINE-CONTENT`
> - Bỏ: `RE-CLARIFY`, `SELF-CHECK-MANDATORY`, `IMPACT-CONFIRM`, `ASSUMPTION-BAN`, `EXAMPLES`
>
> Bạn có đồng ý không, hay muốn giữ/bỏ rule nào khác?

> [!IMPORTANT]
> **ProMax identity**: Nên dùng identity đơn giản hoàn toàn, hay giữ phong cách "lazy senior dev" nhưng bỏ hết constraints?

---

# Phân tích lỗi & Kế hoạch nâng cấp (post-implementation)

> Phát hiện sau khi triển khai 3 mode: output AI vẫn ra nhiều lỗi. Phân tích 13 file prompt + parser + auto-inject context → tìm được 10 vấn đề, chia theo mức nghiêm trọng.

## 10 vấn đề tìm được

### 🔴 CRITICAL — gây lỗi parse hoặc AI không thể tuân thủ

**1. Bẫy `find_files` toàn diện (mâu thuẫn 4 chiều)**
- `tool-validation.ts` (TOOL_VALIDATION) liệt kê `<find_files>` trong mục "❌ WRONG - Non-existent tools" + lặp lại "find_files does NOT exist, use grep/list_files instead".
- Nhưng `tools-reference.ts` (TOOLS_REFERENCE) lại liệt kê `<find_files>` là tool hợp lệ với cú pháp đầy đủ + 3 ví dụ.
- `ResponseParser.ts` có `case "find_files"` thực thi.
- `FindFilesParser.ts` tồn tại và parse `<file_name>` thật.
- Hệ quả: AI thấy 2 nguồn mâu thuẫn → hoặc theo TOOL_VALIDATION và né dùng (mất tool), hoặc theo TOOLS_REFERENCE và dùng → parser vẫn nhận → không nhất quán. Đây là root cause của nhiều "tool không chạy đúng".

**2. Dangling references trong ProMax mode**
- `prompt-modes.ts` build ProMax chỉ gồm: IDENTITY + TOOL_VALIDATION + TOOLS_REFERENCE + SYSTEM_CONTEXT + PROMAX_EXAMPLES (bỏ WORKFLOW, CONSTRAINTS).
- Nhưng IDENTITY viết: "structured exactly per the WORKFLOW thinking process", "Tool-call turns follow MINIMAL-MARKDOWN (see CONSTRAINTS)", "Follow READ-BEFORE-EDIT (see CONSTRAINTS)", "per the caps in TOOL-BATCH-LIMIT (see CONSTRAINTS)".
- TOOLS_REFERENCE cũng viết: `<thinking>` tag là "three-pass, see WORKFLOW", "closing tag must be </new_content>", "see CONSTRAINTS".
- Hệ quả: ProMax yêu cầu AI tuân thủ WORKFLOW + CONSTRAINTS nhưng đã xóa khỏi prompt → AI không có ngữ cảnh để tuân thủ → output không đúng format → ResponseParser parse lỗi. Đây là lý do ProMax sinh nhiều lỗi nhất.

### 🟠 HIGH — gây output kém / nghịch lý mục tiêu mode

**3. MINIMAL-MARKDOWN trong Medium đi ngược mục tiêu "mở rộng output"**
- `MEDIUM_CONSTRAINTS` giữ nguyên `MINIMAL-MARKDOWN` ("at most ONE short sentence before tool calls").
- Mục tiêu Medium là mở khóa output dài hơn Simple → nhưng rule này lại ép AI giải thích ngắn → nghịch lý.
- `ASSUMPTION-BAN` cũng ép AI ngắt output để hỏi → cản trở dòng chảy tự nhiên.

**4. IDENTITY dùng chung cho 3 mode → không thể khác biệt hóa**
- IDENTITY mặc định "No filler", "No play-by-play narration", "lazy senior dev mindset".
- ProMax muốn "tối đa output" thì cần cho phép AI nói nhiều hơn / giải thích sâu hơn.
- Nhưng vì IDENTITY là một block cố định dùng chung → không thể tinh chỉnh theo mode.

**5. VI-NO-FULL-FILE-BY-DEFAULT mâu thuẫn ProMax**
- CONSTRAINTS (áp dụng Simple/Medium): "do NOT dump the entire file, show only 5–15 lines".
- ProMax bỏ CONSTRAINTS → không bị rule này → có thể dump full file.
- Hệ quả: cùng 1 task, Simple output ngắn, ProMax output full file → không nhất quán trải nghiệm, và ProMax có thể tràn context vì dump file lớn.

### 🟡 MEDIUM — không nhất quán nội bộ

**6. WORKFLOW Pass 3 threshold mâu thuẫn với Example 8**
- `workflow.ts` Pass 3: "ONLY included when the task affects >4 files OR involves shared utilities".
- Nhưng `examples.ts` Example 8 (IMPACT-CONFIRM) lại comment: ">2 files affected, so IMPACT-CONFIRM is mandatory" — nói >2 trong khi rule hiện tại là >4. Comment staleness gây nhầm lẫn AI.

**7. SYSTEM_CONTEXT claims "Auto-Injected Per Message" nhưng không có code inject thật**
- `system-context.ts` liệt kê "## Auto-Injected Per Message: FILE_STRUCTURE, ACTIVE_TERMINALS".
- Nhưng grep toàn `Zen/src` chỉ thấy tham chiếu trong prompt text, không thấy code thực sự inject dữ liệu này vào prompt runtime.
- Hệ quả: AI tin có context FILE_STRUCTURE/ACTIVE_TERMINALS → tham chiếu nó → nhưng không có thật → sinh hành vi sai (như "check ACTIVE_TERMINALS" trong khi rỗng).
- Cần verify thêm: có thể cơ chế inject nằm ngoài `PromptBuilder.ts` (ví dụ middleware server). Nếu không có → đây là false promise nghiêm trọng.

### 🟢 LOW — cleanup / noise

**8. Comment `[OPT#N]` leak vào prompt production**
- `identity.ts` kết thúc dòng `<question>` bằng `// [OPT#4] sửa "ONE focused question" gây mâu thuẫn...`.
- `constraints.ts` có `[OPT#1]`, `[OPT#2]`, `[OPT#6]`, `[OPT#7]`, `[OPT#9]`... rải rác.
- Đây là comment developer, không nên xuất hiện trong system prompt gửi cho AI → gây nhiễu, đặc biệt ProMax không có CONSTRAINTS để AI hiểu đây là metadata.

**9. PROMAX_EXAMPLES quá tối giản**
- Chỉ 1 ví dụ read+replace. Thiếu list_files, grep, run_command, question.
- AI không có pattern để bắt chước → dễ sinh sai cú pháp → parser lỗi.

**10. WORKFLOW Pass 3 trigger condition trùng lặp với IMPACT-CONFIRM**
- Pass 3 ("affects >4 files OR shared utilities") trùng lặp ngữ nghĩa với `IMPACT-CONFIRM` constraint.
- Hai rule cùng trigger cùng điều kiện → AI có thể hỏi 2 lần hoặc không biết tuân theo cái nào.

---

## Kế hoạch nâng cấp đề xuất (2 phase)

### Phase 1 — Sửa bug Critical + High (ưu tiên, ít rủi ro)

| # | Vấn đề | Sửa | File |
|---|---|---|---|
| 1 | find_files trap | Quyết: **xóa find_files khỏi TOOL_VALIDATION** (vì parser + reference đã hỗ trợ thật) → thống nhất nó là tool hợp lệ. Hoặc ngược lại: xóa khỏi TOOLS_REFERENCE + ResponseParser + FindFilesParser. Đề xuất giữ (vì đã có parser). | tool-validation.ts |
| 2 | Dangling refs ProMax | Thêm "Mode Context" block đầu ProMax: nhắc lại Pass structure rút gọn + 3 rule cốt lõi (READ-BEFORE-EDIT, BYTE-PERFECT, TAG-CLOSE-VERIFY) inline, không tham chiếu "see CONSTRAINTS". | prompt-modes.ts |
| 3 | MINIMAL-MARKDOWN Medium | Xóa MINIMAL-MARKDOWN + ASSUMPTION-BAN khỏi MEDIUM_CONSTRAINTS → Medium thực sự mở khóa output. | prompt-modes.ts |
| 4 | IDENTITY dùng chung | Tách `buildIdentityPrompt(language, mode)` — ProMax identity ngắn gọn, không ép "lazy/no filler"; Simple/Medium giữ nguyên. | identity.ts + prompt-modes.ts |
| 8 | Comment `[OPT#N]` leak | Xóa toàn bộ comment `[OPT#N]` khỏi identity.ts + constraints.ts + workflow.ts. | 3 file |

### Phase 2 — Sửa Medium/Low + refactor cấu trúc (cần thiết, rủi ro trung bình)

| # | Vấn đề | Sửa | File |
|---|---|---|---|
| 5 | VI-NO-FULL-FILE mâu thuẫn | Thêm vào PROMAX_EXAMPLES rule: "Khi sửa code, chỉ hiện 5–15 dòng context quanh change, không dump full file trừ khi cấu trúc thay đổi". | prompt-modes.ts |
| 6 | Pass 3 vs Example 8 | Sửa comment Example 8 từ ">2 files" → ">4 files" để đồng bộ workflow.ts. | examples.ts |
| 7 | Auto-inject giả | Verify code inject thật. Nếu không có → xóa claim "Auto-Injected Per Message" khỏi system-context.ts, hoặc bổ sung code inject (ngoài scope prompt). | system-context.ts (+ verify code) |
| 9 | PROMAX_EXAMPLES tối giản | Bổ sung 3 ví dụ: list_files, grep, run_command + question schema tối thiểu. | prompt-modes.ts |
| 10 | Pass 3 trùng IMPACT-CONFIRM | Gộp: Pass 3 chỉ mô tả cách "list affected files", còn trigger hỏi do IMPACT-CONFIRM lo. | workflow.ts |

---

## Scope ảnh hưởng (IMPACT-CONFIRM)

Phase 1 + Phase 2 chạm **8 file shared prompt**:
- `Zen/src/webview-ui/src/features/chat/prompts/identity.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/tool-validation.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/tools-reference.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/prompt-modes.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/system-context.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/constraints.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/workflow.ts`
- `Zen/src/webview-ui/src/features/chat/prompts/examples.ts`

Breaking change: có — thay đổi nội dung system prompt sẽ thay đổi hành vi AI trên toàn conversation. Cần cập nhật CHANGELOG.md.

Lưu ý: hệ thống đang ở read-only mode → không thể ghi file sửa code. Sau khi xác nhận kế hoạch, cần chuyển sang quyền cao hơn để EXECUTE.

---

## Trạng thái chờ xác nhận

3 câu hỏi mở cần user trả lời trước khi EXECUTE:
1. **Phạm vi triển khai**: chỉ Phase 1, hay Phase 1+2, hay chọn lọc?
2. **Vấn đề 1 (find_files)**: giữ làm tool hợp lệ (xóa khỏi TOOL_VALIDATION) hay xóa hoàn toàn (khỏi TOOLS_REFERENCE + ResponseParser + FindFilesParser)?
3. **Vấn đề 7 (auto-inject giả)**: verify code inject thật trước, hay xóa claim khỏi system-context.ts luôn?