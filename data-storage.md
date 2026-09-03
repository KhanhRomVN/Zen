# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của Zen Extension.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.khanhromvn-zen/`

Zen Extension sử dụng:
- **File System** — Project conversation history, custom LSP packages

---

## 📁 File System

### Project Conversation History

**Path:** `~/.khanhromvn-zen/projects/{projectHash}/`

Mỗi project có một folder riêng, hash từ workspace path.

```
~/.khanhromvn-zen/
├── projects/
│   ├── 2b58a205a03e2f813c52ff6a225f087f/
│   │   ├── {conversationId}.json
│   │   └── ...
│   └── ...
└── lsp/
    ├── typescript-language-server/
    │   ├── node_modules/
    │   └── package.json
    ├── pyright/
    │   ├── node_modules/
    │   └── package.json
    └── ...
```

### Custom LSP Storage

**Path:** `~/.khanhromvn-zen/lsp/{packageName}/`

Mỗi LSP package được cài đặt vào folder riêng:

- `~/.khanhromvn-zen/lsp/typescript-language-server/` — TypeScript LSP
- `~/.khanhromvn-zen/lsp/pyright/` — Python LSP
- `~/.khanhromvn-zen/lsp/rust-analyzer/` — Rust LSP
- `~/.khanhromvn-zen/lsp/gopls/` — Go LSP
- etc.

> **Lưu ý:** Khi `zen_use_custom_lsp` = true, extension sẽ tự động cài đặt LSP packages vào folder này khi detect file type cần LSP chưa có.

---

## 🔒 Security

### File Permissions

```bash
chmod 700 ~/.khanhromvn-zen
chmod 755 ~/.khanhromvn-zen/lsp
chmod 755 ~/.khanhromvn-zen/projects
```

### Backup

```bash
# Backup
tar -czf zen-backup-$(date +%Y%m%d).tar.gz ~/.khanhromvn-zen/

# Restore
tar -xzf zen-backup-20240101.tar.gz -C ~/
```

---

## 📖 Related

- [`README.md`](./README.md) — Project overview
- [`package.json`](./package.json) — Extension manifest
