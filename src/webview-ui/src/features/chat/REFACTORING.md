# Hướng dẫn tách code (Refactoring Guide)

## 🎯 Mục tiêu
Giảm kích thước các file quá lớn, tăng tính maintainable và dễ hiểu cho codebase.

---

## 📊 Danh sách file cần tách (theo priority)

| Priority | File | Lines | Vấn đề |
|----------|------|-------|--------|
| 🔴 **Cao** | `index.tsx` | 2332 | Chứa 3 component lớn trong 1 file |
| 🔴 **Cao** | `MessageBox.tsx` | 1334 | Render quá nhiều loại block khác nhau |
| 🔴 **Cao** | `useToolExecution.ts` | 1345 | Xử lý quá nhiều loại tool |
| 🔴 **Cao** | `useChatLLM.ts` | 1209 | Quản lý quá nhiều logic chat |
| 🟡 **Trung** | `FileToolRenderer.tsx` | 934 | Có thể tách streaming preview và grep render |
| 🟡 **Trung** | `ResponseParser.ts` | 821 | Có thể tách theo loại parser |
| 🟢 **Thấp** | `ToolRouter.tsx` | 394 | Có thể tách theo loại tool |
| 🟢 **Thấp** | `types/index.ts` | 117 | Có thể mở rộng và tách |
| 🟢 **Thấp** | `utils/utils.ts` | 134 | Có thể tách theo chức năng |

---

## 🔴 PHASE 1: HIGH PRIORITY

### 1. Tách `index.tsx` (2332 lines)

**Mục tiêu**: Tách các component con ra file riêng

#### Bước 1: Tạo `components/SearchBar.tsx`

```tsx
// src/webview-ui/src/features/chat/components/SearchBar.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange?: (q: string) => void;
  onCloseSearch?: () => void;
  bodyRef: React.RefObject<HTMLDivElement>;
}

type SearchFlag = "matchCase" | "wholeWord" | "regex";

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery: initialQuery,
  onSearchQueryChange,
  onCloseSearch,
  bodyRef,
}) => {
  // ... copy toàn bộ code SearchBar từ index.tsx
  // (khoảng ~180 lines)
};

export default SearchBar;
```

**Sau khi tạo**: Xóa `SearchBar` khỏi `index.tsx` và import từ file mới.

---

#### Bước 2: Tạo `components/ChatBody.tsx`

```tsx
// src/webview-ui/src/features/chat/components/ChatBody.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { parseAIResponse, ParsedResponse } from "../services/ResponseParser";
import { useSettings } from "../../context/SettingsContext";
import { useCollapseSections } from "../hooks/useCollapseSections";
import { useToolActions } from "../hooks/useToolActions";
import { useScrollBehavior } from "../hooks/useScrollBehavior";
import { getPermissionDecision } from "../hooks/useToolExecution";
import ProcessingIndicator from "./messages/ProcessingIndicator";
import MessageBox from "./messages/MessageBox";
// ... import các hooks và services khác

export interface ExtendedChatBodyProps extends ChatBodyProps {
  // ... copy toàn bộ interface
}

export const ChatBody: React.FC<ExtendedChatBodyProps> = ({
  messages,
  isProcessing,
  // ... copy toàn bộ props
}) => {
  // Copy toàn bộ logic của ChatBody từ index.tsx
  // (khoảng ~400 lines)
};

export default ChatBody;
```

**Sau khi tạo**: Xóa `ChatBody` khỏi `index.tsx` và import từ file mới.

---

#### Bước 3: Tách logic từ ChatPanel thành các hooks

```tsx
// src/webview-ui/src/features/chat/hooks/useDraftManagement.ts
export const useDraftManagement = (conversationId: string) => {
  const [message, setMessage] = useState("");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [undoIndex, setUndoIndex] = useState(-1);
  
  // Copy logic draft management từ ChatPanel (khoảng ~80 lines)
  
  return { message, setMessage, undoStack, undoIndex, handleUndo, handleRedo };
};
```

```tsx
// src/webview-ui/src/features/chat/hooks/useBrowserSession.ts
export const useBrowserSession = (model: any, account: any, backendApiUrl: string) => {
  const [isBrowserSessionReady, setIsBrowserSessionReady] = useState(false);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);
  
  // Copy logic browser session từ ChatPanel (khoảng ~100 lines)
  
  return { isBrowserSessionReady, showBrowserWarning, isLaunchingBrowser, launchBrowserSession };
};
```

```tsx
// src/webview-ui/src/features/chat/hooks/useTerminalPolling.ts
export const useTerminalPolling = () => {
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(new Set());
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(new Set());
  
  // Copy logic terminal polling từ ChatPanel (khoảng ~40 lines)
  
  return { activeTerminalIds, attachedTerminalIds };
};
```

**Sau khi tạo**: Import các hooks này vào `index.tsx` thay vì code inline.

---

### 2. Tách `MessageBox.tsx` (1334 lines)

**Mục tiêu**: Tách các phần render block thành component riêng

#### Bước 1: Tạo `components/messages/UserMessage.tsx`

```tsx
// src/webview-ui/src/features/chat/components/messages/UserMessage.tsx
import React, { useState, useEffect } from "react";
import { Message } from "../../types";

interface UserMessageProps {
  message: Message;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  onRevertConversation,
}) => {
  // Copy logic render user message từ MessageBox (khoảng ~150 lines)
  
  return (
    <div className="user-message-container">
      {/* ... */}
    </div>
  );
};

export default UserMessage;
```

---

#### Bước 2: Tạo `components/messages/AssistantMessage.tsx`

```tsx
// src/webview-ui/src/features/chat/components/messages/AssistantMessage.tsx
import React from "react";
import { Message } from "../../types";
import { ParsedResponse } from "../../services/ResponseParser";
// import các block renderers

interface AssistantMessageProps {
  message: Message;
  parsedContent: ParsedResponse;
  // ... props cần thiết
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  parsedContent,
  // ...
}) => {
  // Copy logic render assistant message (khoảng ~400 lines)
  // Gọi các sub-components cho từng loại block
  
  return (
    <div className="assistant-message-container">
      {/* Render groups */}
    </div>
  );
};

export default AssistantMessage;
```

---

#### Bước 3: Tạo `components/messages/ErrorMessage.tsx`

```tsx
// src/webview-ui/src/features/chat/components/messages/ErrorMessage.tsx
import React from "react";
import { useI18n } from "../../../../hooks/useI18n";
import type { I18nKey } from "../../../../i18n";

interface ErrorMessageProps {
  content: string;
  onRetry?: () => void;
}

// Copy hàm translateError vào đây hoặc tạo utils/errorTranslations.ts
const translateError = (raw: string): string => {
  // ... copy logic
};

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  content,
  onRetry,
}) => {
  // Copy logic render error message (khoảng ~80 lines)
};

export default ErrorMessage;
```

---

#### Bước 4: Tạo `components/messages/QuestionBlock.tsx`

```tsx
// src/webview-ui/src/features/chat/components/messages/QuestionBlock.tsx
import React from "react";
import QuestionAnswerBlock from "../blocks/QuestionAnswerBlock";

interface QuestionBlockProps {
  options: string[];
  title?: string;
  optional?: boolean;
  selectedOption?: string;
  onSelectOption: (option: string) => void;
  onSendMessage?: (content: string) => void;
  isDisabled?: boolean;
}

export const QuestionBlock: React.FC<QuestionBlockProps> = ({
  options,
  title,
  optional,
  selectedOption,
  onSelectOption,
  onSendMessage,
  isDisabled,
}) => {
  // Copy logic render question block (khoảng ~80 lines)
};

export default QuestionBlock;
```

---

#### Bước 5: Tạo `components/messages/CodeBlockRenderer.tsx`

```tsx
// src/webview-ui/src/features/chat/components/messages/CodeBlockRenderer.tsx
import React, { useState } from "react";
import { ToolHeader } from "../tools/ToolHeader";

interface CodeBlockRendererProps {
  code: string;
  language?: string;
  diffStats?: { added: number; removed: number };
  isDiffBlock: boolean;
  prefix?: string;
  statusColor?: string;
}

export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({
  code,
  language,
  diffStats,
  isDiffBlock,
  prefix,
  statusColor,
}) => {
  // Copy logic render code block (khoảng ~60 lines)
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
      <ToolHeader ... />
      {!isCollapsed && ( ... )}
    </div>
  );
};

export default CodeBlockRenderer;
```

---

#### Bước 6: Tạo `utils/errorTranslations.ts`

```ts
// src/webview-ui/src/features/chat/utils/errorTranslations.ts
import { useI18n } from "../../../hooks/useI18n";
import type { I18nKey } from "../../../i18n";

export const translateError = (raw: string): string => {
  const { t } = useI18n();
  const normalized = raw.trim().toLowerCase();
  const errorMap: Array<[RegExp, I18nKey]> = [
    [/provider returned empty response/i, "errors.providerEmptyResponse"],
    [/no response body/i, "errors.noResponseBody"],
    // ... copy toàn bộ errorMap
  ];
  for (const [pattern, key] of errorMap) {
    if (pattern.test(raw)) return t(key);
  }
  return raw;
};
```

**Sau khi tạo**: Import `translateError` từ file mới và xóa khỏi MessageBox.

---

### 3. Tách `useToolExecution.ts` (1345 lines)

**Mục tiêu**: Tách logic thực thi từng loại tool thành các hook riêng

#### Bước 1: Tạo `utils/permissionUtils.ts`

```ts
// src/webview-ui/src/features/chat/utils/permissionUtils.ts
import { PermissionMode } from "../../../context/SettingsContext";

export const getPermissionDecision = (
  mode: PermissionMode,
  toolType: string,
): "allow" | "prompt" | "deny" => {
  const readTools = ["read_file", "list_files", "search_files", "grep"];
  switch (mode) {
    case "fullAccess":
      return "allow";
    case "approval":
      return readTools.includes(toolType) ? "allow" : "prompt";
    case "readOnly":
      return readTools.includes(toolType) ? "allow" : "deny";
    default:
      return "prompt";
  }
};
```

---

#### Bước 2: Tạo `utils/tokenGuard.ts`

```ts
// src/webview-ui/src/features/chat/utils/tokenGuard.ts
import { calculateTokens } from "../services/ConversationService";
import { buildTokenLimitWarningPrompt } from "../prompts/token-limit-warning";
import type { TokenLimitFileInfo } from "../prompts/token-limit-warning";

const OVERFLOW_PRONE_TOOLS = new Set([
  "read_file",
  "search_files",
  "list_files",
]);

const MAX_INPUT_TOKEN_WARNING_THRESHOLD = 80_000;

const buildOffendingFileList = (
  actions: any[],
  results: string[],
): TokenLimitFileInfo[] => {
  // Copy logic
};

export const applyTokenLimitGuard = (
  content: string,
  actions: any[],
  results: string[],
): string => {
  // Copy logic
};
```

---

#### Bước 3: Tạo `utils/grepFormatter.ts`

```ts
// src/webview-ui/src/features/chat/utils/grepFormatter.ts
interface GrepResultData {
  searchTerm: string;
  results: Record<string, { lineNumber: number; lineContent: string }[]>;
  totalFilesSearched: number;
  totalMatches: number;
}

export const formatGrepResultCompact = (data: GrepResultData): string => {
  // Copy logic formatGrepResultCompact
};
```

---

#### Bước 4: Tạo `hooks/useToolExecutor.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useToolExecutor.ts
import { useCallback } from "react";
import { extensionService, messageDispatcher } from "@/services/ExtensionService";

export const useToolExecutor = ({
  conversationIdRef,
  permissionModeRef,
}: {
  conversationIdRef: React.MutableRefObject<string>;
  permissionModeRef: React.MutableRefObject<PermissionMode>;
}) => {
  const executeSingleAction = useCallback((
    action: any,
    skipDiagnostics: boolean = false,
    bypassIgnore: boolean = false,
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      // Copy logic executeSingleAction (khoảng ~400 lines)
      // Xử lý từng loại tool: read_file, write_to_file, replace_in_file, 
      // list_files, search_files, run_command, grep, delete_file, delete_folder
    });
  }, [conversationIdRef, permissionModeRef]);

  return { executeSingleAction };
};
```

---

#### Bước 5: Tạo `hooks/useCommandExecutor.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useCommandExecutor.ts
import { useState, useEffect, useRef } from "react";
import { extensionService } from "@/services/ExtensionService";

export const useCommandExecutor = () => {
  const [terminalStatus, setTerminalStatus] = useState<Record<string, "busy" | "free">>({});
  const terminalToActionMap = useRef<Map<string, string>>(new Map());
  const commandStartTimes = useRef<Map<string, number>>(new Date());
  const pendingToolResolvers = useRef<Map<string, (result: string | null) => void>>(new Map());
  const earlyCommandResults = useRef<Map<string, any>>(new Map());

  // Copy logic command execution từ useToolExecution (khoảng ~150 lines)

  return {
    terminalStatus,
    setTerminalStatus,
    terminalToActionMap,
    commandStartTimes,
    pendingToolResolvers,
    earlyCommandResults,
  };
};
```

---

#### Bước 6: Tạo `hooks/useSingleLineReview.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useSingleLineReview.ts
import { useState, useCallback } from "react";
import { Message } from "../types";

export const useSingleLineReview = () => {
  const [singleLineReviewActions, setSingleLineReviewActions] = useState<
    Record<string, { action: any; actionId: string; messageId: string; messageObj: Message }>
  >({});

  const confirmSingleLineAction = useCallback(async (actionId: string) => {
    // Copy logic confirmSingleLineAction
  }, []);

  const rejectSingleLineAction = useCallback((actionId: string) => {
    // Copy logic rejectSingleLineAction
  }, []);

  return {
    singleLineReviewActions,
    setSingleLineReviewActions,
    confirmSingleLineAction,
    rejectSingleLineAction,
  };
};
```

---

### 4. Tách `useChatLLM.ts` (1209 lines)

**Mục tiêu**: Tách các phần logic riêng biệt

#### Bước 1: Tạo `hooks/useMessageManager.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useMessageManager.ts
import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../types";
import { saveConversation } from "../services/ConversationService";

export const useMessageManager = (selectedTab: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  
  // Copy logic quản lý messages (khoảng ~100 lines)
  
  return {
    messages,
    setMessages,
    messagesRef,
    // các hàm: addMessage, updateMessage, cancelMessage
  };
};
```

---

#### Bước 2: Tạo `hooks/useStreamHandler.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useStreamHandler.ts
import { useState, useRef, useCallback } from "react";

export const useStreamHandler = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [incompleteHasPartialTool, setIncompleteHasPartialTool] = useState(false);
  const [incompletePartialToolType, setIncompletePartialToolType] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isContinuingRef = useRef(false);
  
  // Copy logic stream handling (khoảng ~400 lines)
  // processStream, handleMetadata, handleContinuation
  
  return {
    isStreaming,
    setIsStreaming,
    isContinuing,
    setIsContinuing,
    incompleteHasPartialTool,
    incompletePartialToolType,
    abortControllerRef,
    isContinuingRef,
    processStream,
    stopStream,
  };
};
```

---

#### Bước 3: Tạo `hooks/useFileUpload.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useFileUpload.ts
import { useCallback } from "react";

export const useFileUpload = (apiUrl: string, accountId?: string) => {
  const uploadFiles = useCallback(async (files: any[]): Promise<string[]> => {
    // Copy logic upload file (khoảng ~100 lines)
    // uploadToServer, handleFormData
  }, [apiUrl, accountId]);
  
  return { uploadFiles };
};
```

---

#### Bước 4: Tạo `hooks/useConversationPersistence.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useConversationPersistence.ts
import { useCallback } from "react";
import { Message } from "../types";
import { saveConversation, logChatToWorkspace, deleteConversation } from "../services/ConversationService";

export const useConversationPersistence = (selectedTab: any) => {
  const saveConversationState = useCallback((
    messages: Message[],
    conversationId: string,
    backendConversationId?: string,
    toolOutputs?: any,
  ) => {
    // Copy logic saveConversation (khoảng ~100 lines)
  }, [selectedTab]);
  
  const logMessage = useCallback((chatUuid: string, message: Message) => {
    logChatToWorkspace(chatUuid, message);
  }, []);
  
  const deleteConversationState = useCallback((conversationId: string) => {
    deleteConversation(conversationId);
  }, []);
  
  return { saveConversationState, logMessage, deleteConversationState };
};
```

---

#### Bước 5: Tạo `hooks/useModelManager.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useModelManager.ts
import { useState, useRef, useEffect } from "react";

export const useModelManager = () => {
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const lastUsedModelRef = useRef<any>(null);
  const lastUsedAccountRef = useRef<any>(null);
  const qwenParentIdRef = useRef<string | undefined>(undefined);
  
  // Copy logic quản lý model/account (khoảng ~80 lines)
  
  return {
    currentModel,
    setCurrentModel,
    currentAccount,
    setCurrentAccount,
    lastUsedModelRef,
    lastUsedAccountRef,
    qwenParentIdRef,
    syncModelFromMetadata,
  };
};
```

---

#### Bước 6: Tạo `hooks/useChatControls.ts`

```ts
// src/webview-ui/src/features/chat/hooks/useChatControls.ts
import { useCallback } from "react";
import { extensionService } from "@/services/ExtensionService";

export const useChatControls = ({
  isProcessingRef,
  currentConversationIdRef,
  abortControllerRef,
  setMessages,
  setIsProcessingSync,
  setIsStreaming,
  setIsContinuingSync,
}: any) => {
  const stopGeneration = useCallback(() => {
    // Copy logic stopGeneration (khoảng ~80 lines)
  }, [isProcessingRef, currentConversationIdRef, abortControllerRef]);
  
  const resetSession = useCallback(() => {
    // Copy logic resetSession
  }, []);
  
  return { stopGeneration, resetSession };
};
```

---

## 🟡 PHASE 2: MEDIUM PRIORITY

### 5. Tách `FileToolRenderer.tsx` (934 lines)

**Mục tiêu**: Tách streaming preview và các helper components

#### Bước 1: Tạo `components/tools/StreamingPreview.tsx`

```tsx
// src/webview-ui/src/features/chat/components/tools/StreamingPreview.tsx
import React, { useRef, useEffect } from "react";

interface StreamingPreviewProps {
  content: string;
  height?: number;
}

export const StreamingPreviewBox: React.FC<StreamingPreviewProps> = ({
  content,
  height = 154,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [content]);
  
  // Copy logic StreamingPreviewBox
  
  return (
    <div ref={boxRef} style={{ height: `${height}px`, /* ... */ }}>
      {content}
      <span style={{ /* cursor blink */ }} />
    </div>
  );
};
```

---

#### Bước 2: Tạo `components/tools/GrepToolRenderer.tsx`

```tsx
// src/webview-ui/src/features/chat/components/tools/GrepToolRenderer.tsx
import React, { useState } from "react";
import { ToolAction } from "../../services/ResponseParser";
import GrepBlock from "../blocks/GrepBlock";

interface GrepToolRendererProps {
  action: ToolAction;
  actionId: string;
  // ... props
}

export const GrepToolRenderer: React.FC<GrepToolRendererProps> = ({
  action,
  actionId,
  // ...
}) => {
  // Copy logic grep rendering từ FileToolRenderer (khoảng ~80 lines)
  
  return (
    <>
      <ToolHeader title={/* header content */} />
      <GrepBlock ... />
    </>
  );
};
```

---

### 6. Tách `ResponseParser.ts` (821 lines)

**Mục tiêu**: Tách parser theo từng loại block

#### Bước 1: Tạo `services/parsers/ToolParser.ts`

```ts
// src/webview-ui/src/features/chat/services/parsers/ToolParser.ts
import { ToolAction } from "../../types";

const CONTENT_PARAMS = new Set(["content", "diff"]);

const decodeHtmlEntities = (text: string): string => {
  // Copy logic
};

const extractParamValue = (content: string, paramName: string): string | null => {
  // Copy logic
};

const extractParam = (content: string, ...aliases: string[]): string | null => {
  // Copy logic
};

export const parseToolAction = (
  toolName: string,
  innerContent: string,
  rawXml: string,
): ToolAction => {
  // Copy logic parseToolAction (khoảng ~200 lines)
};
```

---

#### Bước 2: Tạo `services/parsers/ContentParser.ts`

```ts
// src/webview-ui/src/features/chat/services/parsers/ContentParser.ts
import { ContentBlock } from "../../types";

export const parseContentBlocks = (
  content: string,
  thinkingBlocks: string[],
): ContentBlock[] => {
  // Copy logic parse content blocks (khoảng ~300 lines)
  // Xử lý: markdown, code, file, mixed_content
};
```

---

#### Bước 3: Tạo `services/parsers/QuestionParser.ts`

```ts
// src/webview-ui/src/features/chat/services/parsers/QuestionParser.ts
import { ContentBlock } from "../../types";

export const parseQuestionBlock = (innerContent: string): ContentBlock | null => {
  // Copy logic parse question (khoảng ~80 lines)
  // Extract title, options, optional flag
};
```

---

#### Bước 4: Tạo `services/parsers/ThinkingParser.ts`

```ts
// src/webview-ui/src/features/chat/services/parsers/ThinkingParser.ts
export const extractThinkingBlocks = (content: string): {
  remainingContent: string;
  thinkingBlocks: string[];
  unclosedThinking: string | null;
} => {
  // Copy logic extract thinking blocks (khoảng ~80 lines)
};
```

---

#### Bước 5: Tạo `services/parsers/TagNormalizer.ts`

```ts
// src/webview-ui/src/features/chat/services/parsers/TagNormalizer.ts
const TAG_VARIANTS: Record<string, string[]> = {
  read_file: ["readFile", "ReadFile", /* ... */],
  // ... copy toàn bộ TAG_VARIANTS
};

export const normalizeTagVariants = (content: string): string => {
  // Copy logic normalize tag variants (khoảng ~40 lines)
};
```

---

## 🟢 PHASE 3: LOW PRIORITY

### 7. Tách `ToolRouter.tsx` (394 lines)

```tsx
// src/webview-ui/src/features/chat/components/tools/FileToolRouter.tsx
export const FileToolRouter: React.FC<FileToolRouterProps> = ({ group, ... }) => {
  // Xử lý file tools
};

// src/webview-ui/src/features/chat/components/tools/TerminalToolRouter.tsx
export const TerminalToolRouter: React.FC<TerminalToolRouterProps> = ({ action, ... }) => {
  // Xử lý terminal tools
};
```

---

### 8. Tách `types/index.ts` (117 lines)

```
types/
├── index.ts          # Export all
├── message.ts        # Message, ChatBodyProps
├── tool.ts           # ToolAction, ContentBlock
├── file.ts           # UploadedFile, ExternalFile, WorkspaceItem
├── chat.ts           # TabInfo, AttachedItem
└── rule.ts           # Rule
```

---

### 9. Tách `utils/utils.ts` (134 lines)

```
utils/
├── index.ts          # Export all
├── pathUtils.ts      # getDisplayPath, collectConvFilePaths, getFilename
├── toolUtils.ts      # getActionName, getToolLabel, getToolColor
├── fileUtils.ts      # isFileAllowed, readFileAsText, parseNewCodeFromDiff
└── diffUtils.ts      # handleDiffClick, copyToClipboard
```

---

## 📋 Checklist Refactoring

### Sau mỗi lần tách:
- [ ] Kiểm tra imports đã đúng chưa
- [ ] Kiểm tra type definitions
- [ ] Chạy lint để phát hiện lỗi
- [ ] Test UI không bị lỗi
- [ ] Commit với message rõ ràng

### Testing:
- [ ] Chat gửi và nhận message vẫn hoạt động
- [ ] Tools (read, write, replace, run_command) vẫn chạy
- [ ] Auto-execute vẫn hoạt động
- [ ] Restore conversation từ history
- [ ] Upload file
- [ ] Mention (@file, @folder)
- [ ] Search trong chat
- [ ] Collapse/expand
- [ ] Undo/redo trong input

---

## 📝 Lưu ý khi refactor

1. **Luôn giữ nguyên behavior**: Không thay đổi logic khi tách code
2. **Commit từng bước nhỏ**: Mỗi lần tách 1 file → commit 1 lần
3. **Kiểm tra imports**: Đảm bảo không bị circular dependency
4. **Cập nhật types**: Nếu tách types, cập nhật tất cả imports
5. **Test kỹ**: Đặc biệt là các flow phức tạp (streaming, tool execution)

---

**Cập nhật lần cuối**: 2026-06-18