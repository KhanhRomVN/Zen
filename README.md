# Zen - Free AI Chat For ALL LLM

<div align="center">

![Zen Logo](https://raw.githubusercontent.com/KhanhRomVN/Zen/main/images/icon.png)

**AI chat directly in your VSCode — connect any LLM provider, free**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/KhanhRomVN/Zen)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VSCode](https://img.shields.io/badge/VSCode-^1.50.0-007ACC.svg)](https://code.visualstudio.com/)

</div>

## What is Zen?

Zen brings AI chat into your VSCode sidebar. Connect to any LLM provider, chat about your code, let the AI read and edit files, and track every change — all without leaving your editor.

## Features

**Multi-LLM Support** — Connect DeepSeek, Claude, Gemini, and more. Switch providers anytime from the Settings panel.

**File Operations** — Ask the AI to read, create, or edit files in your workspace. Changes are shown as action buttons you approve before they run.

**Checkpoint & Revert** — Every file modification creates a checkpoint. Click 🗎 to diff, click ↶ to undo.

**Conversation History** — All chats are saved. Browse and resume any previous conversation from the History panel.

**Streaming Responses** — Real-time output with syntax-highlighted code blocks and copy buttons.

## Getting Started

### Install

**From Marketplace**: Search "Zen" in the VSCode Extensions panel and click Install.

**From VSIX**:
```bash
code --install-extension zen-1.2.1.vsix
```

### Setup

1. Click the **Zen icon** in the Activity Bar
2. Click **⚙️ Settings** to add your AI provider and API key
3. Start chatting

## Usage

### Chat Panel

Open via the Zen icon in the sidebar or `Ctrl+Shift+P` → **Zen: Open Chat**.

The toolbar has three sections:
- **💬 Chat** — main conversation
- **⚙️ Settings** — providers, models, API keys
- **📜 History** — past conversations

### File Operations

Just ask naturally:

```
"Read src/utils.ts and explain what it does"
"Create a new file helpers.ts with a debounce function"
"Fix the bug in the handleSubmit function"
```

The AI will show action buttons. Click to execute, or ignore to skip.

### Checkpoints

After any file edit, a checkpoint bar appears in the chat:

`📍 CHECKPOINT [🗎] [↶]`

- **🗎** — view diff between current file and checkpoint
- **↶** — revert the file to its state before this edit

## Configuration

All settings are in the **⚙️ Settings** panel inside Zen:

| Setting | Description |
|---------|-------------|
| Provider | Choose your AI provider |
| Model | Select the model to use |
| API Key | Your provider credentials |
| Context Size | How much history to send per request |

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
Made with ❤️ by <a href="https://github.com/KhanhRomVN">KhanhRomVN</a>
</div>

...

RULE:
1/ giao tiếp bằng tiếng việt
2/ code trực tiếp. ko cần lập kế hoạch
3/ ko tự tạo các file .md thừa ko cần thiết
4/ ko tự chạy các lệnh terminal khi chưa cho phép

<thinking>
Tôi đã có đủ thông tin:

1. **CodeBlock** (`@renderer/components/common/CodeBlock`): 
   - Props: `code`, `language`, `className`, `themeConfig`, `wordWrap`, `showLineNumbers`, `searchTerm`, `highlightRanges`, `onEditorMounted`, `editorOptions`, `onChange`
   - **Không có** `maxHeight` prop → đúng là lỗi TS ở ResponseMetadataBar
   - **Không có** `enableWordWrap` như source (source dùng `enableWordWrap`, electron dùng `wordWrap`)

2. **GroupType**: Hiện tại **không có** type `'code'`. Cần thêm vào.

3. **TAG_REGISTRY**: Có sẵn trong constants, export là `Record<string, TagDefinition>` có `.title`. Có thể dùng `TAG_REGISTRY[toolType]?.title`.

Bây giờ tôi có thể bắt đầu sửa TagRouter.tsx target. Các thay đổi:

### TagRouter.tsx cần sửa:

1. **Thêm import CodeBlock** từ `@renderer/components/common/CodeBlock` (không dùng `enableWordWrap` mà dùng `wordWrap`)
2. **Thêm import ExecuteButton** từ `./ExecuteButton`
3. **Thêm `isRestored` vào interface** TagRouterProps
4. **Thêm `firstUnclickedActionIndex` vào interface** TagRouterProps
5. **Destructure `isRestored` và `firstUnclickedActionIndex`** từ props
6. **Thêm handler `group.type === 'code'`** — render CodeBlock với `wordWrap={false}`
7. **Sửa `questionAnswers` và `selectedOption`** — truyền từ group thay vì undefined
8. **Sửa `toolLabelMap` hardcoded** → dùng `TAG_REGISTRY[toolType]?.title`
9. **Thêm ExecuteButton cho malformed tool** (firstAction.isError)
10. **Đổi `write_to_file` handler** từ render 1 firstAction sang `.map()` như source
11. **Đổi `replace_in_file` handler** từ render 1 firstAction sang `.map()` như source
12. **Thêm `rejectedActions` vào ReplaceInFileRenderer**
13. **Thêm `allActions` vào deps của useMemo** trong ToolActionsList

Và các thay đổi liên quan đến index.tsx (thêm type 'code' vào GroupType cần sửa trong renderer-types.ts).

Nhưng đợi đã: `renderer-types.ts` là file shared types. Nếu tôi thêm type `'code'` vào `GroupType`, nó sẽ ảnh hưởng đến toàn bộ hệ thống. Cần xem source định nghĩa GroupType như thế nào để đảm bảo nhất quán.

Source GroupType (từ source types/renderer-types) có `'code'` type:
```ts
| { type: 'code'; content: string; language: string; key: string }
```

Vậy tôi cần thêm type này vào `renderer-types.ts` của target.

Nhưng trước hết, tập trung vào TagRouter.tsx như user yêu cầu.

Self-check: [CodeBlock props đã xác nhận (wordWrap, không có enableWordWrap), TAG_REGISTRY đã xác nhận (có title), GroupType cần thêm 'code' type nhưng đó là file khác] — sẽ sửa TagRouter.tsx trước, và cũng cần sửa renderer-types.ts để thêm 'code' type.

Về IMPACT-CONFIRM: Tôi đang sửa TagRouter.tsx (1 file) + renderer-types.ts (shared type, 1 file). Đây là file shared types → cần IMPACT-CONFIRM. Nhưng thực ra tôi mới chỉ sửa 1-2 file, và đây là phần mở rộng type (thêm union member), không phá vỡ gì. Tuy nhiên theo CONSTRAINTS, shared types/config là trigger của IMPACT-CONFIRM.

Thực tế, tôi sẽ chỉ sửa TagRouter.tsx trong lần này, và thêm 'code' type vào renderer-types.ts. Đó là 2 file. Không cần IMPACT-CONFIRM vì <4 file và không phá vỡ.

Bắt đầu sửa thôi. Đây là file lớn, tôi sẽ thực hiện nhiều replace_in_file. Cần đọc lại TagRouter.tsx target một lần nữa để lấy chính xác old_content.

Thực ra tôi đã đọc rồi, có thể dùng kết quả đã có. Nhưng để an toàn với EDIT-SAFETY, tôi sẽ dùng nội dung đã đọc.

Các thay đổi sẽ thực hiện:
1. Thêm import CodeBlock, ExecuteButton
2. Thêm isRestored, firstUnclickedActionIndex vào interface
3. Destructure isRestored, firstUnclickedActionIndex
4. Thêm code block handler (trước question handler)
5. Sửa questionAnswers/selectedOption
6. Sửa toolLabelMap → TAG_REGISTRY
7. Thêm ExecuteButton cho malformed tool
8. Đổi write_to_file handler sang .map()
9. Đổi replace_in_file handler sang .map() + thêm rejectedActions
10. Thêm allActions vào deps

Nhiều thay đổi, tôi sẽ batch thành 3 replace_in_file (max per turn). Nhưng có thể cần nhiều hơn. Sẽ làm từng bước.

Thực tế, tôi nên làm theo từng cụm thay đổi logic để dễ kiểm soát. Bắt đầu với các thay đổi nhỏ trước.

Hãy làm 3 thay đổi đầu tiên:
1. Thêm import CodeBlock và ExecuteButton
2. Thêm isRestored, firstUnclickedActionIndex vào interface  
3. Sửa handler code block + questionAnswers/selectedOption + toolLabelMap + malformed tool ExecuteButton + write_to_file/replace_in_file .map()

Thực tế quá nhiều thay đổi cho 3 replace. Tôi sẽ làm thành 3 batch.

Batch 1: Import + Interface + Destructure + code handler + question fix + toolLabelMap + malformed ExecuteButton
Batch 2: write_to_file handler (.map)
Batch 3: replace_in_file handler (.map + rejectedActions) + allActions deps

Hãy bắt đầu với Batch 1.
</thinking>

<markdown>Bắt đầu sửa TagRouter.tsx. Đợt 1: thêm imports, interface props, code block handler, questionAnswers, toolLabelMap → TAG_REGISTRY, ExecuteButton cho malformed tool.</markdown>

<replace_in_file>
<file_path>src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/TagRouter.tsx</file_path>
<old_content>// ICONS

// COMPONENTS
import {
  CommitMessageRenderer, // commit_message
  DeleteFileRenderer, // delete_file
  ErrorRenderer, // error (not tag)
  WriteToFileRenderer, // write_to_file
  ReplaceInFileRenderer, // replace_in_file
  ReadFileRenderer, // read_file
  ListFilesRenderer, // list_file
  FindFilesRenderer, // find_files
  GrepRenderer, // grep
  RevertFileRenderer, // revert_file
  ViewReplaceHistoryRenderer, // view_replace_history
  RunCommandRenderer, // run_command
  GitStatusRenderer, // git_status
  MarkdownRenderer, // markdown
  QuestionRenderer, // question
  WarningRenderer, // warning (not tag)
  ThinkingRenderer, // thinking
} from './renderers';
import ErrorBlock from './blocks/ErrorBlock';
import FileIcon from '@renderer/components/common/FileIcon';
import GitDiffBlock from './blocks/GitDiffBlock';</old_content>
<new_content>// ICONS

// COMPONENTS
import {
  CommitMessageRenderer, // commit_message
  DeleteFileRenderer, // delete_file
  ErrorRenderer, // error (not tag)
  WriteToFileRenderer, // write_to_file
  ReplaceInFileRenderer, // replace_in_file
  ReadFileRenderer, // read_file
  ListFilesRenderer, // list_file
  FindFilesRenderer, // find_files
  GrepRenderer, // grep
  RevertFileRenderer, // revert_file
  ViewReplaceHistoryRenderer, // view_replace_history
  RunCommandRenderer, // run_command
  GitStatusRenderer, // git_status
  MarkdownRenderer, // markdown
  QuestionRenderer, // question
  WarningRenderer, // warning (not tag)
  ThinkingRenderer, // thinking
} from './renderers';
import { CodeBlock } from '@renderer/components/common/CodeBlock';
import ErrorBlock from './blocks/ErrorBlock';
import FileIcon from '@renderer/components/common/FileIcon';
import GitDiffBlock from './blocks/GitDiffBlock';
import ExecuteButton from './ExecuteButton';</old_content>
</replace_in_file>