# Marketplace Refactoring

## Cấu trúc mới

```
marketplace/
├── index.tsx                    # Main component
├── LSP/                        # LSP tab
│   ├── index.ts
│   ├── LSPPanel.tsx           # LSP panel với UI style từ Account
│   └── LSPCard.tsx            # LSP card với context menu
├── SKILL/                      # SKILL tab
│   ├── index.ts
│   └── SkillPanel.tsx         # Coming soon placeholder
├── MCP/                        # MCP tab
│   ├── index.ts
│   └── MCPPanel.tsx           # Coming soon placeholder
├── components/                 # Old components (có thể xóa sau)
│   ├── LSPPanel.tsx
│   ├── SkillPanel.tsx
│   └── MCPPanel.tsx
├── constants/
│   └── lsp-servers.ts
└── services/
    └── lsp.service.ts
```

## Thay đổi chính

### 1. Cấu trúc thư mục
- ✅ Chia thành 3 folder riêng biệt: `LSP/`, `SKILL/`, `MCP/`
- ✅ Mỗi folder có `index.ts` để export components

### 2. LSPCard.tsx
- ✅ Component card riêng biệt cho mỗi LSP server
- ✅ Right-click mở context menu với Dropdown
- ✅ Context menu options:
  - **Install** (nếu chưa cài)
  - **Uninstall** (nếu đã cài)
  - **Open LSP Folder** (nếu đã cài)
  - **Open Homepage** (nếu có)
- ✅ 2 button "Install" và "Uninstall" có soft-style với màu khác nhau:
  - Install: `rgba(0, 122, 204, 0.08)` background, blue text
  - Uninstall: `rgba(239, 68, 68, 0.08)` background, red text

### 3. LSPPanel.tsx
- ✅ UI style tham khảo từ `account/index.tsx`:
  - Search bar với icon bên trái
  - Button chỉ có icon (filter, refresh)
  - Padding và border radius giống nhau
  - Hover effects
  - Color scheme nhất quán

### 4. Import updates
- ✅ `index.tsx` import từ folders mới:
  ```typescript
  import { LSPPanel } from "./LSP";
  import { SkillPanel } from "./SKILL";
  import { MCPPanel } from "./MCP";
  ```

## Features

### LSPCard
- Context menu (right-click) với dropdown
- Install/Uninstall với soft background colors
- Open LSP folder (cho installed servers)
- Open homepage link
- Hover effects
- Loading states

### LSPPanel
- Search bar (Account panel style)
- Filter button (show all / show installed only)
- Refresh button
- Error handling với dismiss button
- Empty state messages
- Responsive layout

## Màu sắc buttons

### Install Button
```css
background: rgba(0, 122, 204, 0.08)
color: var(--vscode-button-background, #007acc)
hover-background: rgba(0, 122, 204, 0.15)
```

### Uninstall Button
```css
background: rgba(239, 68, 68, 0.08)
color: rgb(239, 68, 68)
hover-background: rgba(239, 68, 68, 0.15)
```

## TODO (Optional)
- [ ] Xóa folder `components/` cũ sau khi test kỹ
- [ ] Implement thực sự cho "Open LSP Folder" handler
- [ ] Thêm content cho SKILL và MCP panels
- [ ] Unit tests cho LSPCard context menu
