cccx# Tool Development Guide

Hướng dẫn chi tiết về cách thêm, sửa, xóa một tool trong hệ thống Agent Chat.

---

## 📋 Tổng quan Architecture

Khi thêm/sửa/xóa một tool, bạn cần cập nhật các thành phần sau theo thứ tự:

1. **Backend Logic** - Handler xử lý nghiệp vụ
2. **Parser** - Parse XML tags từ AI
3. **Executor** - Thực thi tool
4. **Type Definitions** - Định nghĩa types
5. **Response Parser** - Parse response từ AI
6. **UI Renderer** - Hiển thị kết quả trong chat
7. **Constants** - Tool metadata
8. **Prompts** - Hướng dẫn AI sử dụng tool

---

## 🗂️ Cấu trúc Files & Folders

### 1️⃣ **Backend Handlers** (Module-specific)
📁 `src/renderer/src/modules/{module}/handler/`

**Mục đích:** Xử lý logic nghiệp vụ thực tế của tool

**Ví dụ:**
- `src/renderer/src/modules/Emulate/handler/ListResourcesHandler.ts`
- `src/renderer/src/modules/Emulate/handler/GetResourceContentHandler.ts`
- `src/renderer/src/modules/Code/handler/ReadFileHandler.ts`

**Nhiệm vụ:**
- Xử lý dữ liệu từ requests, filesystem, etc.
- Return kết quả dạng structured data hoặc text
- Không biết gì về UI, chỉ lo business logic

**Khi thêm tool mới:**
```typescript
export class NewToolHandler {
  public handle(params: NewToolParams): NewToolResult {
    // Business logic here
    return { text: '...', data: {...} };
  }
}
```

**Khi sửa tool:**
- Sửa logic xử lý trong method `handle()`
- Thay đổi format output nếu cần

**Khi xóa tool:**
- Xóa file handler
- Xóa import trong controller

---

### 2️⃣ **Module Controller**
📁 `src/renderer/src/controller/{Module}Controller.ts`

**Mục đích:** Singleton controller điều phối các handlers

**Ví dụ:**
- `src/renderer/src/controller/EmulateController.ts`
- `src/renderer/src/controller/CodeController.ts`

**Nhiệm vụ:**
- Quản lý state (requests, files, etc.)
- Expose static method `executeTool()` cho executor gọi
- Route tool calls đến đúng handler

**Khi thêm tool mới:**
```typescript
// 1. Import handler
import { NewToolHandler } from '../modules/Module/handler/NewToolHandler';

// 2. Khai báo instance
private newToolHandler: NewToolHandler;

// 3. Initialize trong constructor
this.newToolHandler = new NewToolHandler();

// 4. Thêm case trong executeTool()
case 'new_tool': {
  if (!params.requiredParam) return { success: false, error: 'param required' };
  return { success: true, data: { output: ctrl.newToolText(params.requiredParam) } };
}

// 5. Thêm public method
public newToolText(param: string): string {
  return this.newToolHandler.handle(param).text;
}
```

**Khi xóa tool:**
- Xóa import handler
- Xóa instance declaration
- Xóa initialization
- Xóa case trong `executeTool()`
- Xóa public method

---

### 3️⃣ **Parsers**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/services/parsers/`

**Mục đích:** Parse XML tags từ AI response thành params object

**Files:**
- `EmulateParser.ts` - Parse emulate tools
- `CodeParser.ts` - Parse code tools
- `ReconParser.ts` - Parse recon tools

**Khi thêm tool mới:**
```typescript
/**
 * Parse new_tool tag from AI response.
 * Format: <new_tool><param1>value</param1><param2>value</param2></new_tool>
 */
export function parseNewTool(innerContent: string): NewToolParams {
  const params: NewToolParams = { param1: '' };
  
  const param1 = extractParamValue(innerContent, 'param1');
  if (param1) params.param1 = param1.trim();
  
  const param2 = extractParamValue(innerContent, 'param2');
  if (param2) params.param2 = parseInt(param2, 10);
  
  return params;
}
```

**Khi sửa tool:**
- Thêm/xóa/sửa param extraction logic
- Update return type

**Khi xóa tool:**
- Xóa hàm parse
- Xóa export

---

### 4️⃣ **Type Definitions**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/types/tool-types.ts`

**Mục đích:** Định nghĩa TypeScript types cho tool params

**Khi thêm tool mới:**
```typescript
export interface NewToolParams {
  param1: string;
  param2?: number; // optional
  filter?: {
    type?: string;
  };
}
```

**Khi sửa tool:**
- Thêm/xóa fields
- Update existing fields

**Khi xóa tool:**
- Xóa interface definition

---

### 5️⃣ **Executors**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/services/tool-executors/`

**Mục đích:** Thực thi tool bằng cách gọi controller

**Files:**
- `EmulateExecutor.ts`
- `CodeExecutor.ts`
- `ReconExecutor.ts`

**Khi thêm tool mới:**
```typescript
export interface NewToolParams {
  param1: string;
  param2?: number;
}

/** Execute new_tool — gọi ModuleController.executeTool() */
export async function executeNewTool(params: NewToolParams): Promise<string | null> {
  const result = await ModuleController.executeTool('new_tool', {
    param1: params.param1,
    param2: params.param2,
  });

  if (!result.success) {
    return '[new_tool] Result: Error - ' + (result.error || '');
  }
  return (result.data as any)?.output || null;
}
```

**Khi xóa tool:**
- Xóa interface và function

---

### 6️⃣ **Executor Index (Registry)**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/services/tool-executors/index.ts`

**Mục đích:** Central registry mapping tool names → executor functions

**Khi thêm tool mới:**
```typescript
import { executeNewTool } from './ModuleExecutor';

case 'new_tool':
  return {
    execute: async (action: any, _ctx: ExecutorContext, _options?: ExecutorOptions) => {
      const result = await executeNewTool(action.params);
      return {
        output: result || '[new_tool] No output',
        isError: result?.startsWith('[new_tool] Result: Error'),
      };
    },
  };
```

**Khi xóa tool:**
- Xóa import
- Xóa case trong switch

---

### 7️⃣ **Response Parser**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/services/ResponseParser.ts`

**Mục đích:** Parse AI response, extract tool calls

**Khi thêm tool mới:**
```typescript
case 'new_tool': {
  const params = parseNewTool(innerContent || '');
  action = { type: 'new_tool' as const, params, rawXml };
  break;
}
```

**Trong `parseToolUseBlock()`:**
```typescript
'new_tool',
```

**Khi xóa tool:**
- Xóa case trong switch
- Xóa tool name khỏi array

---

### 8️⃣ **UI Blocks** (Optional)
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/blocks/`

**Mục đích:** Reusable UI components để hiển thị nội dung tool output

**Cấu trúc:**
- `code/` - Blocks cho code tools (GrepBlock, etc.)
- `emulate/` - Blocks cho emulate tools
- `other/` - Shared blocks (TreeBlock, ErrorBlock, etc.)

**Khi thêm block mới:**
```typescript
interface NewBlockProps {
  content: string;
  maxHeight?: string;
}

export const NewBlock: React.FC<NewBlockProps> = ({ content, maxHeight }) => {
  // Parse content
  // Render UI
  return <div>...</div>;
};
```

**Khi xóa block:**
- Xóa file
- Xóa imports trong renderers

---

### 9️⃣ **UI Renderers**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/renderers/`

**Mục đích:** Render tool execution trong chat UI

**Cấu trúc:**
- `code/` - Code tool renderers (ReadFileRenderer, GrepRenderer, etc.)
- `emulate/` - Emulate tool renderers
- `recon/` - Recon tool renderers

**Khi thêm renderer mới:**
```typescript
export const NewToolRenderer: React.FC<BaseRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastItemInList,
  toolOutputs,
  allMessages,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  
  const actionId = `${messageId}-action-${actionIndex}`;
  const output = toolOutputs?.[actionId]?.output;
  const isError = !!toolOutputs?.[actionId]?.isError;
  
  return (
    <div className={cn('flex flex-col gap-1.5 pb-1', isLastItemInList ? 'mb-0' : 'mb-0.5')}>
      <TagHeader
        title={<div>...</div>}
        statusColor={isError ? 'rgb(255, 45, 85)' : 'rgb(48, 209, 88)'}
        toolType="new_tool"
        onClick={() => setIsCollapsed(v => !v)}
      />
      {output && !isError && !isCollapsed && (
        <NewBlock content={output} />
      )}
    </div>
  );
};
```

**Khi xóa renderer:**
- Xóa file
- Xóa export khỏi index.ts

---

### 🔟 **Renderer Index**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/renderers/index.ts`

**Mục đích:** Export tất cả renderers

**Khi thêm renderer mới:**
```typescript
export { NewToolRenderer } from './module/NewToolRenderer';
```

**Khi xóa renderer:**
- Xóa export line

---

### 1️⃣1️⃣ **TagRouter**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/TagRouter.tsx`

**Mục đích:** Route tool types → renderer components

**Khi thêm tool mới:**
```typescript
import { NewToolRenderer } from './renderers';

case 'new_tool':
  return <NewToolRenderer key={key} {...baseProps} />;
```

**Khi xóa tool:**
- Xóa import
- Xóa case

---

### 1️⃣2️⃣ **Constants**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/constants/`

**Files:**
- `constants.ts` - Tool labels, categories
- `emulate.ts` - Emulate-specific constants
- `code.ts` - Code-specific constants

**Khi thêm tool mới trong `constants.ts`:**
```typescript
export const TOOL_CONFIG: Record<string, ToolConfig> = {
  new_tool: {
    id: "new_tool",
    title: "NEW TOOL",
    category: "tool",
  },
};
```

**Trong category-specific file (e.g., `emulate.ts`):**
```typescript
export const EMULATE_TOOL_CONFIG = {
  new_tool: {
    id: "new_tool",
    title: "NEW TOOL",
    category: "tool",
  },
};
```

**Khi xóa tool:**
- Xóa entry khỏi config objects

---

### 1️⃣3️⃣ **Prompts / Tools Reference**
📁 `src/renderer/src/components/RightPanel/Agent/feature/Chat/prompts/{module}/`

**Files quan trọng:**
- `tools-reference.ts` - Tool documentation cho AI
- `tools-list.md` - Human-readable tool list
- `index.ts` - Export prompts

**Khi thêm tool mới trong `tools-reference.ts`:**
```typescript
export const TOOLS_REFERENCE = `
**new_tool**: Brief description of what the tool does.
- \`param1\`: Description (required/optional).
- \`param2\`: Description with values. Values: \`value1\`, \`value2\`, \`value3\`
- Returns: What the tool returns.
- Examples:
  - \`<new_tool><param1>value</param1></new_tool>\` — description
  - \`<new_tool><param1>value</param1><param2>123</param2></new_tool>\` — with optional param
- ⚠ IMPORTANT NOTE: Any important usage rules or requirements.
`;
```

**Khi thêm tool mới trong `tools-list.md`:**
```markdown
## new_tool
Brief description

**Parameters:**
- `param1` (required): Description
- `param2` (optional): Description

**Example:**
\`\`\`xml
<new_tool>
  <param1>value</param1>
  <param2>123</param2>
</new_tool>
\`\`\`
```

**Khi xóa tool:**
- Xóa documentation khỏi cả 2 files

---

## 🔄 Workflow: Thêm Tool Mới

### Step 1: Backend Logic
1. Tạo Handler trong `src/renderer/src/modules/{Module}/handler/NewToolHandler.ts`
2. Update Controller để route tool call đến handler

### Step 2: Parser & Types
3. Thêm parse function trong `services/parsers/{Module}Parser.ts`
4. Thêm interface trong `types/tool-types.ts`

### Step 3: Executor
5. Thêm executor function trong `services/tool-executors/{Module}Executor.ts`
6. Register trong `services/tool-executors/index.ts`

### Step 4: Response Parsing
7. Thêm case trong `services/ResponseParser.ts`

### Step 5: UI Layer
8. (Optional) Tạo Block component trong `blocks/{category}/`
9. Tạo Renderer trong `renderers/{category}/NewToolRenderer.tsx`
10. Export renderer trong `renderers/index.ts`
11. Route trong `TagRouter.tsx`

### Step 6: Configuration
12. Thêm constants trong `constants/constants.ts` và category-specific file
13. Update prompts trong `prompts/{module}/tools-reference.ts` và `tools-list.md`

---

## 🔄 Workflow: Sửa Tool Existing

### Thay đổi Input/Output Format
1. **Handler** - Sửa logic xử lý, format output
2. **Parser** - Sửa param extraction nếu tag format thay đổi
3. **Types** - Update interface
4. **Executor** - Update params passing
5. **Renderer** - Update parsing output để hiển thị
6. **Prompts** - Update documentation

### Thay đổi UI
1. **Block** - Sửa component rendering logic
2. **Renderer** - Update props passing to block
3. Không cần sửa backend

### Thay đổi Business Logic
1. **Handler** - Sửa logic xử lý
2. Không cần sửa UI

---

## 🗑️ Workflow: Xóa Tool

1. ✅ **Handler** - Xóa file, xóa import trong controller
2. ✅ **Controller** - Xóa case trong executeTool(), xóa public method
3. ✅ **Parser** - Xóa parse function
4. ✅ **Types** - Xóa interface
5. ✅ **Executor** - Xóa executor function
6. ✅ **Executor Index** - Xóa case
7. ✅ **Response Parser** - Xóa case
8. ✅ **Block** (if exists) - Xóa file
9. ✅ **Renderer** - Xóa file
10. ✅ **Renderer Index** - Xóa export
11. ✅ **TagRouter** - Xóa import và case
12. ✅ **Constants** - Xóa entry
13. ✅ **Prompts** - Xóa documentation

---

## 📝 Naming Conventions

### Tool Names
- Lowercase, underscore-separated: `list_resources`, `get_source_detail`
- Verb + Noun pattern: `read_file`, `write_to_file`, `list_https`

### File Names
- PascalCase + suffix: `ListResourcesHandler.ts`, `GetSourceDetailRenderer.tsx`
- Handler: `{ToolName}Handler.ts`
- Renderer: `{ToolName}Renderer.tsx`
- Block: `{Name}Block.tsx`
- Parser: `{Module}Parser.ts`
- Executor: `{Module}Executor.ts`

### Component Names
- PascalCase: `ListResourcesRenderer`, `TreeBlock`
- Export as named export: `export const ComponentName: React.FC = ...`

### Function Names
- camelCase: `parseListResources`, `executeGetSourceDetail`
- Parse functions: `parse{ToolName}`
- Execute functions: `execute{ToolName}`

---

## 🎯 Best Practices

### 1. Separation of Concerns
- **Handler:** Pure business logic, no UI knowledge
- **Renderer:** Pure UI logic, calls executor for data
- **Block:** Reusable UI components

### 2. Error Handling
- Handler returns `{ success: boolean, data?: any, error?: string }`
- Executor wraps errors in `[tool_name] Result: Error - ...`
- Renderer shows ErrorBlock for errors

### 3. Type Safety
- Always define interfaces in `tool-types.ts`
- Use same interface in Parser, Executor, and Renderer
- Export types for reuse

### 4. Consistent Formatting
- Output format: `[tool_name] {Summary}\n\n{Details}`
- Error format: `[tool_name] Error: {message}`

### 5. Documentation
- Document in `tools-reference.ts` for AI
- Document in `tools-list.md` for humans
- Include examples in both

---

## 🐛 Common Issues

### Tool không được AI gọi
✅ Check: `tools-reference.ts` có đúng format không?
✅ Check: Tool name có trong `ResponseParser.ts` không?

### Tool execute nhưng không hiển thị
✅ Check: Renderer có được register trong `TagRouter.tsx` không?
✅ Check: Tool name match giữa executor và renderer không?

### Parse params bị sai
✅ Check: Parser function có extract đúng XML tags không?
✅ Check: AI response có đúng format không? (log trong ResponseParser)

### Output hiển thị sai
✅ Check: Block component parse output format đúng không?
✅ Check: Renderer pass đúng props cho Block không?

---

## 📚 Examples

### Example: Adding `list_cookies` Tool

#### 1. Handler
```typescript
// src/renderer/src/modules/Emulate/handler/ListCookiesHandler.ts
export class ListCookiesHandler {
  public handle(requests: NetworkRequest[]): { text: string } {
    const cookies = extractCookies(requests);
    return { text: formatCookiesList(cookies) };
  }
}
```

#### 2. Controller
```typescript
// EmulateController.ts
case 'list_cookies': {
  return { success: true, data: { output: ctrl.listCookiesText() } };
}

public listCookiesText(): string {
  return this.listCookiesHandler.handle(this.requests).text;
}
```

#### 3. Parser
```typescript
// EmulateParser.ts
export function parseListCookies(innerContent: string): ListCookiesParams {
  return {}; // No params
}
```

#### 4. Types
```typescript
// tool-types.ts
export interface ListCookiesParams {
  // No params for this tool
}
```

#### 5. Executor
```typescript
// EmulateExecutor.ts
export async function executeListCookies(): Promise<string | null> {
  const result = await EmulateController.executeTool('list_cookies');
  return (result.data as any)?.output || null;
}
```

#### 6. Executor Index
```typescript
// index.ts
case 'list_cookies':
  return {
    execute: async () => {
      const result = await executeListCookies();
      return { output: result || '[list_cookies] No output' };
    },
  };
```

#### 7. Response Parser
```typescript
// ResponseParser.ts
case 'list_cookies': {
  const params = parseListCookies(innerContent || '');
  action = { type: 'list_cookies' as const, params, rawXml };
  break;
}
```

#### 8. Renderer
```typescript
// renderers/emulate/ListCookiesRenderer.tsx
export const ListCookiesRenderer: React.FC<BaseRendererProps> = ({...}) => {
  return (
    <div>
      <TagHeader title="LIST COOKIES" toolType="list_cookies" />
      <CookiesBlock content={output} />
    </div>
  );
};
```

#### 9. TagRouter
```typescript
// TagRouter.tsx
case 'list_cookies':
  return <ListCookiesRenderer key={key} {...baseProps} />;
```

#### 10. Constants
```typescript
// emulate.ts
list_cookies: {
  id: "list_cookies",
  title: "LIST COOKIES",
  category: "tool",
},
```

#### 11. Prompts
```typescript
// tools-reference.ts
**list_cookies**: List all cookies from captured requests.
- No parameters.
- Returns: A table with cookie names, values, domains, and paths.
- Example: \`<list_cookies />\`
```

---

## 🔍 Debugging Tips

### Enable Logging
```typescript
// In Handler
console.log('[NewTool] Input:', params);
console.log('[NewTool] Output:', result);

// In Parser
console.log('[Parser] Raw XML:', innerContent);
console.log('[Parser] Parsed params:', params);

// In Executor
console.log('[Executor] Result:', result);
```

### Check Tool Flow
1. AI generates XML → Check in chat raw message
2. ResponseParser extracts → Check `action` object
3. Parser parses → Check `params` object
4. Executor calls controller → Check controller logs
5. Handler processes → Check handler logs
6. Renderer displays → Check renderer props

---

## 📖 Related Documentation

- **TypeScript Types:** `src/renderer/src/components/RightPanel/Agent/feature/Chat/types/`
- **Utils:** `src/renderer/src/components/RightPanel/Agent/feature/Chat/utils/`
- **Shared Components:** `src/renderer/src/components/common/`

---

Khi làm việc với tools, luôn luôn:
✅ Follow naming conventions
✅ Update tất cả các files liên quan
✅ Test thoroughly
✅ Document trong prompts
✅ Keep separation of concerns

Good luck! 🚀
