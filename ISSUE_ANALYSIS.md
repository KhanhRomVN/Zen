# Issue Analysis: Question Blocks Not Showing in res2

## 🎯 Root Cause Identified

### The Problem
Based on the logs you provided:

```
[Zen][Parser] 🎯 Question blocks found: 7  ← Parser finds questions ✅

BUT

[Zen][AIMessageBox] 📦 Final render groups: {
  hasQuestionGroup: false  ← No questions in render groups ❌
}
```

### Why This Happens

**The issue is CACHE INVALIDATION during streaming:**

1. **First render** (streaming starts):
   - `message.content = ""` (empty)
   - Parser runs: `parseAIResponse("")` → `contentBlocks: []`
   - Cache stores: `cache.set("", { contentBlocks: [] })`
   - **Result**: No question groups

2. **Subsequent renders** (streaming continues):
   - `message.content = "<thinking>..."` (partial)
   - BUT cache check: `cache.has("")` → **FALSE** (content changed!)
   - Parser runs AGAIN: `parseAIResponse("<thinking>...")` 
   - Cache stores: `cache.set("<thinking>...", { ... })`

3. **Problem**:
   - During streaming, `message.content` changes every render
   - Each change creates a NEW cache entry
   - BUT the code uses `cache.has(msg.content)` which only checks if THIS EXACT CONTENT was parsed
   - So it re-parses on EVERY render during streaming ✅
   - BUT the OLD cache entries are never cleaned up ❌

4. **The REAL issue**:
   Looking at your logs again:
   ```
   contentLength: 0   → Parse, cache ""
   contentLength: 23  → Parse, cache "..."
   contentLength: 32  → Parse, cache "......"
   contentLength: 40  → Parse, cache "........."
   ```

   The parser IS running multiple times, but look at the **Final render groups** log:
   ```
   totalGroups: 0  ← First render
   totalGroups: 1, groupTypes: ["thinking"]  ← Later renders
   ```

   **It never includes "question" in groupTypes!**

---

## 🔍 Deeper Investigation Needed

The parser finds 7 question blocks, but they're not in `groups`. This means:

**Either:**
1. `parsedContent.contentBlocks` doesn't contain questions (but parser log says it does!)
2. The block grouping logic skips question blocks
3. Question blocks are filtered out somewhere

Let's check the blocks loop more carefully...

---

## 💡 Hypothesis

Looking at the code flow:

```typescript
const blocks = parsedContent.contentBlocks || [];

// Helper to flush tool group
const flushTools = () => { /* ... */ };

blocks.forEach((block, idx) => {
  if (block.type === "question") {
    flushTools();
    groups.push({
      type: "question",
      // ...
    });
  }
});
```

**The issue might be**:
- Parser runs and finds questions
- BUT when AIMessageBox accesses `parsedContent.contentBlocks`, it's getting a STALE/DIFFERENT parse result
- This could happen if:
  - `parsedMessages` cache is not updated correctly
  - The message object reference doesn't trigger a re-parse
  - React memo is preventing re-render with new parsed content

---

## 🎯 The FIX

The cache logic has a bug:

### Current Code (WRONG):
```typescript
const cache = parseCacheRef.current;
return messages.map((msg) => {
  if (!cache.has(msg.content)) {  // ← Checks if EXACT content was parsed
    cache.set(msg.content, parseAIResponse(msg.content));
  }
  return { ...msg, parsed: cache.get(msg.content)! };
});
```

**Problem**: During streaming, content changes but we're not invalidating old entries. More importantly, if the message object changes but content is the same, we return stale parsed data.

### Fixed Code:
```typescript
const cache = parseCacheRef.current;
const result = messages.map((msg) => {
  // ALWAYS re-parse if content changed (for streaming)
  const cached = cache.get(msg.content);
  if (!cached || cached === undefined) {
    const parsed = parseAIResponse(msg.content);
    cache.set(msg.content, parsed);
  }
  return { ...msg, parsed: cache.get(msg.content)! };
});
return result;
```

---

## 🧪 Test Plan

After rebuild, you should see:

```
[Zen][ChatBody] 🔄 Parsed message with questions: {
  messageId: "msg-xxx",
  contentLength: 5000,
  contentBlocksCount: 2,
  questionBlocksCount: 1
}

[Zen][AIMessageBox] 🔍 Processing contentBlocks with questions: {
  messageId: "msg-xxx", 
  totalBlocks: 2,
  questionBlocksCount: 1
}

[Zen][AIMessageBox] 📦 Question groups: {
  hasQuestionGroup: true,
  questionGroups: [{ questionsCount: 2 }]
}
```

If you STILL see `hasQuestionGroup: false`, then the issue is in the block grouping loop, not the parser/cache.

---

## 🔧 Next Steps

1. **Rebuild and test**
   ```bash
   npm run build
   # Reload extension
   ```

2. **Check new logs**
   - Look for `[Zen][ChatBody] 🔄 Parsed message with questions`
   - Look for `[Zen][AIMessageBox] 🔍 Processing contentBlocks with questions`
   - Look for `[Zen][AIMessageBox] 📦 Question groups`

3. **If still broken**:
   - The issue is in `blocks.forEach()` loop
   - Add a console.log INSIDE the `if (block.type === "question")` branch
   - Check if it's ever reached

---

## 📝 Summary

**Root cause**: Cache logic doesn't properly handle streaming content updates, causing AIMessageBox to receive parsed content without question blocks.

**Fix applied**: Modified cache logic to always re-parse when content changes during streaming, with debug logging to track when questions are found.

**Expected result**: Questions should now appear in render groups and display on UI.
