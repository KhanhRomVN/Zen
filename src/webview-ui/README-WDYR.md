# Why Did You Render - Setup Complete ✅

## Quick Start

```bash
npm run watch
```

Mở VSCode Developer Tools (`Ctrl+Shift+P` → "Developer: Toggle Developer Tools") → Console tab.

## What's Enabled

WDYR tự động track các components trong `src/features/chat/`:
- MessageBox, AIMessageBox, UserMessageBox
- MarkdownBlock, CodeBlock, ThinkingRenderer
- ChatBody, ChatHeader, ChatFooter
- Tool components

## Cách sử dụng

Các components chat đã được track tự động. Khi có re-render không cần thiết, console sẽ hiển thị:

```
[WDYR] MessageBox
  Reason: Props changed
  Props changes: ...
```

## Track thêm components khác

```tsx
import { trackComponent } from '@/utils/wdyr-helper';

const MyComponent = ({ data }) => {
  return <div>{data}</div>;
};

export default trackComponent(MyComponent, 'MyComponent');
```

## Files

- `src/wdyr.ts` - WDYR config
- `src/utils/wdyr-helper.ts` - Helper functions
- `src/features/chat/components/performance-tracking.ts` - Auto-tracking cho chat components
- `src/types/wdyr.d.ts` - TypeScript types

---

**Chỉ chạy trong development. Production builds tự động loại bỏ WDYR code.**
