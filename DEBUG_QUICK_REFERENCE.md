# Quick Debug Reference - Question Block Not Showing

## 🚀 Quick Start

### 1. Run Test Script (Node.js)
```bash
cd tests/parser/test
node question-rendering-test.js
```

This will tell you if the parser is working correctly.

### 2. Build & Reload Extension
```bash
npm run build
# Then reload extension in VS Code
```

### 3. Test in VS Code
1. Send "test tag question" 
2. Answer the questions
3. Look at res2
4. Open Developer Tools (Help > Toggle Developer Tools)
5. Check console logs

---

## 📋 Log Checkpoints

### Checkpoint 1: Parser ✅
**Look for**: `[Zen][Parser] 🎯 Question blocks found`

**If you see this**: Parser is working ✅
**If you don't**: Parser bug ❌

```javascript
// Expected output:
[Zen][Parser] 🎯 Question blocks found: 1
  Question 1: {
    hasNewSchema: true,
    questionsCount: 2,
    questionIds: ["1", "2"]
  }
```

---

### Checkpoint 2: Message Visibility ✅
**Look for**: `[Zen][ChatBody] 📨 Rendering message`

**Check**:
- `messageId` matches res2
- `hasQuestion: true`
- `contentBlocksCount > 0`

```javascript
// Expected output:
[Zen][ChatBody] 📨 Rendering message: {
  messageId: "msg-xxx",
  role: "assistant",
  hasQuestion: true,
  contentBlocksCount: 2,
  blockTypes: ["markdown", "question"]
}
```

**If message is missing**: Check `visibleMessages filter` log above

---

### Checkpoint 3: Group Creation ✅
**Look for**: `[Zen][AIMessageBox] 🎯 Adding question group`

```javascript
// Expected output:
[Zen][AIMessageBox] 🎯 Adding question group: {
  messageId: "msg-xxx",
  hasQuestions: true,
  questionsCount: 2
}
```

**Then check**: `[Zen][AIMessageBox] 📦 Final render groups`

```javascript
// Expected output:
[Zen][AIMessageBox] 📦 Final render groups: {
  groupTypes: ["markdown", "question"],
  hasQuestionGroup: true
}
```

**If `hasQuestionGroup: false`**: Group was filtered (unlikely for question)

---

### Checkpoint 4: Component Render ✅
**Look for**: `[Zen][QuestionBlock] 🎬 Component render`

```javascript
// Expected output:
[Zen][QuestionBlock] 🎬 Component render: {
  isPaginated: true,
  questionsCount: 2,
  disabled: false
}
```

**Then check**: `[Zen][QuestionBlock] 🎨 Render decision`

```javascript
// Expected output:
[Zen][QuestionBlock] 🎨 Render decision: {
  isPaginated: true,
  isSummaryMode: false,
  willRenderSummary: false
}
```

---

## 🔍 Common Issues & Solutions

### Issue 1: No contentBlocks
**Symptom**: `[Zen][Parser] ⚠️ WARNING: No contentBlocks generated`

**Cause**: XML malformed or parser bug

**Solution**:
1. Check res2 content in message state
2. Verify `<question>` and `</question>` tags are properly closed
3. Run test script to isolate parser

---

### Issue 2: Message Hidden
**Symptom**: res2 not in `visibleMessages filter` log

**Cause**: `uiHidden: true` or `isCancelled: true`

**Solution**:
1. Check message state in Redux/Context
2. Look for code that sets these flags
3. Check if message was properly added to messages array

---

### Issue 3: Question Group Filtered
**Symptom**: 
- `🎯 Adding question group` appears
- But `hasQuestionGroup: false` in final groups

**Cause**: Simple mode filter (unlikely for questions)

**Solution**:
1. Check `isSimpleMode` value
2. Question groups shouldn't be filtered in simple mode
3. If they are, it's a bug in filter logic

---

### Issue 4: Component Returns Null
**Symptom**: `[Zen][QuestionBlock] ⚠️ Not rendering - invalid state`

**Cause**: 
- `isPaginated: false` (no questions array)
- `hasCurrentQuestion: false` (questions array empty)

**Solution**:
1. Check props passed to QuestionBlock
2. Verify `questions` array exists and has items
3. Check parser output format

---

### Issue 5: Component in Summary Mode
**Symptom**: `willRenderSummary: true` when it should be false

**Cause**: 
- `isSummaryMode` state incorrectly set
- Previous answers trigger summary view

**Solution**:
1. Check `initialAnswers` prop
2. Verify answer count vs question count
3. May need to reset state between messages

---

## 🎯 Most Likely Issues (in order)

1. **Parser not creating question block** (40%)
   - Check XML structure
   - Run test script

2. **Message not in state** (30%)
   - Check message array in ChatBody
   - Verify res2 was added

3. **Component state issue** (20%)
   - Summary mode triggered incorrectly
   - Check initialAnswers

4. **Filter logic bug** (10%)
   - Less likely but check logs

---

## 💡 Tips

### Enable Full Debug Mode
```javascript
localStorage.setItem('zen_debug_parser', 'true');
```

### Quick Check: Is Parser Working?
```bash
node tests/parser/test/question-rendering-test.js | grep "PASS\|FAIL"
```

### Search Logs Efficiently
In DevTools console:
```javascript
// Filter to only question-related logs
console.log = (function(oldLog) {
  return function(...args) {
    if (args[0]?.includes?.('Question') || args[0]?.includes?.('question')) {
      oldLog.apply(console, args);
    }
  };
})(console.log);
```

---

## 📞 Next Steps

If logs show everything working but UI still doesn't show:

1. Check React DevTools - is QuestionBlock in component tree?
2. Check CSS - is component rendered but hidden (display: none, opacity: 0)?
3. Check Z-index - is component behind another element?
4. Take screenshot of element tree and share

---

## 🐛 Report Format

When reporting, include:

```
1. Test script result: PASS/FAIL
2. All checkpoint logs (copy from console)
3. Message state (messages array)
4. Screenshot of UI
5. res2 content (XML string)
```
