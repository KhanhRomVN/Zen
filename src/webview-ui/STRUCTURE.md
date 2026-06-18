# Zen Webview - Cấu trúc dự án

## Tổng quan

Giao diện webview của extension Zen - chat AI đa nền tảng trong VSCode. React + TypeScript + Tailwind CSS.

---

## Cây thư mục chi tiết

```
src/
├── App.tsx                                    # Component chính, quản lý điều hướng các panel
├── index.tsx                                  # Entry point, render App, import styles
├── styles.css                                 # Import Tailwind CSS directives
│
├── components/                                # Các thành phần UI
│   ├── AccountPanel/                          # Quản lý tài khoản API
│   │   ├── index.tsx                          # Panel chính: danh sách, search, pagination, CRUD
│   │   ├── AccountCard.tsx                    # Card hiển thị thông tin 1 tài khoản
│   │   ├── AddAccountDrawer.tsx               # Drawer thêm tài khoản mới
│   │   ├── ConfirmDeleteDrawer.tsx            # Xác nhận xóa tài khoản
│   │   ├── ProviderFilterDropdown.tsx         # Dropdown lọc theo provider
│   │   ├── hooks/
│   │   │   └── useAccounts.ts                 # Hook: fetch, pagination, search, filter, CRUD
│   │   └── types/
│   │       └── index.ts                       # Type definitions cho Account
│   │
│   ├── ChatPanel/                             # Panel chat chính
│   │   ├── index.tsx                          # Container: ChatHeader + ChatBody + ChatFooter
│   │   ├── ChatHeader.tsx                     # Header: task name, token usage, model, account
│   │   ├── ChangesTree.tsx                    # Hiển thị cây thay đổi file
│   │   ├── types.ts                           # Type definitions cho ChatPanel
│   │   ├── constants.ts                       # Hằng số
│   │   │
│   │   ├── ChatBody/                          # Hiển thị nội dung chat
│   │   │   ├── index.tsx                      # Container messages, scroll, search, tool actions
│   │   │   ├── types.ts                       # Types cho messages và chat body
│   │   │   ├── utils.ts                       # Utility functions
│   │   │   ├── constants.ts                   # Hằng số
│   │   │   ├── GrepBlock.tsx                  # Hiển thị kết quả grep
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── EmptyState.tsx             # Hiển thị khi chưa có tin nhắn
│   │   │   │   ├── FollowupOptions.tsx        # Gợi ý option từ AI
│   │   │   │   ├── HtmlPreview.tsx            # Preview HTML từ AI
│   │   │   │   ├── MarkdownContent.css        # Style cho Markdown
│   │   │   │   ├── MessageBox.tsx             # Hiển thị 1 message (user/assistant)
│   │   │   │   ├── ProcessingIndicator.tsx    # Indicator khi AI đang xử lý
│   │   │   │   ├── PromptSection.tsx          # Hiển thị prompt section
│   │   │   │   ├── QuestionBlock.tsx          # Hiển thị câu hỏi có option
│   │   │   │   ├── RequestDivider.tsx         # Divider giữa các request
│   │   │   │   ├── ScrollToBottomButton.tsx   # Nút scroll xuống cuối
│   │   │   │   │
│   │   │   │   └── ToolActions/               # Components cho tool execution
│   │   │   │       ├── index.tsx              # Container tool actions
│   │   │   │       ├── DiffView.tsx           # Hiển thị diff file
│   │   │   │       ├── ExecuteButton.tsx      # Nút execute tool
│   │   │   │       ├── FilePreviewBlock.tsx   # Preview file content
│   │   │   │       ├── FileToolItem.tsx       # Item cho file tool
│   │   │   │       ├── FullContentView.tsx    # Full content view
│   │   │   │       ├── InlineViewer.tsx       # Inline viewer
│   │   │   │       ├── TerminalToolItem.tsx   # Item cho terminal tool
│   │   │   │       ├── ToolItem.tsx           # Item chung cho tool
│   │   │   │       └── ToolPermissionDropdown.tsx # Dropdown permission cho tool
│   │   │   │
│   │   │   └── hooks/
│   │   │       ├── useCollapseSections.ts     # Hook collapse/expand sections
│   │   │       ├── useScrollBehavior.ts       # Hook xử lý scroll behavior
│   │   │       └── useToolActions.ts          # Hook xử lý tool actions
│   │   │
│   │   ├── ChatFooter/                        # Input và controls
│   │   │   ├── index.tsx                      # Footer: message input, controls
│   │   │   ├── types.ts                       # Types
│   │   │   ├── utils.ts                       # Utilities
│   │   │   ├── constants.ts                   # Hằng số
│   │   │   ├── ProjectContextModal.tsx        # Modal context project
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── FilesPreviews.tsx          # Preview files đính kèm
│   │   │   │   ├── Icons.tsx                  # Icon components
│   │   │   │   ├── MentionDropdowns.tsx       # Dropdown mention system
│   │   │   │   ├── MessageInput.tsx           # Input field với mention support
│   │   │   │   ├── MiniTerminal.tsx           # Mini terminal preview
│   │   │   │   ├── ProjectStructureDrawer.tsx # Drawer project structure
│   │   │   │   ├── QuickSwitchDrawer.tsx      # Quick switch giữa các chat
│   │   │   │   └── ToolSettingsDrawer.tsx     # Settings cho tool permissions
│   │   │   │
│   │   │   └── hooks/
│   │   │       ├── useFileHandling.ts         # Xử lý file attachments
│   │   │       ├── useMentionSystem.ts        # Hệ thống mention (@file, @folder)
│   │   │       └── useWorkspaceData.ts        # Lấy dữ liệu workspace
│   │   │
│   │   ├── prompts/                           # System prompts cho AI
│   │   │   ├── index.ts                       # Export tất cả prompts
│   │   │   ├── identity.ts                    # Identity của AI assistant
│   │   │   ├── workflow.ts                    # Workflow guidelines
│   │   │   ├── constraints.ts                 # Constraints và rules
│   │   │   ├── tools-reference.ts             # Tham chiếu tool calls
│   │   │   ├── examples.ts                    # Ví dụ cho AI
│   │   │   ├── system-context.ts              # System context
│   │   │   ├── history-context.ts             # Context cho lịch sử chat
│   │   │   ├── persistent-rules.ts            # Rules bắt buộc
│   │   │   ├── retry.ts                       # Prompt cho retry
│   │   │   ├── token-limit-warning.ts         # Cảnh báo token limit
│   │   │   ├── after-pause.ts                 # Prompt sau pause
│   │   │   └── access-mode.ts                 # Access mode instructions
│   │   │
│   │   └── components/
│   │       └── TabList/
│   │           └── index.tsx                  # Danh sách tabs chat
│   │
│   ├── HistoryPanel/                          # Lịch sử conversations
│   │   ├── index.tsx                          # Panel chính: search, sort, danh sách
│   │   ├── HistoryCard.tsx                    # Card hiển thị 1 conversation
│   │   └── types.ts                           # Types
│   │
│   ├── HomePanel/                             # Màn hình chào mừng
│   │   ├── index.tsx                          # Panel chính với WelcomeUI
│   │   ├── WelcomeUI.tsx                      # UI chào mừng, quick actions
│   │   ├── DailyUsageChart.tsx                # Biểu đồ sử dụng hàng ngày
│   │   └── ModelDistributionCard.tsx          # Thống kê phân phối model
│   │
│   ├── SettingsPanel/                         # Cài đặt
│   │   ├── index.tsx                          # Panel: API URL, language, AI language, Simple Mode
│   │   └── LanguageSelector.tsx               # Component chọn ngôn ngữ
│   │
│   ├── common/
│   │   └── FileIcon.tsx                       # Icon cho file dựa trên extension
│   │
│   ├── shared/
│   │   └── ConfirmDialog.tsx                  # Dialog xác nhận chung
│   │
│   ├── CodeBlock.css                          # Style cho code blocks
│   ├── MarkdownWithPaths.tsx                  # Markdown renderer hỗ trợ file paths
│   ├── RichtextBlock.css                      # Style cho rich text
│   ├── RichtextBlock.tsx                      # Rich text block với formatting
│   ├── TerminalBlock.css                      # Style cho terminal output
│   ├── TerminalBlock.tsx                      # Terminal output block
│   └── ToolHeader.tsx                         # Header cho tool actions
│
├── context/                                   # React Context Providers
│   ├── BackendConnectionContext.tsx           # Quản lý kết nối backend API, health check
│   ├── ProjectContext.tsx                     # Cung cấp thông tin project (rootPath, workspace)
│   ├── SettingsContext.tsx                    # Quản lý settings: language, permissions, modes
│   └── ThemeContext.tsx                       # Cung cấp theme từ VSCode
│
├── hooks/                                     # Custom Hooks
│   ├── useChatLLM.ts                          # Chat với LLM: sendMessage, stream, stop
│   ├── useConversationHistory.ts              # Lịch sử conversations: fetch, search, delete
│   ├── useI18n.ts                             # Internationalization, translations
│   ├── useModels.ts                           # Lấy danh sách models và providers
│   ├── useToolExecution.ts                    # Quản lý execution của tools
│   └── useVSCodeTheme.ts                      # Lấy theme từ VSCode API
│
├── i18n/                                      # Internationalization
│   ├── index.ts                               # Export translations
│   ├── en.ts                                  # English translations
│   └── vi.ts                                  # Vietnamese translations
│
├── services/                                  # Services
│   ├── ConversationCache.ts                   # In-memory cache (max 20 conversations)
│   ├── ConversationService.ts                 # CRUD conversations với storage
│   ├── ExtensionService.ts                    # Giao tiếp extension host, storage API
│   └── ResponseParser.ts                      # Parse AI response: tools, markdown, code, question
│
├── types/                                     # Type Definitions
│   ├── chat.ts                                # Types cho chat messages, conversations
│   ├── index.ts                               # Export tất cả types
│   ├── css.d.ts                               # Type declarations cho CSS modules
│   ├── storage.d.ts                           # Type declarations cho storage API
│   └── window.d.ts                            # Type declarations cho window extensions
│
├── utils/                                     # Utilities
│   ├── diffUtils.ts                           # Diff utilities
│   ├── fileIconMapper.ts                      # Map file extension → icon
│   ├── materialIconMaps.ts                    # Material icon mappings
│   ├── providerStyles.ts                      # Styles cho LLM providers
│   └── terminalUtils.ts                       # Terminal utilities
│
├── styles/                                    # Styles
│   ├── global.css                             # Global styles
│   ├── variables.css                          # CSS variables (colors, spacing, fonts)
│   ├── components/
│   │   └── chat.css                           # Styles cho chat components
│   └── fonts/
│       ├── Inter-VariableFont_opsz,wght.ttf   # Inter font
│       └── Inter-Italic-VariableFont_opsz,wght.ttf # Inter italic font
│
└── lib/
    └── utils.ts                               # Utility functions chung
```

---

## Cấu hình và build

```
src/webview-ui/
├── postcss.config.js      # PostCSS: Tailwind + autoprefixer
├── tailwind.config.js     # Tailwind config: content paths, theme
├── webpack.config.js      # Webpack config cho webview
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies và scripts
```

---

## Luồng dữ liệu chính

1. **Extension host** → `postMessage` → webview
2. **App.tsx** nhận command (`showHistory`, `newChat`, ...) → điều hướng panel
3. **ChatPanel** quản lý conversation:
   - `useChatLLM` → gửi message → backend API
   - Stream response → `ResponseParser` → parse tool calls, markdown
   - `ChatBody` hiển thị parsed content
   - `useToolExecution` xử lý tool calls
4. **ConversationService** lưu vào storage (cache + disk)
5. **SettingsContext** cung cấp config (API URL, language, permissions)