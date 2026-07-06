# Bugfix: Tool Auto-Execution with Incomplete Tags

## Problem
Tool calls (especially `read_file`) were sometimes displayed in the UI with a gray timeline dot but didn't auto-execute, even with `fullAccess` permission mode enabled.

## Root Cause
The response parser had limited recovery logic for incomplete tool tags:

1. **Original behavior**: Only `read_file` and `list_files` had recovery logic, and it required **fully closed** parameter tags (e.g., `<file_path>...</file_path>`)
2. **Failure case**: When streaming was interrupted or incomplete, tools with unclosed tags were marked as `isPartial = true`
3. **Auto-execution blocker**: `useToolActions` skips any tool with `isPartial = true`, even if the tool has all required parameters

## Solution: Enhanced Recovery Logic

### Changes Made

#### 1. ResponseParser.ts - Enhanced Recovery for All Tools
- **read_file**: Now accepts both closed `<file_path>...</file_path>` and unclosed `<file_path>...` tags
- **list_files**: Now accepts both closed and unclosed `<folder_path>` tags
- **write_to_file**: Recovers if `file_path` is present (marks partial only if `<content>` tag is missing)
- **replace_in_file**: Recovers if `file_path` is present (marks partial only if `<old_content>` or `<new_content>` missing)
- **run_command**: Recovers if `command` parameter is present
- **grep**: Recovers if `pattern` parameter is present
- **delete_file**: Recovers if `file_path` is present
- **delete_folder**: Recovers if `folder_path` is present
- **move_file**: Recovers if `source_path` is present (marks partial only if `<dest_path>` is missing)

#### 2. Added Debug Logging
- **ResponseParser.ts**: Logs when recovery logic successfully extracts parameters from incomplete tags
- **useToolActions.ts**: Comprehensive logging for:
  - Display-only tools (skipped)
  - Partial tools (skipped)
  - Already-triggered tools (skipped)
  - Blocked tools (waiting for preceding question/tool)
  - Auto-triggered tools (with permission decision)
  - Manual approval required tools

### Testing
To enable debug logs, run in browser console:
```javascript
localStorage.setItem('zen_debug_parser', 'true');
```

Then check console for:
- `[Zen][Parser Recovery]` - When recovery logic extracts parameters
- `[Zen][useToolActions]` - When tools are evaluated for auto-execution
- `[Zen][Stream Complete]` - When response parsing completes

### Expected Behavior After Fix
1. ✅ Tools with incomplete closing tags but valid parameters will auto-execute
2. ✅ UI timeline dots will turn green immediately when tool is triggered
3. ✅ No more "gray dot but not running" state for tools with sufficient parameters
4. ✅ Comprehensive logging helps debug any future auto-execution issues

### Edge Cases Handled
- **Streaming interruption**: Tool calls received in chunks are now recoverable
- **Unclosed parameter tags**: `<file_path>src/file.ts` (without `</file_path>`) now works
- **Multi-parameter tools**: Only marked as partial if essential parameters are missing
- **Write operations**: Require both path AND content to avoid accidental empty writes

## Files Modified
1. `/src/webview-ui/src/features/chat/services/ResponseParser.ts`
   - Enhanced recovery logic for 10+ tool types
   - Added logging for recovery success
2. `/src/webview-ui/src/features/chat/hooks/tools/useToolActions.ts`
   - Added comprehensive debug logging for auto-execution flow

## Impact
- **User Experience**: Tools execute automatically and immediately, no manual clicking needed
- **Reliability**: Handles network/streaming issues gracefully
- **Debugging**: Clear logs make future issues easy to diagnose
