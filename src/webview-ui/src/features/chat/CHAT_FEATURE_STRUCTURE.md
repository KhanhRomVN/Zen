src/webview-ui/src/features/chat/
│
├── index.tsx                                 # ChatPanel (entry point)
│
├── components/
│   ├── header/
│   │   └── ChatHeader.tsx                    # Đã có sẵn (giữ nguyên)
│   │
│   ├── body/
│   │   ├── ChatBody.tsx                      # Container chính (giữ nguyên)
│   │   │
│   │   ├── messages/                         # 🆕 MỚI: tổ chức lại message components
│   │   │   ├── UserMessage.tsx              # Tách từ MessageBox (user role)
│   │   │   ├── AssistantMessage.tsx         # Tách từ MessageBox (assistant role)
│   │   │   ├── ErrorMessage.tsx             # Tách từ MessageBox (error state)
│   │   │   ├── ProcessingIndicator.tsx      # Giữ nguyên
│   │   │
│   │   ├── blocks/                          # 🆕 MỚI: các block content trong message
│   │   │   ├── .tsx            # Từ MarkdownWithPaths.tsx
│   │   │   ├── CodeBlock.tsx                # Từ CodeBlock.css + component trong MessageBox
│   │   │   ├── DiffBlock.tsx                # Từ DiffView.tsx
│   │   │   ├── GrepBlock.tsx                # Giữ nguyên
│   │   │   ├── HtmlPreviewBlock.tsx         # Từ HtmlPreview.tsx
│   │   │   ├── QuestionBlock.tsx            # Giữ nguyên
│   │   │   ├── TerminalBlock.tsx            # Giữ nguyên
│   │   │   ├── RichtextBlock.tsx            # Giữ nguyên
│   │   │
│   │   └── tools/                           # 🔧 CẢI TIẾN: tool execution UI
│   │       ├── ToolActionsList.tsx          # Từ ToolActions/index.tsx
│   │       ├── ToolItem.tsx                 # Giữ nguyên
│   │       ├── FileToolItem.tsx             # Giữ nguyên
│   │       ├── TerminalToolItem.tsx         # Giữ nguyên
│   │       ├── ExecuteButton.tsx            # Giữ nguyên
│   │
│   ├── footer/
│   │   ├── ChatFooter.tsx                   # Container chính (giữ nguyên)
│   │   │
│   │   ├── input/                           # 🔧 CẢI TIẾN: input components
│   │   │   ├── MessageInput.tsx             # Giữ nguyên
│   │   │   ├── InputToolbar.tsx             # 🆕 Tách từ MessageInput (buttons: plus, permission, thinking, search, memory)
│   │   │   ├── FilesPreviews.tsx            # Giữ nguyên
│   │   │   ├── MentionDropdowns.tsx         # Giữ nguyên
│   │   │   └── Icons.tsx                    # Giữ nguyên
│   │   │
│   │   └── drawers/                         # 🆕 MỚI: gom các drawer/modal
│   │       ├── ProjectStructureDrawer.tsx   # Giữ nguyên
│   │       ├── QuickSwitchDrawer.tsx        # Giữ nguyên
│   │       ├── ToolSettingsDrawer.tsx       # Giữ nguyên
│   │       ├── ChangesTree.tsx              # Chuyển từ ChatFooter/components/
│   │       └── ProjectContextModal.tsx      # Giữ nguyên
│   │
│   └── shared/                              # 🔧 CẢI TIẾN: component dùng chung
│       ├── FileIcon.tsx                     # Giữ nguyên
│       ├── ToolHeader.tsx                   # Giữ nguyên
│       ├── StatusDot.tsx                    # 🆕 Tách từ ToolHeader/TerminalBlock
│       ├── CodeBlock.css                    # Giữ nguyên
│       ├── RichtextBlock.css                # Giữ nguyên
│       ├── TerminalBlock.css                # Giữ nguyên
│       └── MarkdownContent.css              # Giữ nguyên
│
├── hooks/
│   ├── useChatSession.ts                    # 🆕 Gộp useChatLLM + reset logic
│   ├── useToolPipeline.ts                   # 🆕 Gộp useToolExecution + useToolActions
│   ├── useMessageStream.ts                  # 🆕 Tách streaming logic từ useChatLLM
│   ├── useScrollBehavior.ts                 # Giữ nguyên
│   ├── useCollapseSections.ts               # Giữ nguyên
│   ├── useFileHandling.ts                   # 🚚 Di chuyển từ ChatFooter/hooks/ vào đây
│   ├── useMentionSystem.ts                  # 🚚 Di chuyển từ ChatFooter/hooks/ vào đây
│   └── useWorkspaceData.ts                  # 🚚 Di chuyển từ ChatFooter/hooks/ vào đây
│
├── services/
│   ├── extension-bridge.ts                  # 🆕 Từ ExtensionService.ts (giao tiếp VS Code)
│   ├── response-parser.ts                   # 🆕 Từ ResponseParser.ts
│   ├── conversation-store.ts                # 🆕 Từ ConversationService.ts + ConversationCache.ts (gộp)
│   ├── token-counter.ts                     # 🆕 Tách calculateTokens từ ConversationService
│   └── file-uploader.ts                     # 🆕 Tách upload logic từ useFileHandling
│
├── prompts/
│   ├── index.ts                             # Public API (giữ nguyên)
│   ├── builder/                             # 🆕 MỚI: prompt building blocks
│   │   ├── identity.ts                      # Giữ nguyên
│   │   ├── workflow.ts                      # Giữ nguyên
│   │   ├── constraints.ts                   # Giữ nguyên
│   │   ├── tools-reference.ts               # Giữ nguyên
│   │   ├── examples.ts                      # Giữ nguyên
│   │   ├── system-context.ts                # Giữ nguyên
│   │   ├── permission-mode.ts               # 🆕 Từ access-mode.ts (đổi tên)
│   │   └── persistent-rules.ts              # Giữ nguyên
│   │
│   └── dynamic/                             # 🆕 MỚI: dynamic prompts
│       ├── retry.ts                         # Giữ nguyên
│       ├── token-limit-warning.ts           # Giữ nguyên
│       ├── history-context.ts               # Giữ nguyên
│       └── after-pause.ts                   # Giữ nguyên
│
├── types/
│   ├── message.types.ts                     # 🆕 Gộp Message, ContentBlock, ParsedResponse
│   ├── tool.types.ts                        # 🆕 ToolAction, ToolOutput, PermissionMode
│   ├── conversation.types.ts                # 🆕 ChatMetadata, TabInfo, CachedConversation
│   └── ui.types.ts                          # 🆕 UploadedFile, AttachedItem, WorkspaceItem, Rule
│
├── utils/
│   ├── string-utils.ts                      # 🆕 decodeHtmlEntities, truncate, stripAnsi
│   ├── file-utils.ts                        # 🆕 getFilename, getDisplayPath, formatFileSize, collectConvFilePaths
│   ├── diff-utils.ts                        # 🆕 parseDiff, computeUnifiedDiff (từ DiffView.tsx)
│   └── token-utils.ts                       # 🆕 calculateTokens (alias)
│
└── constants/
    ├── tool-config.ts                       # 🆕 TOOL_LABELS, TOOL_COLORS, CLICKABLE_TOOLS
    ├── file-config.ts                       # 🆕 ALLOWED_FILE_EXTENSIONS
    └── limits.ts                            # 🆕 MAX_INPUT_TOKEN_WARNING_THRESHOLD, MAX_CACHE