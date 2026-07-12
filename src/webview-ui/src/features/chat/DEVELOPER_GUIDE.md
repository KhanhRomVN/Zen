# 👨‍💻 Developer Guide - Chat Component

## 📚 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Hook Documentation](#hook-documentation)
3. [Common Tasks](#common-tasks)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Component Structure

```
ChatPanel (Main Orchestrator)
│
├── Configuration Layer
│   └── useApiConfiguration (API & providers)
│
├── State Management Layer
│   ├── useUIState (UI states)
│   ├── useModelAccount (model selection)
│   └── useDraftManagement (draft input)
│
├── Data Processing Layer
│   ├── useMessageParsing (parse with cache)
│   ├── useContextUsage (token calculation)
│   └── useFileStats (file statistics)
│
├── Business Logic Layer
│   ├── useChatLLM (LLM communication)
│   ├── useToolExecution (tool execution)
│   ├── useGitOperations (git integration)
│   └── useConversationRestore (history)
│
├── Handler Layer
│   ├── useMessageHandlers (send/stop)
│   ├── useTextareaHandlers (textarea)
│   └── useModelSwitch (model switching)
│
├── Integration Layer
│   ├── useExternalMessages (VSCode events)
│   ├── useConversationCache (memory cache)
│   └── useConversationPersistence (storage)
│
└── Presentation Layer
    ├── ChatHeader (top bar)
    ├── ChatBody (messages)
    └── ChatFooter (input area)
```

### Data Flow

```
User Action
    ↓
Handler Hook (useMessageHandlers)
    ↓
Business Logic (useChatLLM)
    ↓
Processing (useMessageParsing)
    ↓
Cache (useConversationCache)
    ↓
Persistence (useConversationPersistence)
    ↓
UI Update (ChatBody)
```

---

## 📖 Hook Documentation

### 1. useApiConfiguration

**Purpose**: Manage API URL and providers configuration

**Location**: `hooks/api/useApiConfiguration.ts`

**Returns**:
```typescript
{
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isApiUrlReady: boolean;
  providers: Provider[];
  setProviders: (providers: Provider[]) => void;
}
```

**Usage**:
```typescript
const { apiUrl, providers } = useApiConfiguration();
```

**When to modify**:
- Adding new API endpoints
- Changing provider loading logic
- Adding API configuration options

---

### 2. useUIState

**Purpose**: Centralize all UI-related state

**Location**: `hooks/ui/useUIState.ts`

**Returns**:
```typescript
{
  // Search
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Modals & Dropdowns
  showProjectStructureDrawer: boolean;
  setShowProjectStructureDrawer: (show: boolean) => void;
  // ... more UI states
}
```

**Usage**:
```typescript
const { isSearchOpen, setIsSearchOpen } = useUIState();
```

**When to modify**:
- Adding new modals/dropdowns
- Adding new UI toggles
- Managing new overlay states

---

### 3. useMessageParsing

**Purpose**: Parse messages with advanced caching

**Location**: `hooks/messages/useMessageParsing.ts`

**Parameters**:
- `messages: Message[]` - Raw messages
- `isStreaming: boolean` - Streaming state

**Returns**: `ParsedMessage[]` (messages with parsed content)

**Usage**:
```typescript
const parsedMessages = useMessageParsing(messages, isStreaming);
```

**Performance Features**:
- ✅ Incremental parsing (only new messages)
- ✅ Content caching (avoid re-parse)
- ✅ Object caching (stable references)
- ✅ Streaming optimization

**When to modify**:
- Changing parsing logic
- Adding new message types
- Optimizing cache strategy

---

### 4. useContextUsage

**Purpose**: Calculate token usage incrementally

**Location**: `hooks/messages/useContextUsage.ts`

**Parameters**:
- `messages: Message[]` - Messages to analyze

**Returns**:
```typescript
{
  prompt: number;
  completion: number;
  total: number;
}
```

**Usage**:
```typescript
const contextUsage = useContextUsage(messages);
```

**Performance**: Incremental computation (O(n) → O(k) where k = new messages)

---

### 5. useFileStats

**Purpose**: Track file changes across conversation

**Location**: `hooks/messages/useFileStats.ts`

**Parameters**:
- `messages: Message[]` - Messages to scan
- `loadedStats: FileStats | null` - Pre-loaded stats

**Returns**:
```typescript
{
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}
```

**Usage**:
```typescript
const fileStats = useFileStats(messages, loadedStats);
```

**Performance**: Incremental scanning (only new messages)

---

### 6. useContextCompression

**Purpose**: Compress long conversations

**Location**: `hooks/compression/useContextCompression.ts`

**Parameters**: Config object with refs

**Returns**:
```typescript
{
  triggerContextCompression: () => void;
  shouldShowCompressionButton: boolean;
}
```

**Usage**:
```typescript
const { triggerContextCompression } = useContextCompression({
  currentConversationIdRef,
  messages,
  isProcessing,
  sendMessage,
  currentModelRef,
  currentAccountRef,
});
```

---

### 7. useMessageHandlers

**Purpose**: Handle message sending and stopping

**Location**: `hooks/handlers/useMessageHandlers.ts`

**Returns**:
```typescript
{
  handleSend: (model: any, account: any) => void;
  handleStopGeneration: () => void;
  handleClearChat: () => void;
}
```

**Usage**:
```typescript
const { handleSend, handleStopGeneration } = useMessageHandlers({
  message,
  uploadedFiles,
  // ... other config
});
```

---

### 8. useTextareaHandlers

**Purpose**: Handle textarea interactions

**Location**: `hooks/handlers/useTextareaHandlers.ts`

**Returns**:
```typescript
{
  handleTextareaChange: (e: ChangeEvent) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleOpenImage: (file: any) => void;
}
```

---

### 9. useModelSwitch

**Purpose**: Handle model switching with context

**Location**: `hooks/handlers/useModelSwitch.ts`

**Returns**:
```typescript
{
  handleModelSwitch: (
    newModel: any,
    newAccount: any,
    contextData: any
  ) => void;
}
```

---

### 10. useExternalMessages

**Purpose**: Handle messages from VSCode extension

**Location**: `hooks/events/useExternalMessages.ts`

**Usage**:
```typescript
useExternalMessages({
  currentChat,
  currentConversationId,
  messages,
  setMessages,
  setProjectContext,
  addAttachedItem,
});
```

**Handles**:
- Project context updates
- File/folder attachments
- Context compression acceptance

---

### 11. useConversationCache

**Purpose**: Manage in-memory conversation cache

**Location**: `hooks/cache/useConversationCache.ts`

**Usage**:
```typescript
useConversationCache({
  currentConversationId,
  messages,
  isStreaming,
  currentModel,
  currentAccount,
  toolOutputs,
  conversationFileStats,
});
```

**Performance**: Skips updates during streaming

---

### 12. useConversationPersistence

**Purpose**: Persist conversation to storage

**Location**: `hooks/persistence/useConversationPersistence.ts`

**Usage**:
```typescript
useConversationPersistence({
  currentConversationId,
  currentChat,
  messages,
  toolOutputs,
  singleLineReviewActions,
  conversationFileStats,
});
```

**Persists**:
- Tool outputs
- Single-line review actions
- File statistics

---

## 🛠️ Common Tasks

### Adding a New UI State

**Step 1**: Add to `useUIState.ts`
```typescript
export const useUIState = () => {
  const [myNewState, setMyNewState] = useState(false);
  
  return {
    // ... existing states
    myNewState,
    setMyNewState,
  };
};
```

**Step 2**: Use in main component
```typescript
const { myNewState, setMyNewState } = useUIState();
```

### Adding a New Message Handler

**Step 1**: Add to `useMessageHandlers.ts`
```typescript
const handleMyAction = useCallback(() => {
  // Your logic here
}, [dependencies]);

return {
  // ... existing handlers
  handleMyAction,
};
```

**Step 2**: Use in component
```typescript
const { handleMyAction } = useMessageHandlers({ /* config */ });
```

### Optimizing a Hook

**Before**:
```typescript
// Runs on every render
const result = messages.map(heavyOperation);
```

**After**:
```typescript
// Runs only when messages change
const result = useMemo(
  () => messages.map(heavyOperation),
  [messages]
);
```

### Adding Caching

```typescript
const cacheRef = useRef(new Map());

const getCachedValue = (key: string) => {
  if (cacheRef.current.has(key)) {
    return cacheRef.current.get(key);
  }
  const value = expensiveComputation(key);
  cacheRef.current.set(key, value);
  return value;
};
```

---

## 💡 Best Practices

### 1. Hook Dependencies

**❌ Bad**:
```typescript
useEffect(() => {
  doSomething(messages);
}, []); // Missing dependency!
```

**✅ Good**:
```typescript
useEffect(() => {
  doSomething(messages);
}, [messages]);
```

### 2. Refs for Latest Values

**❌ Bad**:
```typescript
// Stale closure
const handleClick = useCallback(() => {
  console.log(currentModel); // May be old value
}, []);
```

**✅ Good**:
```typescript
const currentModelRef = useRef(currentModel);
currentModelRef.current = currentModel;

const handleClick = useCallback(() => {
  console.log(currentModelRef.current); // Always latest
}, []);
```

### 3. Incremental Computation

**❌ Bad**:
```typescript
// Recalculates everything
const total = messages.reduce((sum, m) => sum + m.tokens, 0);
```

**✅ Good**:
```typescript
const lastLengthRef = useRef(0);
const lastTotalRef = useRef(0);

const total = useMemo(() => {
  if (messages.length >= lastLengthRef.current) {
    // Only add new messages
    const newMessages = messages.slice(lastLengthRef.current);
    const newTotal = newMessages.reduce((sum, m) => sum + m.tokens, 0);
    lastTotalRef.current += newTotal;
    lastLengthRef.current = messages.length;
    return lastTotalRef.current;
  }
  // Full recompute if array shrunk
  return messages.reduce((sum, m) => sum + m.tokens, 0);
}, [messages]);
```

### 4. Memoization

```typescript
// Expensive computation
const parsedData = useMemo(
  () => expensiveParser(data),
  [data]
);

// Stable callback reference
const handleAction = useCallback(
  () => doSomething(value),
  [value]
);
```

### 5. Early Returns

**❌ Bad**:
```typescript
useEffect(() => {
  if (condition) {
    doSomething();
  }
}, [condition]);
```

**✅ Good**:
```typescript
useEffect(() => {
  if (!condition) return;
  doSomething();
}, [condition]);
```

---

## 🐛 Troubleshooting

### Issue: Hook re-renders too often

**Diagnosis**:
```typescript
// Add logging
useEffect(() => {
  console.log('Hook re-rendered', { dependency1, dependency2 });
});
```

**Solutions**:
- Use `useMemo` for expensive computations
- Use `useCallback` for functions
- Check dependency arrays
- Use refs for non-reactive values

### Issue: Stale values in callbacks

**Problem**: Callback uses old state value

**Solution**: Use refs
```typescript
const valueRef = useRef(value);
valueRef.current = value;

const callback = useCallback(() => {
  useLatest(valueRef.current);
}, []);
```

### Issue: Performance degradation

**Diagnosis**:
```typescript
const startTime = performance.now();
// ... computation
console.log(`Took ${performance.now() - startTime}ms`);
```

**Solutions**:
- Add memoization
- Implement incremental updates
- Use caching strategies
- Profile with React DevTools

### Issue: Memory leaks

**Check for**:
- Unsubscribed event listeners
- Unclosed intervals/timeouts
- Growing caches without limits

**Solution**:
```typescript
useEffect(() => {
  const handler = () => {};
  window.addEventListener('event', handler);
  return () => {
    window.removeEventListener('event', handler);
  };
}, []);
```

---

## 📝 Testing Examples

### Testing a Hook

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useMessageParsing } from './useMessageParsing';

describe('useMessageParsing', () => {
  it('parses messages correctly', () => {
    const messages = [
      { id: '1', content: 'Hello', role: 'user' }
    ];
    
    const { result } = renderHook(() => 
      useMessageParsing(messages, false)
    );
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].parsed).toBeDefined();
  });
  
  it('uses cache for same content', () => {
    const messages = [
      { id: '1', content: 'Same', role: 'user' },
      { id: '2', content: 'Same', role: 'user' }
    ];
    
    const { result } = renderHook(() => 
      useMessageParsing(messages, false)
    );
    
    // Both should use same parsed result reference
    expect(result.current[0].parsed).toBe(result.current[1].parsed);
  });
});
```

---

## 🚀 Performance Tips

1. **Use incremental computation**: Only process new data
2. **Cache expensive operations**: Store computed results
3. **Stable references**: Use `useMemo`/`useCallback`
4. **Refs for latest values**: Avoid stale closures
5. **Early returns**: Skip unnecessary work
6. **Batch updates**: Use `unstable_batchedUpdates` if needed

---

**Need Help?** Check the individual hook files for more detailed comments and examples.
