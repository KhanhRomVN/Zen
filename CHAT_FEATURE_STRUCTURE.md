```
features/chat/
├── index.tsx
│
├── components/
│   ├── Header/
│   │   └── index.tsx
│   ├── Body/
│   │   ├── index.tsx
│   │   ├── messages/
│   │   │   ├── MessageBox.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ProcessingIndicator.tsx
│   │   │   ├── RequestDivider.tsx
│   │   │   └── ScrollToBottomButton.tsx
│   │   ├── blocks/
│   │   │   ├── GrepBlock.tsx
│   │   │   ├── HtmlPreview.tsx
│   │   │   ├── PromptSection.tsx
│   │   │   ├── QuestionBlock.tsx
│   │   │   ├── RichtextBlock.tsx
│   │   │   ├── TerminalBlock.tsx
│   │   │   └── FollowupOptions.tsx
│   │   ├── markdown/
│   │   │   ├── MarkdownWithPaths.tsx
│   │   │   └── MarkdownContent.css
│   │   └── tools/
│   │       ├── index.tsx
│   │       ├── ToolItem.tsx
│   │       ├── FileToolItem.tsx
│   │       ├── TerminalToolItem.tsx
│   │       ├── ToolPermissionDropdown.tsx
│   │       ├── ExecuteButton.tsx
│   │       ├── DiffView.tsx
│   │       ├── FilePreviewBlock.tsx
│   │       ├── FullContentView.tsx
│   │       └── InlineViewer.tsx
│   ├── Footer/
│   │   ├── index.tsx
│   │   ├── input/
│   │   │   ├── MessageInput.tsx
│   │   │   ├── FilesPreviews.tsx
│   │   │   ├── MentionDropdowns.tsx
│   │   │   └── Icons.tsx
│   │   ├── drawers/
│   │   │   ├── ProjectStructureDrawer.tsx
│   │   │   ├── QuickSwitchDrawer.tsx
│   │   │   └── ToolSettingsDrawer.tsx
│   │   └── ProjectContextModal.tsx
│   └── shared/
│       ├── FileIcon.tsx
│       ├── ChangesTree.tsx
│       ├── ToolHeader.tsx
│       ├── RichtextBlock.css
│       ├── TerminalBlock.css
│       └── CodeBlock.css
│
├── hooks/
│   ├── useChatLLM.ts
│   ├── useToolExecution.ts
│   ├── useToolActions.ts
│   ├── useCollapseSections.ts
│   └── useScrollBehavior.ts
│
├── services/
│   ├── ConversationCache.ts
│   ├── ConversationService.ts
│   ├── ExtensionService.ts
│   └── ResponseParser.ts
│
├── prompts/
│   ├── index.ts
│   ├── identity.ts
│   ├── workflow.ts
│   ├── constraints.ts
│   ├── tools-reference.ts
│   ├── examples.ts
│   ├── system-context.ts
│   ├── history-context.ts
│   ├── persistent-rules.ts
│   ├── retry.ts
│   ├── token-limit-warning.ts
│   ├── after-pause.ts
│   └── access-mode.ts
│
├── types/
│   ├── message.ts
│   ├── tool.ts
│   ├── conversation.ts
│   └── chat.ts
│
├── utils/
│   ├── string.ts
│   ├── token.ts
│   ├── diff.ts
│   └── file.ts
│
└── constants/
    └── constants.ts