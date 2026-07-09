# CodeBlock Component

## Overview

Reusable code block component with full-featured display capabilities for code snippets in the Zen extension.

## Features

- **CodeBlockHeader**: Simple header with language icon and copy button (shown when language is specified)
- **ToolHeader**: Advanced header for diff blocks with statistics
- **Copy Button**: One-click code copying to clipboard with visual feedback
- **Collapse/Expand**: Collapsible view for diff blocks
- **Diff Support**: Visual diff statistics display
- **Status Colors**: Customizable status indicator colors
- **Word Wrap**: Optional word wrapping for long lines
- **VSCode Theme Integration**: Automatically uses VSCode editor theme

## Usage

### Basic Usage (with CodeBlockHeader)

```tsx
import { CodeBlock } from './blocks/code/CodeBlock';

<CodeBlock 
  code="const hello = 'world';" 
  language="javascript" 
/>
```

This will show:
- Language icon (based on file extension mapping)
- Language name
- Copy button

### Without Language (no header)

```tsx
<CodeBlock 
  code="plain text content" 
/>
```

### With Word Wrap

```tsx
<CodeBlock 
  code="very long line of code that needs wrapping..." 
  language="python"
  enableWordWrap={true}
/>
```

### With Diff Support (uses ToolHeader)

```tsx
<CodeBlock
  code={diffCode}
  language="python"
  isDiffBlock={true}
  diffStats={{ added: 5, removed: 2 }}
  prefix="Edit"
  statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | required | The code content to display |
| `language` | `string` | `undefined` | Programming language (triggers CodeBlockHeader when set) |
| `diffStats` | `{ added: number; removed: number }` | `undefined` | Diff statistics (switches to ToolHeader) |
| `isDiffBlock` | `boolean` | `false` | Whether this is a diff block (enables collapse/expand, uses ToolHeader) |
| `prefix` | `string` | `undefined` | Custom prefix for header title (switches to ToolHeader) |
| `statusColor` | `string` | `undefined` | Custom color for status indicator (ToolHeader) |
| `enableWordWrap` | `boolean` | `false` | Enable word wrapping for long lines |

## Header Logic

The component intelligently chooses which header to display:

1. **CodeBlockHeader** (Simple):
   - When: `language` is set AND no `isDiffBlock`, `prefix`, or `diffStats`
   - Shows: Language icon + name + copy button
   - Clean, minimal design

2. **ToolHeader** (Advanced):
   - When: `isDiffBlock`, `prefix`, or `diffStats` are set
   - Shows: Status indicator, title, diff stats, collapse button
   - Full-featured for complex code operations

3. **No Header**:
   - When: No `language` specified
   - Just the code block

## Integration with MarkdownBlock

`MarkdownBlock` automatically uses `CodeBlock` for all fenced code blocks:

```markdown
\`\`\`python
def hello():
    print("world")
\`\`\`
```

This will render with `CodeBlock` component, showing the CodeBlockHeader with Python icon.

## Language Icon Mapping

The component maps language names to file extensions for icon lookup:
- `javascript` → `js`
- `typescript` → `ts`
- `python` → `py`
- `jsx`, `tsx`, `java`, `cpp`, `go`, `rust`, `php`, etc.

Full list in `CodeBlockHeader` component.

## Migration from MessageBoxCodeBlock

This component replaces the inline `MessageBoxCodeBlock` that was previously defined in `AIMessageBox.tsx`. All functionality has been preserved and enhanced.

**Before:**
```tsx
// Inside AIMessageBox.tsx
const MessageBoxCodeBlock: React.FC<...> = (...) => { ... }
```

**After:**
```tsx
// Separate reusable component
import { CodeBlock } from '../blocks/code/CodeBlock';
```

## Legacy Support

The `CodeRenderer` export is maintained for backward compatibility:

```tsx
<CodeRenderer content="code" language="javascript" />
```

This internally uses `CodeBlock` component.
