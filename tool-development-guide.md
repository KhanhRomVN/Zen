# Tool Development Guide — Zen

Hướng dẫn chi tiết về cách thêm, sửa, xóa một tool trong hệ thống Agent Chat của Zen.

---

## 📋 Tổng quan Architecture

Khi thêm/sửa/xóa một tool, bạn cần cập nhật các thành phần sau theo thứ tự:

1. **Parser** — Parse XML tags từ AI response
2. **Type Definitions** — Định nghĩa TypeScript types
3. **Executor** — Gửi message tới extension backend để thực thi tool
4. **Executor Registry** — Factory `getExecutor()` route action type → executor class
5. **Response Parser** — Đăng ký tool type vào `parseAIResponse`
6. **UI Block** (optional) — Reusable UI component hiển thị output
7. **UI Renderer** — Render tool execution trong chat UI
8. **Renderer Index** — Export renderer
9. **TagRouter** — Route tool type → renderer component
10. **Constants** — Khai báo tool metadata trong `TAG_REGISTRY`
11. **Prompts** — Hướng dẫn AI sử dụng tool trong `tools-reference.ts`

Lưu ý khác biệt quan trọng so với kiến trúc cũ (module/controller):
- Zen **không có** `modules/{module}/handler/` hay `controller/{Module}Controller.ts`.
- Backend logic thực tế nằm trong extension backend, được frontend gọi qua `extensionService.postMessage()`.
- Frontend orchestration nằm trong `hooks/tools/useToolActions.ts` và `hooks/tools/useToolExecution.ts`.

---

## 🗂️ Cấu trúc Files & Folders

Toàn bộ đường dẫn bên dưới là tương đối so với `Zen/`.

### 1️⃣ **Parsers**
📁 `src/webview-ui/src/features/chat/services/parsers/`

**Mục đích:** Parse XML tags từ AI response thành params object.

**Mỗi tool có MỘT file parser riêng** (không gom theo module):
- `ReadFileParser.ts`
- `WriteToFileParser.ts`
- `ReplaceInFileParser.ts`
- `GrepParser.ts`
- `ListFilesParser.ts`
- `FindFilesParser.ts`
- `DeleteFileParser.ts`
- `RevertFileParser.ts`
- `ViewReplaceHistoryParser.ts`
- `RunCommandParser.ts`
- `GitStatusParser.ts`
- `GitDiffParser.ts`
- `CommitMessageParser.ts`
- `MarkdownParser.ts`
- `QuestionParser.ts`
- `ThinkingParser.ts`

**Pattern mẫu (theo `ReadFileParser.ts`):**
```typescript
import { extractParamValue } from "../../utils/ToolParser";

export interface ReadFileParams {
  file_path: string;
  start_line?: number;
  end_line?: number;
}

export const parseReadFile = (innerContent: string): ReadFileParams => {
  const filePath = extractParamValue(innerContent, "file_path");
  const startLine = extractParamValue(innerContent, "start_line");
  const endLine = extractParamValue(innerContent, "end_line");

  return {
    file_path: filePath || "",
    start_line: startLine ? parseInt(startLine, 10) : undefined,
    end_line: endLine ? parseInt(endLine, 10) : undefined,
  };
};
```

**Khi thêm tool mới:**
- Tạo file `{ToolName}Parser.ts`
- Export `interface {ToolName}Params` và function `parse{ToolName}(innerContent: string)`
- Dùng helper `extractParamValue` từ `utils/ToolParser`

**Khi sửa tool:**
- Thêm/xóa/sửa param extraction logic
- Update return type

**Khi xóa tool:**
- Xóa file parser
- Xóa import trong `services/ResponseParser.ts`

---

### 2️⃣ **Type Definitions**
📁 `src/webview-ui/src/features/chat/types/`

**Mục đích:** Định nghĩa TypeScript types cho tool params, executor, renderer.

**Files chính:**
- `tool-types.ts` — Types cho tool params
- `executor-types.ts` — Interface `ToolExecutor`, `ExecutorContext`, `ExecutorOptions`
- `tag-types.ts` — Types cho tag registry (`TagDefinition`, `TagCategory`, `ToolType`, ...)
- `renderer-types.ts` — Types cho renderer props (`BaseRendererProps`, `MergedRendererProps`, ...)
- `message.ts`, `chat.ts`, `tool-outputs.ts`, `workspace.ts` — Types khác liên quan

**Khi thêm tool mới:**
- Thêm interface params vào `tool-types.ts` (hoặc ngay trong parser file nếu tool dùng riêng)

**Khi sửa tool:**
- Update interface nếu params thay đổi

**Khi xóa tool:**
- Xóa interface nếu không còn dùng

---

### 3️⃣ **Executors**
📁 `src/webview-ui/src/features/chat/services/tool-executors/`

**Mục đích:** Gửi message tới extension backend để thực thi tool, nhận kết quả qua `messageDispatcher`.

**Mỗi tool có MỘT file executor riêng**, dạng class implements interface `ToolExecutor`:
- `ReadFileExecutor.ts`
- `WriteToFileExecutor.ts`
- `ReplaceInFileExecutor.ts`
- `GrepExecutor.ts`
- `ListFilesExecutor.ts`
- `FindFilesExecutor.ts`
- `DeleteFileExecutor.ts`
- `RevertFileExecutor.ts`
- `ViewReplaceHistoryExecutor.ts`
- `RunCommandExecutor.ts`
- `GitDiffExecutor.ts`

**Pattern mẫu (theo `ReadFileExecutor.ts`):**
```typescript
import { ExecutorContext, ExecutorOptions, ToolExecutor } from "../../types/executor-types";

export class ReadFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs, getToolTimeout, extensionService, messageDispatcher } = context;
    const { bypassIgnore = false } = options;

    return new Promise((resolve) => {
      const requestId = `read-${Date.now()}-${Math.random()}`;
      const filePath = action.params.path || action.params.file_path;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "readFile",
        path: filePath,
        start_line: action.params.start_line,
        end_line: action.params.end_line,
        requestId,
        bypassIgnore,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            setToolOutputs((prev) => ({ ...prev, [actionId]: { output: `Error - ${msg.error}`, isError: true } }));
            resolve(`[read_file for '${filePath}'] Result: Error - ${msg.error}`);
          } else {
            const content = msg.content || "";
            setToolOutputs((prev) => ({ ...prev, [actionId]: { output: content, isError: false } }));
            resolve(`[read_file for '${filePath}'] Result:\n\`\`\`\n${content}\n\`\`\``);
          }
        },
        getToolTimeout(action.type),
        () => { /* timeout handler */ },
      );
    });
  }
}
```

**Key points:**
- Executor gửi `extensionService.postMessage({ command: "...", ... })` — backend extension xử lý nghiệp vụ thực tế.
- `messageDispatcher.register(requestId, onMessage, timeout, onTimeout)` nhận kết quả trả về.
- `setToolOutputs()` cập nhật UI state.
- Return string format: `[tool_name for '...'] Result: ...` hoặc `[tool_name for '...'] Result: Error - ...`

**Khi thêm tool mới:**
- Tạo class `{ToolName}Executor` implements `ToolExecutor`
- Implement method `execute(action, context, options)`

**Khi xóa tool:**
- Xóa file executor
- Xóa export trong `tool-executors/index.ts`

---

### 4️⃣ **Executor Registry (Factory)**
📁 `src/webview-ui/src/features/chat/services/tool-executors/index.ts`

**Mục đích:** Export tất cả executor classes + cung cấp factory function `getExecutor()` để route action type → executor instance.

**Không dùng map object** như kiến trúc cũ — dùng **switch case** trong factory function:
```typescript
export function getExecutor(
  actionType: string,
  pendingToolResolvers?: Map<string, (result: string | null) => void>,
  commandStartTimes?: Map<string, number>,
  earlyCommandResults?: Map<string, any>,
): ToolExecutor | null {
  switch (actionType) {
    case "read_file":
      return new ReadFileExecutor();
    case "write_to_file":
      return new WriteToFileExecutor();
    case "run_command":
      // RunCommandExecutor cần thêm dependencies
      if (!pendingToolResolvers || !commandStartTimes || !earlyCommandResults) {
        console.error("RunCommandExecutor requires additional dependencies");
        return null;
      }
      return new RunCommandExecutor(pendingToolResolvers, commandStartTimes, earlyCommandResults);
    case "git_status":
      // git_status là display-only, không cần executor
      return null;
    default:
      console.warn(`[Zen][tool] No executor found for action type: "${actionType}"`);
      return null;
  }
}
```

**Khi thêm tool mới:**
- Thêm `export { NewToolExecutor } from "./NewToolExecutor";` ở phần exports
- Thêm `case "new_tool": return new NewToolExecutor();` trong `getExecutor()`

**Khi xóa tool:**
- Xóa export line
- Xóa case trong `getExecutor()`

---

### 5️⃣ **Response Parser**
📁 `src/webview-ui/src/features/chat/services/ResponseParser.ts`

**Mục đích:** Parse AI response, extract tool calls (actions), hỗ trợ interleaved text và tool calls.

**Export chính:**
- `parseAIResponse(content: string): ParsedResponse`
- Interface `ToolAction { type: TagType; params: Record<string, any>; rawXml: string; isError?: boolean; ... }`
- Interface `ParsedResponse { followupQuestion, followupOptions, taskName, actions, contentBlocks, displayText, question }`

**Khi thêm tool mới:**
1. Import parser function: `import { parseNewTool } from "./parsers/NewToolParser";`
2. Thêm case trong `parseAIResponse()` switch (xử lý theo tag type)
3. Khai báo tool type trong danh sách tag hợp lệ (nếu có)

**Khi xóa tool:**
- Xóa import parser
- Xóa case trong switch
- Xóa khỏi danh sách tag hợp lệ

---

### 6️⃣ **UI Blocks** (Optional)
📁 `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/blocks/`

**Mục đích:** Reusable UI components để hiển thị nội dung tool output.

**Cấu trúc hiện tại (13 categories):**
- `code/` — `CodeBlock.tsx`
- `commit_message/` — `CommitMessageBlock.tsx`, `CommitMessageBlock.css`
- `error/` — `ErrorBlock.tsx`, `ErrorBlock.css`
- `git_diff/` — `GitDiffBlock.tsx`, `GitDiffBlock.css`
- `git_status/` — `GitStatusBlock.tsx`, `GitStatusBlock.css`
- `grep/` — `GrepBlock.tsx`
- `markdown/` — `MarkdownBlock.tsx`, `MarkdownBlock.css`
- `question/` — `QuestionBlock` (nhiều file), `QuestionBlock.css`
- `run_command/` — `TerminalBlock.tsx`, `TerminalBlock.css`
- `thinking/` — `ThinkingBlock.tsx`, `ThinkingBlock.css`
- `tree/` — `TreeBlock.tsx`, `TreeBlock.css`
- `view_replace_history/` — `ViewReplaceHistoryBlock.tsx`, `ViewReplaceHistoryBlock.css`
- `warning/` — `WarningBlock.tsx`, `WarningBlock.css`

**Không có** `emulate/` hay `other/` như kiến trúc cũ.

**Khi thêm block mới:**
- Tạo thư mục `blocks/{category}/`
- Tạo component `{Name}Block.tsx` (+ `.css` nếu cần)
- Export named: `export const NewBlock: React.FC<NewBlockProps> = ...`

**Khi xóa block:**
- Xóa file (và thư mục nếu trống)
- Xóa imports trong renderers

---

### 7️⃣ **UI Renderers**
📁 `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/renderers/`

**Mục đích:** Render tool execution trong chat UI.

**File phẳng — KHÔNG có thư mục con** (khác kiến trúc cũ có `code/`, `emulate/`, `recon/`):
- `ReadFileRenderer.tsx`
- `WriteToFileRenderer.tsx`
- `ReplaceInFileRenderer.tsx`
- `GrepRenderer.tsx`
- `ListFilesRenderer.tsx`
- `FindFilesRenderer.tsx`
- `DeleteFileRenderer.tsx`
- `RevertFileRenderer.tsx`
- `ViewReplaceHistoryRenderer.tsx`
- `RunCommandRenderer.tsx`
- `GitStatusRenderer.tsx`
- `CommitMessageRenderer.tsx`
- `MarkdownRenderer.tsx`
- `QuestionRenderer.tsx`
- `ErrorRenderer.tsx`
- `WarningRenderer.tsx`
- `ThinkingRenderer.tsx`

**Khi thêm renderer mới:**
- Tạo file `{ToolName}Renderer.tsx` trong `renderers/`
- Export named: `export const NewToolRenderer: React.FC<BaseRendererProps> = ...`
- Nhận `BaseRendererProps` từ `types/renderer-types`

**Khi xóa renderer:**
- Xóa file
- Xóa export trong `renderers/index.ts`

---

### 8️⃣ **Renderer Index**
📁 `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/renderers/index.ts`

**Mục đích:** Export tất cả renderers + shared types/utils.

**Khi thêm renderer mới:**
```typescript
export { NewToolRenderer } from "./NewToolRenderer";
```

**Khi xóa renderer:**
- Xóa export line

---

### 9️⃣ **TagRouter**
📁 `src/webview-ui/src/features/chat/components/ChatBody/AIMessageBox/TagRouter.tsx`

**Mục đích:** Route tool types → renderer components. Import renderers từ `./renderers`, constants từ `constants/constants.ts`.

**Khi thêm tool mới:**
- Import renderer từ `./renderers`
- Thêm case trong switch/map

**Khi xóa tool:**
- Xóa import
- Xóa case

---

### 🔟 **Constants**
📁 `src/webview-ui/src/features/chat/constants/constants.ts`

**Mục đích:** Chứa `TAG_REGISTRY` — central registry định nghĩa tool metadata.

**Không có** file category-specific (`emulate.ts`, `code.ts`) như kiến trúc cũ — tất cả nằm trong `constants.ts`.

**Cấu trúc `TAG_REGISTRY`:**
```typescript
export const TAG_REGISTRY: Record<string, TagDefinition> = {
  read_file: {
    id: "read_file",
    title: "READ",
    category: "tool",
    timeout: 60000,
    permissions: {
      approval: "allow",
      fullAccess: "allow",
    },
    features: {
      showFileStats: true,
    },
  },
  write_to_file: {
    id: "write_to_file",
    title: "WRITE",
    category: "tool",
    // ...
  },
  // ...
};
```

**Khi thêm tool mới:**
- Thêm entry vào `TAG_REGISTRY` với `id`, `title`, `category`, `timeout`, `permissions`, `features` (nếu có)

**Khi sửa tool:**
- Update metadata (timeout, permissions, features, title)

**Khi xóa tool:**
- Xóa entry khỏi `TAG_REGISTRY`

---

### 1️⃣1️⃣ **Prompts**
📁 `src/webview-ui/src/features/chat/prompts/`

**Mục đích:** Hướng dẫn AI sử dụng tool.

**Files hiện tại:**
- `tools-reference.ts` — Tool documentation cho AI (quan trọng nhất)
- `index.ts` — Export prompts
- `commit-message.ts`, `constraints.ts`, `examples.ts`, `identity.ts`, `prompt-modes.ts`, `system-context.ts`, `tool-validation.ts`, `workflow.ts`

**Không có** `tools-list.md` hay cấu trúc `prompts/{module}/` như kiến trúc cũ.

**Khi thêm tool mới trong `tools-reference.ts`:**
- Thêm tool description với format:
  - Tên tool (dạng XML tag)
  - Mô tả ngắn
  - Danh sách parameters (required/optional)
  - Return format
  - Ví dụ XML
  - Ghi chú quan trọng (nếu có)

**Khi xóa tool:**
- Xóa documentation khỏi `tools-reference.ts`

---

## 🔄 Workflow: Thêm Tool Mới

### Step 1: Parser & Types
1. Tạo `services/parsers/{ToolName}Parser.ts` — export `parse{ToolName}` + `{ToolName}Params`
2. Thêm interface vào `types/tool-types.ts` nếu cần

### Step 2: Executor
3. Tạo `services/tool-executors/{ToolName}Executor.ts` — class implements `ToolExecutor`
4. Register trong `services/tool-executors/index.ts` (export + factory case)

### Step 3: Response Parsing
5. Import parser trong `services/ResponseParser.ts`
6. Thêm case trong `parseAIResponse()`

### Step 4: UI Layer
7. (Optional) Tạo Block trong `blocks/{category}/`
8. Tạo Renderer trong `renderers/{ToolName}Renderer.tsx`
9. Export renderer trong `renderers/index.ts`
10. Route trong `TagRouter.tsx`

### Step 5: Configuration
11. Thêm entry vào `TAG_REGISTRY` trong `constants/constants.ts`
12. Thêm tool documentation vào `prompts/tools-reference.ts`

---

## 🔄 Workflow: Sửa Tool Existing

### Thay đổi Input/Output Format
1. **Parser** — Sửa param extraction nếu tag format thay đổi
2. **Types** — Update interface
3. **Executor** — Update params passing / message command
4. **Renderer** — Update parsing output để hiển thị
5. **Prompts** — Update documentation

### Thay đổi UI
1. **Block** — Sửa component rendering logic
2. **Renderer** — Update props passing to block
3. Không cần sửa backend

### Thay đổi Business Logic
1. **Executor** — Sửa cách gửi message tới extension backend
2. Không cần sửa UI

---

## 🗑️ Workflow: Xóa Tool

1. ✅ **Parser** — Xóa file, xóa import trong `ResponseParser.ts`
2. ✅ **Types** — Xóa interface nếu không còn dùng
3. ✅ **Executor** — Xóa file
4. ✅ **Executor Index** — Xóa export + case trong `getExecutor()`
5. ✅ **Response Parser** — Xóa case
6. ✅ **Block** (if exists) — Xóa file
7. ✅ **Renderer** — Xóa file
8. ✅ **Renderer Index** — Xóa export
9. ✅ **TagRouter** — Xóa import và case
10. ✅ **Constants** — Xóa entry trong `TAG_REGISTRY`
11. ✅ **Prompts** — Xóa documentation trong `tools-reference.ts`

---

## 📝 Naming Conventions

### Tool Names
- Lowercase, underscore-separated: `read_file`, `write_to_file`, `list_files`, `run_command`, `git_status`
- Verb + Noun pattern: `read_file`, `write_to_file`, `list_files`, `view_replace_history`

### File Names
- Parser: `{ToolName}Parser.ts` — e.g. `ReadFileParser.ts`
- Executor: `{ToolName}Executor.ts` — e.g. `ReadFileExecutor.ts`
- Renderer: `{ToolName}Renderer.tsx` — e.g. `ReadFileRenderer.tsx`
- Block: `{Name}Block.tsx` — e.g. `CodeBlock.tsx`

### Function / Class Names
- Parser function: `parse{ToolName}` — e.g. `parseReadFile`
- Executor class: `{ToolName}Executor` — e.g. `ReadFileExecutor`
- Renderer component: `{ToolName}Renderer` — e.g. `ReadFileRenderer`
- Block component: `{Name}Block` — e.g. `CodeBlock`

### Component Export
- Luôn export named: `export const ComponentName: React.FC<Props> = ...`

---

## 🎯 Best Practices

### 1. Separation of Concerns
- **Parser:** Chỉ lo parse XML → params object
- **Executor:** Gửi message tới extension backend, nhận kết quả qua `messageDispatcher`
- **Renderer:** Chỉ lo UI, nhận `BaseRendererProps`
- **Block:** Reusable UI component, nhận `content` prop

### 2. Error Handling
- Executor wrap error trong output string: `[tool_name] Result: Error - ...`
- `setToolOutputs()` lưu `isError: true` khi có lỗi
- Renderer hiển thị `ErrorBlock` hoặc trạng thái lỗi

### 3. Type Safety
- Interface params dùng chung cho Parser, Executor, Renderer
- Executor implements `ToolExecutor` từ `types/executor-types.ts`
- Renderer nhận `BaseRendererProps` từ `types/renderer-types.ts`

### 4. Permission Handling
- Khai báo `permissions` trong `TAG_REGISTRY` (approval/fullAccess)
- Frontend orchestration (`useToolActions.ts`) kiểm tra permission trước khi chạy tool

### 5. Documentation
- Document trong `prompts/tools-reference.ts` cho AI
- Bao gồm parameters, return format, và ví dụ XML

---

## 🐛 Common Issues

### Tool không được AI gọi
✅ Check: `tools-reference.ts` có đúng format không?
✅ Check: Tool type có được parse trong `ResponseParser.ts` không?

### Tool execute nhưng không hiển thị
✅ Check: Renderer có được export trong `renderers/index.ts` không?
✅ Check: TagRouter có case cho tool type đó không?
✅ Check: `TAG_REGISTRY` có entry cho tool không?

### Parse params bị sai
✅ Check: Parser function có extract đúng XML tags không?
✅ Check: AI response có đúng format không? (log trong ResponseParser)

### Executor không nhận được kết quả
✅ Check: `extensionService.postMessage()` command có đúng không?
✅ Check: `messageDispatcher.register()` requestId có match với extension response không?

### Output hiển thị sai
✅ Check: Block component parse output format đúng không?
✅ Check: Renderer pass đúng props cho Block không?

---

## 📚 Ví dụ: Thêm Tool `git_status` (Display-only Tool)

### 1. Parser
```typescript
// services/parsers/GitStatusParser.ts
import { extractParamValue } from "../../utils/ToolParser";

export interface GitStatusParams {
  // No params
}

export const parseGitStatus = (innerContent: string): GitStatusParams => {
  return {};
};
```

### 2. Constants
```typescript
// constants/constants.ts — thêm vào TAG_REGISTRY
git_status: {
  id: "git_status",
  title: "GIT STATUS",
  category: "tool",
  // timeout, permissions, features...
},
```

### 3. Response Parser
```typescript
// services/ResponseParser.ts
case "git_status": {
  const params = parseGitStatus(innerContent || "");
  action = { type: "git_status" as const, params, rawXml };
  break;
}
```

### 4. Renderer
```typescript
// renderers/GitStatusRenderer.tsx
export const GitStatusRenderer: React.FC<BaseRendererProps> = ({ ... }) => {
  // Render UI
};
```

### 5. Renderer Index
```typescript
// renderers/index.ts
export { GitGitStatusRenderer } from "./GitStatusRenderer";
```

### 6. TagRouter
```typescript
// TagRouter.tsx
case "git_status":
  return <GitStatusRenderer key={key} {...baseProps} />;
```

### 7. Prompts
```typescript
// prompts/tools-reference.ts
<git_status></git_status> — hiển thị trạng thái git của workspace.
```

> Lưu ý: `git_status` và `commit_message` là display-only tools — không cần executor, `getExecutor()` trả `null` cho các tool này.

---

## 🔍 Debugging Tips

### Enable Logging
```typescript
// Trong Executor
console.log("[ToolName] action:", action);
console.log("[ToolName] result:", result);

// Trong Parser
console.log("[Parser] Raw XML:", innerContent);
console.log("[Parser] Parsed params:", params);
```

### Check Tool Flow
1. AI generates XML → Check trong chat raw message
2. `parseAIResponse` extracts → Check `action` object
3. Parser parses → Check `params` object
4. `getExecutor()` factory → Check executor instance
5. Executor gửi message → Check extension backend logs
6. Executor nhận kết quả → Check `messageDispatcher` callback
7. Renderer hiển thị → Check renderer props

---

## 📖 Related Documentation

- **Types:** `src/webview-ui/src/features/chat/types/`
- **Utils:** `src/webview-ui/src/features/chat/utils/`
- **Hooks:** `src/webview-ui/src/features/chat/hooks/`
- **Services:** `src/webview-ui/src/features/chat/services/`

---

Khi làm việc với tools, luôn luôn:
✅ Follow naming conventions
✅ Update tất cả các files liên quan
✅ Khai báo đầy đủ trong `TAG_REGISTRY`
✅ Document trong `prompts/tools-reference.ts`
✅ Keep separation of concerns
✅ Test thoroughly

Good luck! 🚀