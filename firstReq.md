## Project Structure

```
CHANGELOG.md (50 lines)
debug_busy.js (9 lines)
eslint.config.mjs (67 lines)
LICENSE (21 lines)
package.json (161 lines)
remove-dts-files.sh (99 lines)
root_tsc.log (1027 lines)
src/
  agent/
    AgentCapabilityManager.ts (78 lines)
    capabilities/
      CommandExecutor.ts (48 lines)
      FileAddCapability.ts (43 lines)
      FileEditCapability.ts (41 lines)
      FileReadCapability.ts (31 lines)
      index.ts (4 lines)
    types/
      AgentTypes.ts (30 lines)
    validators/
      PermissionValidator.ts (156 lines)
  context/
    ContextBuilder.ts (200 lines)
    ContextManager.ts (118 lines)
    FileSystemAnalyzer.ts (596 lines)
    GitHistoryAnalyzer.ts (223 lines)
    ImportGraphAnalyzer.ts (361 lines)
    PatternMatcher.ts (262 lines)
    ProjectStructureManager.ts (149 lines)
    RecentItemsManager.ts (66 lines)
    RelatedFilesAnalyzer.ts (255 lines)
    SmartContextProvider.ts (415 lines)
    WorkspaceAnalyzer.ts (215 lines)
    types.ts (44 lines)
  controllers/
    ChatController.ts (2065 lines)
  extension.ts (144 lines)
  managers/
    BackupManager.ts (968 lines)
    FileLockManager.ts (24 lines)
    ProcessManager.ts (891 lines)
    TerminalBridge.ts (227 lines)
  providers/
    ZenChatViewProvider.ts (243 lines)
  services/
    LoggerService.ts (92 lines)
    ShikiService.ts (290 lines)
    ThemeService.ts (186 lines)
  storage-manager.ts (137 lines)
  types/
    index.ts (47 lines)
  utils/
    FuzzyMatcher.ts (143 lines)
    fileUtils.ts (77 lines)
    terminalUtils.ts (170 lines)
  webview-ui/
    package.json (43 lines)
    postcss.config.js (5 lines)
    public/
      index.html (11 lines)
    src/
      App.tsx (265 lines)
      components/
        ChatPanel/
          ChangesTree.tsx (380 lines)
          ChatBody/
            Renderers/
            components/
              EmptyState.tsx (118 lines)
              FollowupOptions.tsx (74 lines)
              HtmlPreview.tsx (97 lines)
              MessageBox.tsx (611 lines)
              ProcessingIndicator.tsx (67 lines)
              PromptSection.tsx (103 lines)
              RequestDivider.tsx (47 lines)
              ScrollToBottomButton.tsx (44 lines)
              ThinkingSection.tsx (97 lines)
              ToolActions/
                ToolItem.tsx (1696 lines)
                index.tsx (249 lines)
            constants.ts (35 lines)
            hooks/
              useCollapseSections.ts (34 lines)
              useScrollBehavior.ts (37 lines)
              useToolActions.ts (100 lines)
            index.tsx (191 lines)
            types.ts (48 lines)
            utils.ts (70 lines)
          ChatFooter/
            ProjectContextModal.tsx (255 lines)
            components/
              BackupDrawer.tsx (1316 lines)
              BlacklistDrawer.tsx (69 lines)
              FilesPreviews.tsx (532 lines)
              Icons.tsx (303 lines)
              LargeBinaryBackupDrawer.tsx (139 lines)
              MentionDropdowns.tsx (530 lines)
              MessageInput.tsx (1455 lines)
              MiniTerminal.tsx (147 lines)
              ProjectStructureDrawer.tsx (423 lines)
              TerminalDrawer.tsx (431 lines)
            constants.ts (32 lines)
            hooks/
              useFileHandling.ts (225 lines)
              useMentionSystem.ts (160 lines)
              useWorkspaceData.ts (143 lines)
            index.tsx (494 lines)
            types.ts (53 lines)
            utils.ts (47 lines)
          ChatHeader.tsx (291 lines)
          TaskDrawer.tsx (365 lines)
          components/
            TabList/
              index.tsx (324 lines)
          index.tsx (518 lines)
          prompts/
            commit_message.ts (13 lines)
            constraints.ts (171 lines)
            examples.ts (498 lines)
            identity.ts (12 lines)
            index.ts (55 lines)
            system-context.ts (40 lines)
            tools-reference.ts (148 lines)
            workflow.ts (195 lines)
          types.ts (1 lines)
        CodeBlock.css (238 lines)
        CodeBlock.tsx (172 lines)
        HistoryPanel/
          HistoryCard.tsx (325 lines)
          index.tsx (334 lines)
          types.ts (19 lines)
        HomePanel/
          WelcomeUI.tsx (418 lines)
          index.tsx (107 lines)
        RichtextBlock.css (88 lines)
        RichtextBlock.tsx (147 lines)
        SettingsPanel/
          BlacklistManager.tsx (305 lines)
          LanguageSelector.tsx (181 lines)
          index.tsx (239 lines)
        TerminalBlock.css (245 lines)
        TerminalBlock.tsx (163 lines)
        ToolHeader.tsx (114 lines)
        common/
          FileIcon.tsx (62 lines)
        shared/
          ConfirmDialog.tsx (107 lines)
      context/
        BackendConnectionContext.tsx (131 lines)
        SettingsContext.tsx (90 lines)
        ThemeContext.tsx (28 lines)
      hooks/
        useBackupTimeline.ts (265 lines)
        useBackupWatcher.ts (49 lines)
        useBlacklistManager.ts (87 lines)
        useChatLLM.ts (589 lines)
        useConversationHistory.ts (109 lines)
        useModels.ts (19 lines)
        useToolExecution.ts (638 lines)
        useVSCodeTheme.ts (44 lines)
      index.tsx (11 lines)
      lib/
        utils.ts (6 lines)
      services/
        ConversationService.ts (200 lines)
        ExtensionService.ts (118 lines)
        ResponseParser.ts (540 lines)
        SyntaxHighlighter.ts (496 lines)
      styles/
        components/
          chat.css (184 lines)
        global.css (28 lines)
        variables.css (49 lines)
      types/
        chat.ts (13 lines)
        css.d.ts (14 lines)
        index.ts (2 lines)
        storage.d.ts (24 lines)
        window.d.ts (29 lines)
      utils/
        diffUtils.ts (185 lines)
        fileIconMapper.ts (90 lines)
        providerStyles.ts (64 lines)
        terminalUtils.ts (84 lines)
    test-strip.js (28 lines)
    tsconfig.json (27 lines)
    webpack.config.js (73 lines)
test/
  bulkTerminalExecution.test.ts (159 lines)
  consolidatedTerminal.test.ts (135 lines)
  terminalFiltering.test.js (113 lines)
  terminalFiltering.test.ts (112 lines)
test_out.log (1059 lines)
tsconfig.extension.json (16 lines)
tsconfig.json (16 lines)
tsconfig.test.json (10 lines)
vscode_terminal_mechanism.md (41 lines)
webpack.config.js (64 lines)
```
