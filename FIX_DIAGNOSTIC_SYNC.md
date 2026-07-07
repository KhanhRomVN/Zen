# Fix: Diagnostic Synchronization Issue

## Problem

UI hiển thị stale diagnostics (old errors) trong khi backend báo "No diagnostics found". Root cause: Multiple sources of truth + cache merge logic.

### Example:
```
UI: DataTable.tsx [2] errors (màu đỏ)
Backend Log: "No diagnostics found for DataTable.tsx"
→ Mismatch!
```

## Root Cause Analysis

### Multiple Sources of Truth (BAD):
1. **Language Server** - Backend wait after file write
2. **Cached Diagnostics** - UI state cache  
3. **Merge Logic** - UI merge cả 2 sources

```typescript
// OLD (BAD):
const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics || [];
const cacheDiagnosticsArray = cachedDiagnostics || [];
const normalized = [...toolOutputDiagnostics, ...cacheDiagnosticsArray]; // ❌ MERGE!
```

**Timeline của vấn đề:**
```
T1: File có 2 errors → cachedDiagnostics = [Error1, Error2]
T2: Replace file → toolOutputDiagnostics = [] (no errors)
T3: UI merge: [...[], ...[Error1, Error2]] = [Error1, Error2]
T4: UI hiển thị [2] errors ❌ (STALE DATA!)
```

## Solution

### Single Source of Truth: VSCode Problems API

**Architecture mới:**
```
┌─────────────┐
│   VSCode    │
│  Problems   │ ← ONLY Source
│     API     │
└──────┬──────┘
       │
       ▼
  ┌─────────┐
  │ Backend │ → Query diagnostics → Send to UI
  └─────────┘
       │
       ▼
  ┌──────────┐
  │    UI    │ → Display diagnostics from backend ONLY
  └──────────┘
```

**Principles:**
1. ✅ **No Cache** - Không cache diagnostics trong UI
2. ✅ **Single Source** - Chỉ dùng `toolOutputs[actionId].diagnostics`
3. ✅ **Always Send** - Backend luôn gửi `diagnostics` field (ngay cả khi empty array)
4. ✅ **Consistency > Performance** - Ưu tiên đồng bộ hơn là tốc độ

## Changes

### 1. UI: Remove Cache Merge Logic

**File:** `src/webview-ui/src/features/chat/components/tools/FileToolRenderer.tsx`

**Before:**
```typescript
const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics || [];
const cacheDiagnosticsArray = cachedDiagnostics || [];
const normalized = [...toolOutputDiagnostics, ...cacheDiagnosticsArray].map(...);
```

**After:**
```typescript
// Get diagnostics from toolOutputs ONLY (single source of truth)
const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics;

// If toolOutputs doesn't have diagnostics field, return undefined
if (!toolOutputDiagnostics) return undefined;

// No cache, no merge
const normalized = toolOutputDiagnostics.map(...);
```

### 2. Backend: Always Send Diagnostics Field

**File:** `src/controllers/handlers/FileHandler.ts`

**Before:**
```typescript
webviewView.webview.postMessage({
  command: "writeFileResult",
  diagnostics: diagnostics.length ? diagnostics : undefined, // ❌ Optional
});
```

**After:**
```typescript
// ALWAYS send diagnostics field (even if empty) for consistency
webviewView.webview.postMessage({
  command: "writeFileResult",
  diagnostics: diagnostics, // ✅ Always present ([] if no errors)
});

// When skipDiagnostics = true
webviewView.webview.postMessage({
  command: "writeFileResult",
  diagnostics: [], // ✅ Empty array = diagnostics not checked
});
```

### 3. Keep "Wait for Stable" Logic

Giữ nguyên logic Option 2 (wait for diagnostic stable):
- minTimeout: 1500ms
- stableWaitTime: 800ms (wait 800ms no new events)
- Đảm bảo Language Server xử lý xong TẤT CẢ files trong batch

## Benefits

✅ **Consistency**: UI luôn đồng bộ với backend
✅ **No Stale Data**: Không còn hiển thị diagnostics cũ
✅ **Single Source**: Dễ debug, dễ maintain
✅ **Predictable**: Behavior rõ ràng, không có "magic merge"
✅ **Batch Support**: Xử lý đúng multiple file edits

## Testing

### Test Case: 3 Files Batch Replace
```
File 1: DataTable.tsx → Replace import path → 0 errors
File 2: FilterBar.tsx → Replace import path → 0 errors  
File 3: TableHeader.tsx → Replace import path → 1 error
```

**Expected Result:**
```
UI File 1: No error badge
UI File 2: No error badge
UI File 3: [1] error badge (red)
```

**Backend Log:**
```
[write_to_file] No diagnostics found for DataTable.tsx
[write_to_file] No diagnostics found for FilterBar.tsx
[write_to_file] ✅ Processing 1 diagnostics for TableHeader.tsx
```

**Result:** ✅ UI và backend hoàn toàn đồng bộ!

## Notes

- `diagnostics` field presence trong response:
  - `diagnostics: []` = Đã check, không có lỗi
  - `diagnostics: [...]` = Đã check, có lỗi
  - `diagnostics: undefined` = Chưa check hoặc tool không support

- UI chỉ hiển thị error badge khi:
  - `toolOutputDiagnostics` exists AND
  - `toolOutputDiagnostics.length > 0`

- Removed dependencies:
  - `cachedDiagnostics` prop (deprecated)
  - Merge logic
  - Duplicate removal logic (không cần vì single source)
