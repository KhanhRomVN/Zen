# Parser Strictness Changes - Summary

## Objective
Enforce strict compliance with `tools-reference.ts` schema:
- No tool tag name variants (only canonical names like `<read_file>`)
- No param tag name variants (only exact names like `<file_path>`)
- No fallback parsing logic

## Changes Made

### 1. Tool Registry (`tool-registry.ts`)
✅ **Removed all tag name variants** - Set `variants: []` for all tools:
- `read_file`, `write_to_file`, `replace_in_file`, `revert_file`
- `view_replace_history`, `list_files`, `find_files`, `grep`
- `delete_file`, `delete_folder`, `move_file`, `run_command`
- `git_diff`, `context_compression`

✅ **Removed `attributeAliases` field** from:
- Interface `ToolDefinition`
- All tool definitions (previously had mappings like `path: ["filePath", "file_path", ...]`)

### 2. Tag Normalizer (`TagNormalizer.ts`)
✅ **Removed attribute normalization logic**:
- Deleted `getAttributeAliases()` function
- Deleted `normalizeAttributesInToolContent()` function
- Deleted `getToolVariants()` function
- Removed loop that normalized attributes within tool tags

✅ **Simplified `normalizeTagVariants()`**:
- Only keeps hardcoded singular/plural aliases:
  - `<search_file>` → `<search_files>`
  - `<list_file>` → `<list_files>`
  - `<read_files>` → `<read_file>`
  - `<conversation_compress>` → `<context_compression>`

### 3. Tool Parser (`ToolParser.ts`)
✅ **Removed `extractParam()` function**:
- Previously allowed trying multiple param name aliases
- Example: `extractParam(content, "path", "file_path", "filePath")`

✅ **Kept only `extractParamValue()`**:
- Takes exact param name only
- Example: `extractParamValue(content, "file_path")`

### 4. All Parsers
✅ **Updated to use exact param names per `tools-reference.ts`**:

| Parser | Param Names (Strict) |
|--------|---------------------|
| `ReadFileParser` | `file_path`, `start_line`, `end_line` |
| `WriteToFileParser` | `file_path`, `content` |
| `ReplaceInFileParser` | `file_path`, `old_content`, `new_content` |
| `DeleteFileParser` | `file_path` |
| `RevertFileParser` | `file_path`, `version` |
| `ViewReplaceHistoryParser` | `file_path` |
| `ListFilesParser` | `folder_path`, `type`, `depth` |
| `DeleteFolderParser` | `folder_path` |
| `MoveFileParser` | `file_path`, `target_folder_path` |
| `GrepParser` | `search_term`, `folder_path`, `file_pattern` |
| `RunCommandParser` | `command`, `cwd`, `terminal_id` |
| `GitDiffParser` | `file_path` |
| `GitStatusParser` | `items`, `raw` |
| `CommitMessageParser` | `message` |

✅ **Updated all imports**:
- Changed from `import { extractParam, extractParamValue }` 
- To `import { extractParamValue }`

### 5. Validator (`ToolParamValidator.ts`)
✅ **No changes needed** - Already validates exact param names:
- `read_file` requires `file_path` ✓
- `list_files` requires `folder_path` ✓
- `move_file` requires `file_path`, `target_folder_path` ✓

## Flow Comparison

### Before (Permissive)
```
AI: <read_file><path>test.md</path></read_file>
TagNormalizer: <read_file><file_path>test.md</file_path></read_file> (normalized)
Parser: extractParam(content, "path", "file_path") → "test.md" ✅
Validator: params.file_path = "test.md" ✅
```

### After (Strict)
```
AI: <read_file><path>test.md</path></read_file>
TagNormalizer: <read_file><path>test.md</path></read_file> (no normalization)
Parser: extractParamValue(content, "file_path") → null ❌
Validator: params.file_path = "" ❌ MISSING_REQUIRED_PARAM
```

```
AI: <read_file><file_path>test.md</file_path></read_file>
TagNormalizer: <read_file><file_path>test.md</file_path></read_file>
Parser: extractParamValue(content, "file_path") → "test.md" ✅
Validator: params.file_path = "test.md" ✅
```

## Benefits

1. **Strict Schema Compliance**: AI must use exact tool and param names from `tools-reference.ts`
2. **Clear Error Messages**: Validation failures show exactly what's wrong
3. **Simpler Codebase**: Removed ~200 lines of normalization logic
4. **Better AI Training**: Forces AI to learn correct schema instead of relying on fallbacks
5. **Easier Debugging**: No hidden transformations between AI output and parser

## Breaking Changes

⚠️ **AI must now use exact tag names**:
- ❌ `<readFile>`, `<ReadFile>`, `<read_File>`
- ✅ `<read_file>` only

⚠️ **AI must now use exact param names**:
- ❌ `<path>`, `<filePath>`, `<FilePath>`
- ✅ `<file_path>` only

## Testing Recommendations

1. Test with AI using correct schema → should work perfectly
2. Test with AI using wrong tool names → should fail with clear error
3. Test with AI using wrong param names → should fail validation
4. Update AI prompts to emphasize exact schema compliance
