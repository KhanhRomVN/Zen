# Diagnostics File Open Strategy

## Problem

When a file has never been opened in VS Code during a project session, the Language Server may not have analyzed it yet. This means:
- `vscode.languages.getDiagnostics(uri)` returns empty array
- Errors and warnings are not available until the file is opened

This affects tools that rely on diagnostics:
- `read_file` - May return files without diagnostics information
- `replace_in_file` - May not show diagnostics after replacement if file was never opened

## Solution

Implement a "file open before operation" strategy:

### 1. **Helper Method: `ensureFileOpened()`**

```typescript
private async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    // Check if file is already open
    const openEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === uri.fsPath
    );

    if (openEditor) {
        return; // Already open, nothing to do
    }

    // Open document and show it to trigger language server
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Beside
    });
    // No fixed timeout - caller will wait for diagnostics events
}
```

**Why this works:**
- `openTextDocument()` opens the file in VS Code workspace
- `showTextDocument()` with `preview: true` triggers Language Server immediately
- `preserveFocus: true` prevents stealing focus from user's current work
- `viewColumn: vscode.ViewColumn.Beside` opens in side column to minimize disruption
- **No fixed timeout** - the caller uses event-driven waiting for diagnostics
- File stays open in VS Code's workspace (never closed)

### Event-Driven Diagnostics Waiting

After opening the file, `read_file` and `replace_in_file` use event-driven approach:

```typescript
await new Promise<void>((resolve) => {
    const maxTimeout = 30000; // 30s safety timeout
    const stableWaitTime = 800; // Wait 800ms of stability
    
    const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some(uri => uri.fsPath === absPath.fsPath)) {
            // File's diagnostics changed
            // Clear previous timeout
            // Wait 800ms more for stability
            // If stable → resolve
        }
    });
    
    setTimeout(() => {
        disposable.dispose();
        resolve(); // Safety timeout
    }, maxTimeout);
});
```

**Benefits:**
- Waits exactly as long as needed (5-20 seconds for large files)
- Not too short (like 200ms)
- Not too long (max 30 seconds)
- Adapts to Language Server speed

### 2. **Updated Workflow**

#### `read_file` (NEW)
```
1. Resolve file path
2. → ensureFileOpened() - Open file if not already open
3. → Wait for diagnostics to stabilize (event-driven, max 30s)
4. Read file content
5. Get diagnostics (now available and up-to-date)
6. Return content + diagnostics
```

#### `replace_in_file` (NEW)
```
1. Resolve file path
2. → ensureFileOpened() - Open file if not already open
3. Perform replacement
4. Wait for diagnostics to stabilize (event-driven)
5. Get diagnostics
6. Return result + diagnostics
```

#### `write_to_file` (UNCHANGED)
```
1. Write file content
2. Open file (showTextDocument)
3. Wait for diagnostics to stabilize (event-driven)
4. Get diagnostics
5. Return result + diagnostics
```

**Why write_to_file is different:**
- File may not exist yet (new file creation)
- Need to write first, then trigger analysis on the new content

### 3. **Key Principles**

1. **Never close files**: Once opened, files remain in VS Code workspace to preserve Language Server analysis state
2. **Check before opening**: Use `vscode.window.visibleTextEditors` to avoid redundant opens
3. **Minimal UI disruption**: Use `openTextDocument()` not `showTextDocument()` for background operations
4. **Respect skipDiagnostics flag**: Only open file if diagnostics are needed

## Benefits

1. **Consistent diagnostics**: All file operations return accurate diagnostics
2. **Fast Language Server trigger**: `showTextDocument()` ensures immediate analysis
3. **Minimal disruption**: `preview: true` and `preserveFocus: true` keep user's focus
4. **Smart tab management**: Opens in side column instead of current editor
5. **No performance impact**: Files are only opened once, then cached
6. **Backward compatible**: Works with existing `skipDiagnostics` flag

## Implementation Details

### Changes Made

1. Added `ensureFileOpened()` private method to FileHandler class
2. Updated `handleReadFile()` to call `ensureFileOpened()` before reading
3. Updated `handleReplaceInFile()` to call `ensureFileOpened()` before replacing
4. `handleWriteFile()` unchanged (already has proper file opening logic)

### File Location

`src/controllers/handlers/FileHandler.ts`

### Testing

To verify the fix works:

1. Start VS Code with a TypeScript project
2. Do NOT open any files manually
3. Use `read_file` tool to read a file with errors
4. Verify diagnostics are returned in the response
5. Use `replace_in_file` to modify the file
6. Verify diagnostics are updated after replacement

## Related Issues

- Files never opened had no diagnostics
- `read_file` returned empty diagnostics array
- `replace_in_file` had stale diagnostics

All resolved by this implementation.
