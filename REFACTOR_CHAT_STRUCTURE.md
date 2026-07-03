# REFACTOR: Cấu trúc thư mục Chat

## 1. Vấn đề hiện tại

Thư mục `src/webview-ui/src/features/chat/tags/` đang chứa **quá nhiều trách nhiệm**:

```
tags/
├── code/              # UI + parser + types + constants
├── commit_message/    # UI + parser + types + constants + CSS
├── delete_file/       # parser + executor + types + constants
├── delete_folder/     # parser + executor + types + constants
├── git_diff/          # UI + parser + executor + types + constants + CSS
├── git_status/        # UI + parser + renderer + types + constants + CSS
├── grep/              # UI + parser + executor + types + constants
├── list_files/        # parser + executor + types + constants
├── markdown/          # UI + parser + types + constants + CSS
├── move_file/         # parser + executor + types + constants
├── question/          # UI + parser + renderer + types + constants
├── read_file/         # parser + executor + types + constants
├── replace_in_file/   # parser + executor + types + constants
├── run_command/       # UI + parser + executor + renderer + types + constants + CSS
├── thinking/          # parser + renderer + types + constants
└── write_to_file/     # parser + executor + types + constants
```

**Vấn đề chính**:
1. UI (React components) lẫn với business logic (parsers, executors)
2. CSS files nằm rải rác trong từng thư mục con, khó quản lý
3. Constants và types nằm rải rác, khó tái sử dụng
4. Không tách biệt rõ ràng các tầng: presentation, logic, data
5. Khi thêm tool mới, phải tạo cả UI + parser + executor trong cùng 1 folder

---

## 2. Nguyên tắc refactor

- **Giữ nguyên**: `components/`, `utils/`, `services/`, `types/`, `hooks/`
- **Loại bỏ**: folder `tags/` — phân tách các thành phần vào đúng vị trí
- **Mỗi file một trách nhiệm, mỗi folder một tầng**:
  - `components/blocks/` → UI components (mỗi tool có 1 folder con)
  - `services/parsers/` → business logic (parsers)
  - `utils/` → helper functions
  - `types/` → TypeScript definitions
  - `constants/` → configuration constants

---

## 3. Cấu trúc mới

```
src/webview-ui/src/features/chat/
├── components/
│   ├── blocks/                      # ✅ giữ nguyên + thêm các folder con
│   │   ├── ErrorBlock.css           # ✅ giữ nguyên
│   │   ├── ErrorBlock.tsx           # ✅ giữ nguyên
│   │   ├── FileStreamingBlock.css   # ✅ giữ nguyên
│   │   ├── FileStreamingBlock.tsx   # ✅ giữ nguyên
│   │   ├── RichtextBlock.css        # ✅ giữ nguyên
│   │   ├── RichtextBlock.tsx        # ✅ giữ nguyên
│   │   │
│   │   ├── markdown/                # 🆕 từ tags/markdown/
│   │   │   ├── MarkdownBlock.css
│   │   │   └── MarkdownBlock.tsx
│   │   │
│   │   ├── commit_message/          # 🆕 từ tags/commit_message/
│   │   │   ├── CommitMessageBlock.css
│   │   │   └── CommitMessageBlock.tsx
│   │   │
│   │   ├── git_diff/                # 🆕 từ tags/git_diff/
│   │   │   ├── GitDiffBlock.css
│   │   │   └── GitDiffBlock.tsx
│   │   │
│   │   ├── git_status/              # 🆕 từ tags/git_status/
│   │   │   ├── GitStatusBlock.css
│   │   │   └── GitStatusBlock.tsx
│   │   │
│   │   ├── grep/                    # 🆕 từ tags/grep/GrepBlock.tsx
│   │   │   └── GrepBlock.tsx        # (không có CSS riêng)
│   │   │
│   │   ├── question/                # 🆕 từ tags/question/
│   │   │   └── QuestionBlock.tsx    # từ QuestionAnswerBlock.tsx
│   │   │
│   │   ├── run_command/             # 🆕 từ tags/run_command/
│   │   │   ├── RunCommandBlock.css  # từ TerminalBlock.css
│   │   │   └── RunCommandBlock.tsx  # từ TerminalBlock.tsx + RunCommandRenderer.tsx
│   │   │
│   │   ├── thinking/                # 🆕 từ tags/thinking/
│   │   │   └── ThinkingBlock.tsx    # từ ThinkingRenderer.tsx
│   │   │
│   │   └── code/                    # 🆕 từ tags/code/
│   │       └── CodeBlock.tsx        # từ CodeRenderer.tsx
│   │
│   ├── messages/                    # ✅ giữ nguyên
│   │   ├── AIMessageBox.tsx
│   │   ├── MessageBox.tsx
│   │   ├── ProcessingIndicator.tsx
│   │   └── UserMessageBox.tsx
│   │
│   ├── tools/                       # ✅ giữ nguyên
│   │   ├── ExecuteButton.tsx
│   │   ├── FileToolRenderer.tsx
│   │   ├── GitToolRenderer.tsx
│   │   ├── index.tsx
│   │   ├── TerminalToolRenderer.tsx
│   │   ├── ToolHeader.tsx
│   │   └── ToolRouter.tsx
│   │
│   ├── ChatBody.tsx                 # ✅ giữ nguyên
│   ├── ChatErrorBoundary.tsx        # ✅ giữ nguyên
│   ├── ChatFooter.tsx               # ✅ giữ nguyên
│   ├── ChatHeader.tsx               # ✅ giữ nguyên
│   └── SearchBar.tsx                # ✅ giữ nguyên
│
├── services/
│   ├── parsers/                     # ✅ giữ nguyên + thêm parser cho tool
│   │   ├── TagClosingFinder.ts
│   │   ├── TagNormalizer.ts
│   │   ├── ToolParser.ts
│   │   ├── CodeParser.ts                # từ tags/code/CodeParser.ts
│   │   ├── CommitMessageParser.ts       # từ tags/commit_message/CommitMessageParser.ts
│   │   ├── DeleteFileParser.ts          # từ tags/delete_file/DeleteFileParser.ts
│   │   ├── DeleteFolderParser.ts        # từ tags/delete_folder/DeleteFolderParser.ts
│   │   ├── GitDiffParser.ts             # từ tags/git_diff/GitDiffParser.ts
│   │   ├── GitStatusParser.ts           # từ tags/git_status/GitStatusParser.ts
│   │   ├── GrepParser.ts                # từ tags/grep/GrepParser.ts
│   │   ├── ListFilesParser.ts           # từ tags/list_files/ListFilesParser.ts
│   │   ├── MarkdownParser.ts            # từ tags/markdown/MarkdownParser.ts
│   │   ├── MoveFileParser.ts            # từ tags/move_file/MoveFileParser.ts
│   │   ├── QuestionParser.ts            # từ tags/question/QuestionParser.ts
│   │   ├── ReadFileParser.ts            # từ tags/read_file/ReadFileParser.ts
│   │   ├── ReplaceInFileParser.ts       # từ tags/replace_in_file/ReplaceInFileParser.ts
│   │   ├── RunCommandParser.ts          # từ tags/run_command/RunCommandParser.ts
│   │   ├── ThinkingParser.ts            # từ tags/thinking/ThinkingParser.ts
│   │   └── WriteToFileParser.ts         # từ tags/write_to_file/WriteToFileParser.ts
│   │
│   ├── tool-executors/              # 🆕 logic thực thi tool (gọi API)
│   │   ├── DeleteFileExecutor.ts       # từ tags/delete_file/DeleteFileExecutor.ts
│   │   ├── DeleteFolderExecutor.ts     # từ tags/delete_folder/DeleteFolderExecutor.ts
│   │   ├── GitDiffExecutor.ts          # từ tags/git_diff/GitDiffExecutor.ts
│   │   ├── GrepExecutor.ts             # từ tags/grep/GrepExecutor.ts
│   │   ├── ListFilesExecutor.ts        # từ tags/list_files/ListFilesExecutor.ts
│   │   ├── MoveFileExecutor.ts         # từ tags/move_file/MoveFileExecutor.ts
│   │   ├── ReadFileExecutor.ts         # từ tags/read_file/ReadFileExecutor.ts
│   │   ├── ReplaceInFileExecutor.ts    # từ tags/replace_in_file/ReplaceInFileExecutor.ts
│   │   ├── RunCommandExecutor.ts       # từ tags/run_command/RunCommandExecutor.ts
│   │   └── WriteToFileExecutor.ts      # từ tags/write_to_file/WriteToFileExecutor.ts
│   │
│   ├── ConversationCache.ts        # ✅ giữ nguyên
│   ├── ConversationService.ts      # ✅ giữ nguyên
│   └── ResponseParser.ts           # ✅ giữ nguyên
│
├── utils/                           # ✅ giữ nguyên
│   ├── fileUtils.ts
│   ├── pathUtils.ts
│   ├── permissionUtils.ts
│   └── toolUtils.ts
│
├── types/                           # ✅ giữ nguyên + thêm tool types
│   ├── chat.ts
│   ├── message.ts
│   ├── workspace.ts
│   └── tool-types.ts                # 🆕 gộp từ tags/*/types.ts
│
├── constants/                       # ✅ giữ nguyên + thêm tool constants
│   └── constants.ts                 # gộp từ tags/*/constants.ts + variants.ts
│
├── hooks/                           # ✅ giữ nguyên
│   ├── useBrowserSession.ts
│   ├── useChatLLM.ts
│   ├── useCollapseSections.ts
│   ├── useConversationRestore.ts
│   ├── useDraftManagement.ts
│   ├── useFileUpload.ts
│   ├── useGitOperations.ts
│   ├── useMentionSystem.ts
│   ├── useScrollBehavior.ts
│   ├── useTerminalPolling.ts
│   ├── useToolActions.ts
│   ├── useToolExecution.ts
│   └── useWorkspaceData.ts
│
├── index.tsx                        # ✅ giữ nguyên
└── prompts/                         # ✅ giữ nguyên (không thuộc phạm vi refactor)
    ├── access-mode.ts
    ├── commit-message.ts
    ├── constraints.ts
    ├── examples.ts
    ├── identity.ts
    ├── index.ts
    ├── persistent-rules.ts
    ├── system-context.ts
    ├── tools-reference.ts
    └── workflow.ts
```

---

## 4. Chi tiết di chuyển

### 4.1. UI Components → `components/blocks/` (có folder con)

| Thư mục cũ | File cũ | File mới |
|------------|---------|----------|
| `tags/code/` | `CodeRenderer.tsx` | `components/blocks/code/CodeBlock.tsx` |
| `tags/commit_message/` | `CommitMessageBlock.css` | `components/blocks/commit_message/CommitMessageBlock.css` |
| `tags/commit_message/` | `CommitMessageBlock.tsx` | `components/blocks/commit_message/CommitMessageBlock.tsx` |
| `tags/commit_message/` | `CommitMessageRenderer.tsx` | *(gộp vào CommitMessageBlock.tsx)* |
| `tags/git_diff/` | `GitDiffBlock.css` | `components/blocks/git_diff/GitDiffBlock.css` |
| `tags/git_diff/` | `GitDiffBlock.tsx` | `components/blocks/git_diff/GitDiffBlock.tsx` |
| `tags/git_diff/` | `GitDiffRenderer.tsx` | *(gộp vào GitDiffBlock.tsx)* |
| `tags/git_status/` | `GitStatusBlock.css` | `components/blocks/git_status/GitStatusBlock.css` |
| `tags/git_status/` | `GitStatusBlock.tsx` | `components/blocks/git_status/GitStatusBlock.tsx` |
| `tags/git_status/` | `GitStatusRenderer.tsx` | *(gộp vào GitStatusBlock.tsx)* |
| `tags/grep/` | `GrepBlock.tsx` | `components/blocks/grep/GrepBlock.tsx` |
| `tags/markdown/` | `MarkdownBlock.css` | `components/blocks/markdown/MarkdownBlock.css` |
| `tags/markdown/` | `MarkdownBlock.tsx` | `components/blocks/markdown/MarkdownBlock.tsx` |
| `tags/question/` | `QuestionAnswerBlock.tsx` | `components/blocks/question/QuestionBlock.tsx` |
| `tags/question/` | `QuestionRenderer.tsx` | *(gộp vào QuestionBlock.tsx)* |
| `tags/run_command/` | `RunCommandRenderer.tsx` | `components/blocks/run_command/RunCommandBlock.tsx` |
| `tags/run_command/` | `TerminalBlock.css` | `components/blocks/run_command/RunCommandBlock.css` |
| `tags/run_command/` | `TerminalBlock.tsx` | *(gộp vào RunCommandBlock.tsx)* |
| `tags/thinking/` | `ThinkingRenderer.tsx` | `components/blocks/thinking/ThinkingBlock.tsx` |

**Lưu ý về CSS**:
- CSS files được đặt **cùng folder** với component sử dụng nó
- Giữ nguyên tên file CSS (VD: `CommitMessageBlock.css`)
- Cập nhật import CSS trong file component tương ứng

### 4.2. Parsers → `services/parsers/`

| Thư mục cũ | File cũ | File mới |
|------------|---------|----------|
| `tags/code/` | `CodeParser.ts` | `services/parsers/CodeParser.ts` |
| `tags/commit_message/` | `CommitMessageParser.ts` | `services/parsers/CommitMessageParser.ts` |
| `tags/delete_file/` | `DeleteFileParser.ts` | `services/parsers/DeleteFileParser.ts` |
| `tags/delete_folder/` | `DeleteFolderParser.ts` | `services/parsers/DeleteFolderParser.ts` |
| `tags/git_diff/` | `GitDiffParser.ts` | `services/parsers/GitDiffParser.ts` |
| `tags/git_status/` | `GitStatusParser.ts` | `services/parsers/GitStatusParser.ts` |
| `tags/grep/` | `GrepParser.ts` | `services/parsers/GrepParser.ts` |
| `tags/list_files/` | `ListFilesParser.ts` | `services/parsers/ListFilesParser.ts` |
| `tags/markdown/` | `MarkdownParser.ts` | `services/parsers/MarkdownParser.ts` |
| `tags/move_file/` | `MoveFileParser.ts` | `services/parsers/MoveFileParser.ts` |
| `tags/question/` | `QuestionParser.ts` | `services/parsers/QuestionParser.ts` |
| `tags/read_file/` | `ReadFileParser.ts` | `services/parsers/ReadFileParser.ts` |
| `tags/replace_in_file/` | `ReplaceInFileParser.ts` | `services/parsers/ReplaceInFileParser.ts` |
| `tags/run_command/` | `RunCommandParser.ts` | `services/parsers/RunCommandParser.ts` |
| `tags/thinking/` | `ThinkingParser.ts` | `services/parsers/ThinkingParser.ts` |
| `tags/write_to_file/` | `WriteToFileParser.ts` | `services/parsers/WriteToFileParser.ts` |

### 4.3. Executors → `services/tool-executors/`

| Thư mục cũ | File cũ | File mới |
|------------|---------|----------|
| `tags/delete_file/` | `DeleteFileExecutor.ts` | `services/tool-executors/DeleteFileExecutor.ts` |
| `tags/delete_folder/` | `DeleteFolderExecutor.ts` | `services/tool-executors/DeleteFolderExecutor.ts` |
| `tags/git_diff/` | `GitDiffExecutor.ts` | `services/tool-executors/GitDiffExecutor.ts` |
| `tags/grep/` | `GrepExecutor.ts` | `services/tool-executors/GrepExecutor.ts` |
| `tags/list_files/` | `ListFilesExecutor.ts` | `services/tool-executors/ListFilesExecutor.ts` |
| `tags/move_file/` | `MoveFileExecutor.ts` | `services/tool-executors/MoveFileExecutor.ts` |
| `tags/read_file/` | `ReadFileExecutor.ts` | `services/tool-executors/ReadFileExecutor.ts` |
| `tags/replace_in_file/` | `ReplaceInFileExecutor.ts` | `services/tool-executors/ReplaceInFileExecutor.ts` |
| `tags/run_command/` | `RunCommandExecutor.ts` | `services/tool-executors/RunCommandExecutor.ts` |
| `tags/write_to_file/` | `WriteToFileExecutor.ts` | `services/tool-executors/WriteToFileExecutor.ts` |

**Lưu ý về Executor**:
- Executor hiện tại đang được implement trong `useToolExecution.ts` qua hàm `executeSingleAction`
- Các file executor trong `tags/*/` nếu không dùng → có thể xóa

### 4.4. Constants → `constants/constants.ts` (gộp)

**Các file cần gộp**:
- `tags/code/constants.ts`
- `tags/commit_message/constants.ts`
- `tags/delete_file/constants.ts`
- `tags/delete_file/variants.ts`
- `tags/delete_folder/constants.ts`
- `tags/delete_folder/variants.ts`
- `tags/git_diff/constants.ts`
- `tags/git_diff/variants.ts`
- `tags/git_status/constants.ts`
- `tags/grep/constants.ts`
- `tags/grep/variants.ts`
- `tags/list_files/constants.ts`
- `tags/list_files/variants.ts`
- `tags/markdown/constants.ts`
- `tags/move_file/constants.ts`
- `tags/move_file/variants.ts`
- `tags/question/constants.ts`
- `tags/read_file/constants.ts`
- `tags/read_file/variants.ts`
- `tags/replace_in_file/constants.ts`
- `tags/replace_in_file/variants.ts`
- `tags/run_command/constants.ts`
- `tags/run_command/variants.ts`
- `tags/thinking/constants.ts`
- `tags/write_to_file/constants.ts`
- `tags/write_to_file/variants.ts`

**Cấu trúc mới trong `constants/constants.ts`**:
```typescript
// ===== TOOL TYPES =====
export type ToolType = 
  | "read_file"
  | "write_to_file"
  | "replace_in_file"
  | "list_files"
  | "grep"
  | "delete_file"
  | "delete_folder"
  | "move_file"
  | "run_command"
  | "git_status"
  | "commit_message"
  | "git_diff";

// ===== TOOL VARIANTS =====
export const TOOL_VARIANTS: Record<ToolType, string[]> = {
  read_file: ["readfile", "read_files"],
  write_to_file: ["write_file", "writefile", "create_file"],
  replace_in_file: ["replace_file", "edit_file"],
  list_files: ["list_file", "ls"],
  grep: ["search", "find"],
  delete_file: ["remove_file", "rm"],
  delete_folder: ["remove_folder", "rmdir"],
  move_file: ["mv", "rename_file"],
  run_command: ["exec", "execute", "shell"],
  git_status: ["git status"],
  commit_message: ["commit", "git commit"],
  git_diff: ["diff", "git diff"],
};

// ===== TOOL LABELS =====
export const TOOL_LABELS: Record<ToolType, string> = { ... };

// ===== TOOL COLORS =====
export const TOOL_COLORS: Record<ToolType, string> = { ... };

// ===== CLICKABLE TOOLS =====
export const CLICKABLE_TOOLS: ToolType[] = [ ... ];
```

### 4.5. Types → `types/tool-types.ts` (gộp)

**Các file cần gộp**:
- `tags/code/types.ts`
- `tags/commit_message/types.ts`
- `tags/delete_file/types.ts`
- `tags/delete_folder/types.ts`
- `tags/git_diff/types.ts`
- `tags/git_status/types.ts`
- `tags/grep/types.ts`
- `tags/list_files/types.ts`
- `tags/markdown/types.ts`
- `tags/move_file/types.ts`
- `tags/question/types.ts`
- `tags/read_file/types.ts`
- `tags/replace_in_file/types.ts`
- `tags/run_command/types.ts`
- `tags/thinking/types.ts`
- `tags/write_to_file/types.ts`

**Cấu trúc mới trong `types/tool-types.ts`**:
```typescript
import { ToolType } from "../constants/constants";

// ===== BASE TOOL PARAMS =====
export interface BaseToolParams {
  file_path?: string;
  path?: string;
  folder_path?: string;
}

// ===== READ FILE =====
export interface ReadFileParams extends BaseToolParams {
  start_line?: number;
  end_line?: number;
}

// ===== WRITE TO FILE =====
export interface WriteToFileParams extends BaseToolParams {
  content: string;
}

// ===== REPLACE IN FILE =====
export interface ReplaceInFileParams extends BaseToolParams {
  diff: string;
}

// ===== LIST FILES =====
export interface ListFilesParams {
  path: string;
  folder_path?: string;
  depth?: number;
  recursive?: boolean;
  type?: "files" | "folders" | "all";
}

// ===== GREP =====
export interface GrepParams {
  search_term: string;
  file_path?: string;
  folder_path?: string;
}

// ... các interface khác tương tự
```

### 4.6. Các file index.ts → xóa

Tất cả file `index.ts` trong các thư mục con của `tags/` sẽ được **xóa**.

---

## 5. Cập nhật Import Paths

### 5.1. Trong `ResponseParser.ts`

**Trước**:
```typescript
import { parseReadFile } from "../tags/read_file";
import { parseWriteToFile } from "../tags/write_to_file";
import { parseReplaceInFile } from "../tags/replace_in_file";
import { parseListFiles } from "../tags/list_files/ListFilesParser";
import { parseGrep } from "../tags/grep/GrepParser";
// ...
```

**Sau**:
```typescript
import { parseReadFile } from "./parsers/ReadFileParser";
import { parseWriteToFile } from "./parsers/WriteToFileParser";
import { parseReplaceInFile } from "./parsers/ReplaceInFileParser";
import { parseListFiles } from "./parsers/ListFilesParser";
import { parseGrep } from "./parsers/GrepParser";
// ...
```

### 5.2. Trong `TagNormalizer.ts`

**Trước**:
```typescript
import { READ_FILE_VARIANTS } from "../../tags/read_file/variants";
import { WRITE_TO_FILE_VARIANTS } from "../../tags/write_to_file/variants";
// ...
```

**Sau**:
```typescript
import { TOOL_VARIANTS } from "../../constants/constants";
```

### 5.3. Trong `AIMessageBox.tsx`

**Trước**:
```typescript
import { MarkdownBlock } from "../../tags/markdown";
import QuestionAnswerBlock from "../../tags/question/QuestionAnswerBlock";
```

**Sau**:
```typescript
import { MarkdownBlock } from "../blocks/markdown/MarkdownBlock";
import { QuestionBlock } from "../blocks/question/QuestionBlock";
```

### 5.4. Trong `FileToolRenderer.tsx`

**Trước**:
```typescript
import { GrepBlock } from "../../tags/grep";
```

**Sau**:
```typescript
import { GrepBlock } from "../blocks/grep/GrepBlock";
```

### 5.5. Trong `ToolRouter.tsx`

**Trước**:
```typescript
import { GitDiffBlock } from "../../tags/git_diff";
```

**Sau**:
```typescript
import { GitDiffBlock } from "../blocks/git_diff/GitDiffBlock";
```

### 5.6. Trong `ChatBody.tsx`

**Trước**:
```typescript
import GitStatusBlock from "./tags/git_status/GitStatusBlock";
import { RichtextBlock } from "./components/blocks/RichtextBlock";
```

**Sau**:
```typescript
import { GitStatusBlock } from "./components/blocks/git_status/GitStatusBlock";
import { RichtextBlock } from "./components/blocks/RichtextBlock";
```

### 5.7. Trong `useGitOperations.ts`

**Trước**:
```typescript
import { parseGitStatusOutput } from "../tags/git_status/parseGitStatus";
```

**Sau**:
```typescript
import { parseGitStatusOutput } from "../utils/gitUtils";
```

### 5.8. Trong `useToolExecution.ts`

**Trước**:
```typescript
import { getPermissionDecision } from "../utils/permissionUtils";
```

**Sau**:
```typescript
// giữ nguyên (utils/ vẫn giữ nguyên)
```

---

## 6. Các file cần xóa

Sau khi di chuyển và gộp, xóa các file/folder sau:

```
tags/                                           # 🗑️ xóa toàn bộ folder
src/webview-ui/src/features/chat/services/parsers/ParamExtractor.ts  # 🗑️ đã được thay thế
src/webview-ui/src/features/chat/components/blocks/HtmlBlock.tsx      # 🗑️ không dùng
src/webview-ui/src/features/chat/components/blocks/blocks-common.css  # 🗑️ không dùng
src/webview-ui/OPTIMIZATION_REPORT.md          # 🗑️ không cần
```

---

## 7. Các bước thực hiện

### Bước 1: Tạo folder mới
```bash
cd src/webview-ui/src/features/chat
mkdir -p components/blocks/markdown
mkdir -p components/blocks/commit_message
mkdir -p components/blocks/git_diff
mkdir -p components/blocks/git_status
mkdir -p components/blocks/grep
mkdir -p components/blocks/question
mkdir -p components/blocks/run_command
mkdir -p components/blocks/thinking
mkdir -p components/blocks/code
mkdir -p services/tool-executors
```

### Bước 2: Di chuyển UI components vào `components/blocks/`

```bash
# Markdown
git mv tags/markdown/MarkdownBlock.css components/blocks/markdown/
git mv tags/markdown/MarkdownBlock.tsx components/blocks/markdown/

# Commit Message
git mv tags/commit_message/CommitMessageBlock.css components/blocks/commit_message/
git mv tags/commit_message/CommitMessageBlock.tsx components/blocks/commit_message/
git mv tags/commit_message/CommitMessageRenderer.tsx components/blocks/commit_message/  # gộp vào

# Git Diff
git mv tags/git_diff/GitDiffBlock.css components/blocks/git_diff/
git mv tags/git_diff/GitDiffBlock.tsx components/blocks/git_diff/
git mv tags/git_diff/GitDiffRenderer.tsx components/blocks/git_diff/  # gộp vào

# Git Status
git mv tags/git_status/GitStatusBlock.css components/blocks/git_status/
git mv tags/git_status/GitStatusBlock.tsx components/blocks/git_status/
git mv tags/git_status/GitStatusRenderer.tsx components/blocks/git_status/  # gộp vào

# Grep
git mv tags/grep/GrepBlock.tsx components/blocks/grep/

# Question
git mv tags/question/QuestionAnswerBlock.tsx components/blocks/question/QuestionBlock.tsx
git mv tags/question/QuestionRenderer.tsx components/blocks/question/  # gộp vào

# Run Command
git mv tags/run_command/RunCommandRenderer.tsx components/blocks/run_command/RunCommandBlock.tsx
git mv tags/run_command/TerminalBlock.css components/blocks/run_command/RunCommandBlock.css
git mv tags/run_command/TerminalBlock.tsx components/blocks/run_command/  # gộp vào

# Thinking
git mv tags/thinking/ThinkingRenderer.tsx components/blocks/thinking/ThinkingBlock.tsx

# Code
git mv tags/code/CodeRenderer.tsx components/blocks/code/CodeBlock.tsx
```

### Bước 3: Di chuyển parsers
```bash
# Di chuyển tất cả parsers vào services/parsers/
git mv tags/code/CodeParser.ts services/parsers/
git mv tags/commit_message/CommitMessageParser.ts services/parsers/
git mv tags/delete_file/DeleteFileParser.ts services/parsers/
git mv tags/delete_folder/DeleteFolderParser.ts services/parsers/
git mv tags/git_diff/GitDiffParser.ts services/parsers/
git mv tags/git_status/GitStatusParser.ts services/parsers/
git mv tags/grep/GrepParser.ts services/parsers/
git mv tags/list_files/ListFilesParser.ts services/parsers/
git mv tags/markdown/MarkdownParser.ts services/parsers/
git mv tags/move_file/MoveFileParser.ts services/parsers/
git mv tags/question/QuestionParser.ts services/parsers/
git mv tags/read_file/ReadFileParser.ts services/parsers/
git mv tags/replace_in_file/ReplaceInFileParser.ts services/parsers/
git mv tags/run_command/RunCommandParser.ts services/parsers/
git mv tags/thinking/ThinkingParser.ts services/parsers/
git mv tags/write_to_file/WriteToFileParser.ts services/parsers/
```

### Bước 4: Di chuyển executors (nếu dùng)
```bash
# Di chuyển executors vào services/tool-executors/
git mv tags/delete_file/DeleteFileExecutor.ts services/tool-executors/
git mv tags/delete_folder/DeleteFolderExecutor.ts services/tool-executors/
git mv tags/git_diff/GitDiffExecutor.ts services/tool-executors/
git mv tags/grep/GrepExecutor.ts services/tool-executors/
git mv tags/list_files/ListFilesExecutor.ts services/tool-executors/
git mv tags/move_file/MoveFileExecutor.ts services/tool-executors/
git mv tags/read_file/ReadFileExecutor.ts services/tool-executors/
git mv tags/replace_in_file/ReplaceInFileExecutor.ts services/tool-executors/
git mv tags/run_command/RunCommandExecutor.ts services/tool-executors/
git mv tags/write_to_file/WriteToFileExecutor.ts services/tool-executors/
```

### Bước 5: Gộp constants
- Mở `constants/constants.ts`
- Gộp tất cả `constants.ts` và `variants.ts` từ các thư mục tags/
- Cập nhật `TagNormalizer.ts` để dùng `TOOL_VARIANTS` từ constants/

### Bước 6: Gộp types
- Tạo `types/tool-types.ts`
- Gộp tất cả `types.ts` từ các thư mục tags/
- Cập nhật các file import types

### Bước 7: Di chuyển các file lẻ
```bash
# Di chuyển parseGitStatus.ts vào utils/
git mv tags/git_status/parseGitStatus.ts utils/gitUtils.ts

# Di chuyển grepFormatter.ts vào utils/
git mv tags/grep/grepFormatter.ts utils/grepFormatter.ts
```

### Bước 8: Cập nhật imports trong các file sử dụng
- Tìm kiếm tất cả import từ `../tags/*` và cập nhật
- Sử dụng IDE "Find in Files" để tìm và thay thế

### Bước 9: Xóa folder tags/
```bash
rm -rf tags/
```

### Bước 10: Xóa các file không cần thiết
```bash
rm src/webview-ui/src/features/chat/services/parsers/ParamExtractor.ts
rm src/webview-ui/src/features/chat/components/blocks/HtmlBlock.tsx
rm src/webview-ui/src/features/chat/components/blocks/blocks-common.css
rm src/webview-ui/OPTIMIZATION_REPORT.md
```

---

## 8. Check List sau refactor

- [ ] Tất cả folder con trong `components/blocks/` đã được tạo
- [ ] Tất cả CSS files đã được di chuyển và import đúng
- [ ] Tất cả imports đã được cập nhật
- [ ] `ResponseParser.ts` import đúng parsers từ `services/parsers/`
- [ ] `TagNormalizer.ts` import `TOOL_VARIANTS` từ `constants/constants.ts`
- [ ] `AIMessageBox.tsx` import blocks từ `components/blocks/`
- [ ] `FileToolRenderer.tsx` import blocks từ `components/blocks/`
- [ ] `ToolRouter.tsx` import blocks từ `components/blocks/`
- [ ] `ChatBody.tsx` import blocks từ `components/blocks/`
- [ ] `useGitOperations.ts` import utils từ `utils/`
- [ ] Folder `tags/` đã được xóa
- [ ] Không còn import nào từ `../tags/*`
- [ ] `tsc --noEmit` chạy thành công (không lỗi type)
- [ ] App chạy và hiển thị đúng UI
- [ ] Các tool vẫn hoạt động bình thường---

## 9. Rủi ro & Cách xử lý

| Rủi ro | Cách xử lý |
|--------|-----------|
| **Breaking changes** | Sử dụng `git mv` để giữ lịch sử, cập nhật tất cả imports cùng lúc |
| **Circular dependencies** | Kiểm tra bằng `npx madge --circular src/webview-ui/src/features/chat/` |
| **CSS bị hỏng** | Kiểm tra từng component sau khi di chuyển CSS |
| **Type errors** | Chạy `tsc --noEmit` để phát hiện lỗi type |
| **Runtime errors** | Chạy app và kiểm tra từng tool |
| **Test fails** | Chạy test và sửa lỗi |

---

## 10. Thời gian ước tính

| Giai đoạn | Thời gian | Chi tiết |
|----------|----------|----------|
| Tạo folder + di chuyển file | 45 phút | Di chuyển ~50 file với `git mv` |
| Gộp constants | 30 phút | Gộp ~25 file constants + variants |
| Gộp types | 30 phút | Gộp ~16 file types |
| Cập nhật imports | 2 giờ | Cập nhật ~30 file import paths |
| Kiểm tra + fix lỗi | 1.5 giờ | Chạy type check, test, fix lỗi |
| **Tổng** | **~5 giờ** | |

---

## 11. Kết luận

Refactor này giúp cấu trúc code rõ ràng hơn, dễ bảo trì và mở rộng khi thêm tool mới.

**Nguyên tắc chính**:
> **Mỗi file một trách nhiệm, mỗi folder một tầng.**

| Folder | Trách nhiệm | Chứa gì |
|--------|------------|---------|
| `components/blocks/` | UI Blocks | Components + CSS (mỗi tool 1 folder con) |
| `services/` | Logic | Parsers, executors, services |
| `utils/` | Helper | Functions dùng chung |
| `types/` | Data | TypeScript definitions |
| `constants/` | Config | Constants, configs |
| `hooks/` | React hooks | Custom hooks |

**Khi thêm tool mới, chỉ cần**:
1. Tạo parser → `services/parsers/NewToolParser.ts`
2. Tạo block → `components/blocks/new_tool/NewToolBlock.tsx` + CSS
3. Thêm vào constants/ và types/
4. Cập nhật `ResponseParser.ts` và `TagNormalizer.ts`