# Zen - Free AI Chat For ALL LLM

<div align="center">

![Zen Logo](https://raw.githubusercontent.com/KhanhRomVN/Zen/main/images/icon.png)

**AI chat directly in your VSCode — connect any LLM provider, free**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/KhanhRomVN/Zen)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VSCode](https://img.shields.io/badge/VSCode-^1.50.0-007ACC.svg)](https://code.visualstudio.com/)

</div>

## What is Zen?

Zen brings AI chat into your VSCode sidebar. Connect to any LLM provider, chat about your code, let the AI read and edit files, and track every change — all without leaving your editor.

## Features

**Multi-LLM Support** — Connect DeepSeek, Claude, Gemini, and more. Switch providers anytime from the Settings panel.

**File Operations** — Ask the AI to read, create, or edit files in your workspace. Changes are shown as action buttons you approve before they run.

**Checkpoint & Revert** — Every file modification creates a checkpoint. Click 🗎 to diff, click ↶ to undo.

**Conversation History** — All chats are saved. Browse and resume any previous conversation from the History panel.

**Streaming Responses** — Real-time output with syntax-highlighted code blocks and copy buttons.

## Getting Started

### Install

**From Marketplace**: Search "Zen" in the VSCode Extensions panel and click Install.

**From VSIX**:
```bash
code --install-extension zen-1.2.1.vsix
```

### Setup

1. Click the **Zen icon** in the Activity Bar
2. Click **⚙️ Settings** to add your AI provider and API key
3. Start chatting

## Usage

### Chat Panel

Open via the Zen icon in the sidebar or `Ctrl+Shift+P` → **Zen: Open Chat**.

The toolbar has three sections:
- **💬 Chat** — main conversation
- **⚙️ Settings** — providers, models, API keys
- **📜 History** — past conversations

### File Operations

Just ask naturally:

```
"Read src/utils.ts and explain what it does"
"Create a new file helpers.ts with a debounce function"
"Fix the bug in the handleSubmit function"
```

The AI will show action buttons. Click to execute, or ignore to skip.

### Checkpoints

After any file edit, a checkpoint bar appears in the chat:

`📍 CHECKPOINT [🗎] [↶]`

- **🗎** — view diff between current file and checkpoint
- **↶** — revert the file to its state before this edit

## Configuration

All settings are in the **⚙️ Settings** panel inside Zen:

| Setting | Description |
|---------|-------------|
| Provider | Choose your AI provider |
| Model | Select the model to use |
| API Key | Your provider credentials |
| Context Size | How much history to send per request |

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
Made with ❤️ by <a href="https://github.com/KhanhRomVN">KhanhRomVN</a>
</div>

...