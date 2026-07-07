# Feature: Diagnostic Count for List/Grep/Find Tools

## Tổng Quan

Feature này thêm thông tin số lượng errors và warnings vào kết quả của các tools: `list_files`, `grep`, và `find_files`. Thay vì chỉ hiển thị danh sách files, giờ sẽ hiển thị kèm số lượng errors/warnings của mỗi file (không hiển thị chi tiết lỗi).

## Các Thay Đổi

### 1. Backend (Extension Side)

#### A. FileSystemAnalyzer (`src/context/FileSystemAnalyzer.ts`)

**Thêm fields vào FileNode interface:**
```typescript
export interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  lines?: number;
  errorCount?: number;      // ✨ NEW
  warningCount?: number;    // ✨ NEW
  children?: FileNode[];
}
```

**Thêm method mới:**
```typescript
public getDiagnosticCountForFile(filePath: string): {
  errorCount: number;
  warningCount: number;
}
```

**Cập nhật buildFileTreeWithRg và buildFileTree:**
- Gọi `getDiagnosticCountForFile()` cho mỗi file
- Thêm `errorCount` và `warningCount` vào FileNode

**Cập nhật formatFileTree:**
- Hiển thị diagnostic count trong format:
  - `file.ts (100 lines, 2 errors, 3 warnings)`
  - `file.ts (100 lines)` nếu không có lỗi
  - `file.ts (2 errors)` nếu không có thông tin lines

#### B. FileHandler (`src/controllers/handlers/FileHandler.ts`)

**Thêm method mới:**
```typescript
private getDiagnosticCountForFile(uri: vscode.Uri): {
  errorCount: number;
  warningCount: number;
}
```

**Cập nhật handleFindFiles:**
- Thay đổi type của matches từ `string[]` thành object array:
```typescript
matches: Array<{
  path: string;
  errorCount?: number;
  warningCount?: number;
}>
```
- Gọi `getDiagnosticCountForFile()` cho mỗi file tìm được

#### C. GreqCapability (`src/agent/capabilities/GreqCapability.ts`)

**Thêm interface mới:**
```typescript
interface FileMatchResult {
  matches: MatchResult[];
  errorCount: number;
  warningCount: number;
}
```

**Thêm method mới:**
```typescript
private getDiagnosticCountForFile(filePath: string): {
  errorCount: number;
  warningCount: number;
}
```

**Cập nhật execute method:**
- Thay đổi type của results từ `Record<string, MatchResult[]>` thành `Record<string, FileMatchResult>`
- Gọi `getDiagnosticCountForFile()` cho mỗi file có matches

### 2. Frontend (Webview Side)

#### A. useToolExecution (`src/webview-ui/src/features/chat/hooks/tools/useToolExecution.ts`)

**Cập nhật find_files handler:**
```typescript
result.matches.forEach((match: any) => {
  const matchPath = typeof match === "string" ? match : match.path;
  let diagnosticInfo = "";
  
  if (typeof match === "object" && (match.errorCount || match.warningCount)) {
    const errorCount = match.errorCount || 0;
    const warningCount = match.warningCount || 0;
    
    if (errorCount > 0 || warningCount > 0) {
      const parts: string[] = [];
      if (errorCount > 0) {
        parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
      }
      if (warningCount > 0) {
        parts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);
      }
      diagnosticInfo = ` (${parts.join(", ")})`;
    }
  }
  
  output += `- ${matchPath}${diagnosticInfo}\n`;
});
```

#### B. grepFormatter (`src/webview-ui/src/features/chat/utils/grepFormatter.ts`)

**Cập nhật GrepResultData interface:**
```typescript
export interface GrepResultData {
  searchTerm: string;
  results: Record<
    string,
    | { lineNumber: number; lineContent: string }[]
    | {
        matches: { lineNumber: number; lineContent: string }[];
        errorCount: number;
        warningCount: number;
      }
  >;
  totalFilesSearched: number;
  totalMatches: number;
}
```

**Cập nhật formatGrepResultCompact:**
- Xử lý cả format cũ (array) và format mới (object với matches + diagnostics)
- Thêm attributes `errors` và `warnings` vào file tag:
```xml
<file path="src/a.ts" matches="2" errors="1" warnings="2">
```

## Output Format Examples

### 1. list_files
```
src/
  components/
    Button.tsx (150 lines, 2 errors, 1 warning)
    Header.tsx (80 lines)
    Footer.tsx (60 lines, 1 error)
  utils/
    helpers.ts (200 lines, 3 warnings)
```

### 2. find_files
```
[find_files] Found 3 file(s)

### Button.tsx (2 matches)
- src/components/Button.tsx (2 errors, 1 warning)
- src/stories/Button.tsx

### helpers.ts (1 match)
- src/utils/helpers.ts (3 warnings)
```

### 3. grep
```xml
<grep_results search="TODO" total_matches="5" files="2" files_searched="150">
<file path="src/components/Button.tsx" matches="3" errors="2" warnings="1">
   12: // TODO: Fix button styling
   45: // TODO: Add accessibility
  102: // TODO: Refactor this
</file>
<file path="src/utils/helpers.ts" matches="2" warnings="3">
   23: // TODO: Optimize performance
   67: // TODO: Add error handling
</file>
</grep_results>
```

## Lợi Ích

1. **Thông tin nhanh**: AI có thể nhanh chóng xác định files có lỗi mà không cần đọc từng file
2. **Token efficient**: Chỉ hiển thị số lượng, không hiển thị chi tiết lỗi
3. **Backward compatible**: Code xử lý cả format cũ và mới
4. **Consistent**: Tất cả 3 tools đều có format thống nhất

## Testing

Build thành công:
```bash
npm run compile
# ✅ Extension compiled successfully
# ✅ Webview compiled successfully
```

## Notes

- Diagnostic count được lấy từ VSCode Language Server
- Chỉ tính errors và warnings, bỏ qua info và hints
- Nếu file không có diagnostics, không hiển thị thông tin (giữ format gọn)
- Method `getDiagnosticCountForFile` an toàn, return `{errorCount: 0, warningCount: 0}` nếu có lỗi
