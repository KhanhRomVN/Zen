# Chat Feature - Tổng quan kiến trúc

## 📁 Cấu trúc thư mục

```
chat/
├── components/           # Các component UI
│   ├── blocks/          # Block renderers (code, markdown, terminal, etc.)
│   ├── messages/        # Message rendering components
│   └── tools/           # Tool execution UI components
├── constants/           # Hằng số và cấu hình
├── hooks/               # Custom hooks (business logic)
├── prompts/             # System prompts cho AI
├── services/            # Services (API, parsing, caching)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── index.tsx            # Component chính ChatPanel
```

---

## 📄 Chi tiết từng file

### 📂 `index.tsx` - Component chính
**Vai trò**: Component chính của chat panel, kết hợp tất cả các phần lại với nhau

**Thành phần chính**:
- `SearchBar`: Thanh tìm kiếm trong chat
- `ChatBody`: Hiển thị danh sách tin nhắn
- `ChatPanel`: Component chính quản lý state và logic

**Dependencies**:
- Sử dụng các hooks: `useChatLLM`, `useToolExecution`, `useWorkspaceData`, `useFileHandling`, `useMentionSystem`
- Sử dụng các context: `SettingsContext`, `BackendConnectionContext`

---

### 📂 `components/`

#### 📁 `blocks/` - Block renderers
| File | Vai trò | Kích thước |
|------|---------|------------|
| `CodeBlock.css` | Style cho code block | 239 lines |
| `GrepBlock.tsx` | Hiển thị kết quả grep | 455 lines |
| `HtmlBlock.tsx` | Render HTML content trong iframe | 98 lines |
| `MarkdownBlock.css` | Style cho markdown | 131 lines |
| `MarkdownBlock.tsx` | Render markdown với path detection | 212 lines |
| `QuestionAnswerBlock.tsx` | Hiển thị câu hỏi và options | 293 lines |
| `RichtextBlock.css` | Style cho rich text | 89 lines |
| `RichtextBlock.tsx` | Render rich text và file tree | 279 lines |
| `TerminalBlock.css` | Style cho terminal | 342 lines |
| `TerminalBlock.tsx` | Render terminal với xterm.js | 513 lines |

**Điểm đặc biệt**:
- `MarkdownBlock.tsx`: Tự động phát hiện đường dẫn file trong code và chuyển thành link có thể click
- `TerminalBlock.tsx`: Sử dụng xterm.js để render terminal với theme VS Code
- `HtmlBlock.tsx`: Render HTML trong iframe với scaling tự động

#### 📁 `messages/` - Message rendering
| File | Vai trò | Kích thước |
|------|---------|------------|
| `MessageBox.tsx` | **Component chính** - Render toàn bộ message (user & assistant) | **1334 lines** |
| `ProcessingIndicator.tsx` | Hiển thị trạng thái đang xử lý | 72 lines |

**Chức năng của MessageBox**:
- Render user message: Hiển thị nội dung, hỗ trợ collapse, undo
- Render assistant message: Phân tích và render content blocks (markdown, code, tools, questions)
- Xử lý error messages với retry button
- Tích hợp timeline dots và collapse

#### 📁 `tools/` - Tool UI components
| File | Vai trò | Kích thước |
|------|---------|------------|
| `ExecuteButton.tsx` | Nút execute/reject cho tool | 183 lines |
| `FileToolRenderer.tsx` | Render file tools (read, write, replace, etc.) | **934 lines** |
| `index.tsx` | `ToolActionsList` - Quản lý danh sách tools | 309 lines |
| `TerminalToolRenderer.tsx` | Render command execution | 324 lines |
| `ToolHeader.tsx` | Header chung cho tool | 135 lines |
| `ToolRouter.tsx` | Router phân loại tool theo type | 394 lines |

**Luồng xử lý**:
1. `ToolActionsList` nhận danh sách actions, filter và merge các tool cùng path
2. `ToolRouter` phân loại: file tools → `FileToolRenderer`, command → `TerminalToolRenderer`
3. `FileToolRenderer` hiển thị chi tiết với header, code preview, diff stats

---

### 📂 `constants/`
| File | Vai trò |
|------|---------|
| `constants.ts` | Hằng số: labels, colors, tool names, whitelist extensions |

**Export chính**:
- `TOOL_LABELS`: Tên hiển thị của tools
- `TOOL_COLORS`: Màu sắc cho từng tool type
- `CLICKABLE_TOOLS`: Danh sách tool có thể click
- `ALLOWED_FILE_EXTENSIONS`: Extension được phép upload

---

### 📂 `hooks/` - Custom Hooks (Business Logic)

| File | Vai trò | Kích thước |
|------|---------|------------|
| `useChatLLM.ts` | **Core** - Quản lý chat state, gọi API, stream handling | **1209 lines** |
| `useCollapseSections.ts` | Quản lý trạng thái collapse của sections | 35 lines |
| `useFileHandling.ts` | Upload file, xử lý paste/drag-drop | 292 lines |
| `useMentionSystem.ts` | Hệ thống mention (@file, @folder) | 161 lines |
| `useScrollBehavior.ts` | Auto-scroll và pause khi user scroll lên | 76 lines |
| `useToolActions.ts` | Quản lý click actions và auto-execute | 279 lines |
| `useToolExecution.ts` | **Core** - Thực thi tools, quản lý output | **1345 lines** |
| `useWorkspaceData.ts` | Lấy danh sách files/folders từ workspace | 56 lines |

**Chi tiết các hook quan trọng**:

#### `useChatLLM`
- Gửi message lên API và xử lý stream response
- Quản lý conversation ID, model, account
- Xử lý file upload
- Lưu và restore conversation từ cache

#### `useToolExecution`
- Thực thi tool calls (read_file, write_to_file, replace_in_file, etc.)
- Quản lý tool outputs và terminal status
- Xử lý permission modes (fullAccess, approval, readOnly)
- Token limit warning khi output quá lớn
- Single-line review cho write_to_file

---

### 📂 `prompts/` - System Prompts

| File | Vai trò |
|------|---------|
| `access-mode.ts` | Prompt về permission mode hiện tại |
| `after-pause.ts` | Reminder khi generation bị pause |
| `constraints.ts` | Các constraint quan trọng |
| `examples.ts` | Ví dụ về cách sử dụng tools |
| `history-context.ts` | Context khi load conversation từ history |
| `identity.ts` | Identity của AI assistant |
| `index.ts` | Entry point - combine all prompts |
| `persistent-rules.ts` | Rules được inject mỗi request |
| `retry.ts` | Prompt cho retry khi có lỗi |
| `system-context.ts` | System environment info |
| `token-limit-warning.ts` | Cảnh báo khi vượt quá token limit |
| `tools-reference.ts` | Hướng dẫn sử dụng tools |
| `workflow.ts` | Workflow hướng dẫn |

---

### 📂 `services/` - Services

| File | Vai trò | Kích thước |
|------|---------|------------|
| `ConversationCache.ts` | In-memory cache cho conversations | 46 lines |
| `ConversationService.ts` | Lưu/xóa conversation, tính token | 254 lines |
| `ResponseParser.ts` | Parse AI response, trích xuất tools và content | **821 lines** |

**ResponseParser**:
- Parse XML tags từ AI response: `<read_file>`, `<write_to_file>`, etc.
- Hỗ trợ streaming (partial tags)
- Trích xuất content blocks: markdown, code, tool, question, thinking
- Tự động normalize các biến thể tên tag (camelCase, PascalCase, etc.)

---

### 📂 `types/`
| File | Vai trò |
|------|---------|
| `index.ts` | Type definitions: Message, ToolAction, UploadedFile, WorkspaceItem, etc. |

**Các type chính**:
- `Message`: Tin nhắn với role, content, metadata
- `ToolAction`: Action từ AI với type và params
- `ContentBlock`: Các block trong message (markdown, code, tool, question)

---

### 📂 `utils/`
| File | Vai trò |
|------|---------|
| `utils.ts` | Helper functions: path handling, tool colors, diff parsing, file validation |

**Các function chính**:
- `getDisplayPath`: Rút gọn đường dẫn file
- `getToolColor`: Lấy màu cho tool type
- `collectConvFilePaths`: Thu thập tất cả file paths từ conversation
- `isFileAllowed`: Kiểm tra extension được phép
- `parseNewCodeFromDiff`: Trích xuất code mới từ diff

---

## 🔗 Dependencies bên ngoài

Chat feature import các module từ bên ngoài folder:

| Import | Từ đường dẫn |
|--------|-------------|
| `extensionService` | `src/webview-ui/src/services/ExtensionService` |
| `diffUtils` | `src/webview-ui/src/utils/diffUtils` |
| `fileIconMapper` | `src/webview-ui/src/utils/fileIconMapper` |
| `FileIcon` | `src/webview-ui/src/icons/FileIcon` |
| `SettingsContext` | `src/webview-ui/src/context/SettingsContext` |
| `BackendConnectionContext` | `src/webview-ui/src/context/BackendConnectionContext` |
| `ProjectContext` | `src/webview-ui/src/context/ProjectContext` |
| `useI18n` | `src/webview-ui/src/hooks/useI18n` |
| `MessageInput` | `src/webview-ui/src/components/MessageInput` |
| `FilesPreviews` | `src/webview-ui/src/components/MessageInput/FilesPreviews` |
| `MentionDropdowns` | `src/webview-ui/src/components/MessageInput/MentionDropdowns` |

---

## 🔄 Luồng dữ liệu chính

```
User input
    ↓
ChatPanel (index.tsx)
    ↓
useChatLLM.sendMessage() → API call → Stream response
    ↓
ResponseParser.parseAIResponse() → ParsedResponse (contentBlocks, actions)
    ↓
MessageBox.render() → Render blocks theo thứ tự
    ↓
ToolActionsList → ToolRouter → FileToolRenderer / TerminalToolRenderer
    ↓
useToolExecution.executeSingleAction() → ExtensionService → VS Code API
    ↓
Tool output → toolOutputs state → Display in UI
```

---

## 🎯 Các component quan trọng cần biết

### 1. ChatPanel (index.tsx)
Component chính, kết hợp tất cả:
- ChatBody: hiển thị messages
- ChatFooter: MessageInput + FilesPreviews + MentionDropdowns
- ChatHeader: thông tin model, token usage, search

### 2. MessageBox (components/messages/MessageBox.tsx)
Render từng message:
- **User message**: Hiển thị nội dung, hỗ trợ collapse, undo
- **Assistant message**: Phân tích parsedContent và render từng block

### 3. ToolRouter (components/tools/ToolRouter.tsx)
Router phân loại tool:
- File tools (read, write, replace, list, search, grep, delete) → FileToolRenderer
- Command tools → TerminalToolRenderer
- Tools khác → fallback

---

## 📝 Ghi chú phát triển

### Code convention
- Sử dụng React hooks cho business logic
- Components functional với TypeScript
- CSS sử dụng variable từ VS Code theme
- Icons sử dụng codicon hoặc lucide-react

### State management
- Local state với useState/useReducer
- Context cho settings và project
- Cache in-memory cho conversations

### Performance
- useMemo cho parsed messages và file paths
- React.memo cho MarkdownBlock
- Debounce cho draft saving

### Testing
- Chưa có test files trong folder này (test/ folder trống)

---

## 🚀 Hướng dẫn thêm feature mới

### Thêm tool mới:
1. Thêm type vào `ToolAction.type` trong `types/index.ts`
2. Thêm label và color vào `constants/constants.ts`
3. Thêm parser trong `ResponseParser.ts` (parseToolAction)
4. Thêm executor trong `useToolExecution.ts` (executeSingleAction)
5. Thêm renderer trong `ToolRouter.tsx`

### Thêm block mới:
1. Thêm type vào `ContentBlock` trong `ResponseParser.ts`
2. Thêm parser trong `parseAIResponse`
3. Thêm renderer trong `MessageBox.tsx` hoặc tạo component mới trong `components/blocks/`

---

## 📊 File size summary

| File | Lines | Priority |
|------|-------|----------|
| `index.tsx` | 2332 | 🔴 Cần tách |
| `MessageBox.tsx` | 1334 | 🔴 Cần tách |
| `useToolExecution.ts` | 1345 | 🔴 Cần tách |
| `useChatLLM.ts` | 1209 | 🔴 Cần tách |
| `FileToolRenderer.tsx` | 934 | 🟡 Nên tách |
| `ResponseParser.ts` | 821 | 🟡 Nên tách |
| `ToolRouter.tsx` | 394 | 🟢 Có thể tách |
| `TerminalBlock.tsx` | 513 | 🟢 OK |
| `GrepBlock.tsx` | 455 | 🟢 OK |

---

**Cập nhật lần cuối**: 2026-06-18