# Zen - Free AI Chat For ALL LLM

<div align="center">

![Zen Logo](https://raw.githubusercontent.com/KhanhRomVN/Zen/main/images/icon.png)

**AI chat directly in your VSCode — connect any LLM provider, free**

[![Version](https://img.shields.io/badge/version-2.2.2-blue.svg)](https://github.com/KhanhRomVN/Zen)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VSCode](https://img.shields.io/badge/VSCode-^1.84.0-007ACC.svg)](https://code.visualstudio.com/)

</div>

## What is Zen?

Zen brings AI chat into your VSCode sidebar. Connect to any LLM provider, chat about your code, let the AI read and edit files, run commands, and track every change — all without leaving your editor. No subscription, no lock-in.

## Features

**Multi-LLM Support** — Connect DeepSeek, Claude, Gemini, Qwen, OpenAI, Ollama, GitHub Copilot, and more. Switch providers or accounts anytime from the Accounts panel.

**Agentic File Operations** — Ask the AI to read, create, edit, or delete files in your workspace. Every change is shown as an action you approve before it runs.

**Terminal Commands** — The AI can propose and run shell commands. You decide whether to allow them, based on the active permission mode.

**3-Mode Permission System** — Choose how much freedom to give the AI:
- **Full Access** — all tools run automatically
- **Approval** — reads run automatically, everything else asks first
- **Read Only** — the AI can inspect your code but cannot modify anything

**Checkpoint & Revert** — Every file modification creates a checkpoint. View the diff or undo the change with one click.

**Conversation History** — All chats are saved. Browse, search, and resume any previous conversation.

**Skills Marketplace** — Browse and install community skills to extend what the AI can do, right inside Zen.

**Streaming Responses** — Real-time output with syntax-highlighted code blocks, copy buttons, and clickable file paths.

## Getting Started

### Install

**From Marketplace**: Search "Zen" in the VSCode Extensions panel and click Install.

**From VSIX**:
```bash
code --install-extension khanhromvn-zen-2.2.2.vsix
```

### Setup

1. Click the **Zen icon** in the Activity Bar
2. Open the **Accounts** panel to add your AI provider and credentials
3. Start chatting

## Usage

### Chat Panel

Open via the Zen icon in the sidebar or `Ctrl+Shift+P` → **Zen: Open Chat**.

The top toolbar has quick actions:
- **New Chat** — start a fresh conversation
- **Accounts** — manage providers and credentials
- **History** — browse past conversations
- **Marketplace** — browse community skills
- **Settings** — configure Zen

### File Operations

Just ask naturally:

```
"Read src/utils.ts and explain what it does"
"Create a new file helpers.ts with a debounce function"
"Fix the bug in the handleSubmit function"
"Find every place that imports the old API client"
```

The AI shows action buttons for each operation. Approve to execute, ignore to skip — depending on the active permission mode.

### Permissions

The permission mode selector lives in the chat footer. Pick the level of autonomy you are comfortable with before starting a task. If the AI needs more access than the current mode allows, it will stop and ask you to switch.

### Checkpoints

After any file edit, a checkpoint bar appears in the chat:

`📍 CHECKPOINT [🗎] [↶]`

- **🗎** — view the diff between the current file and the checkpoint
- **↶** — revert the file to its state before this edit

### Adding Files to Context

Right-click any file in the Explorer and choose **Add to Zen Context** to include it in your next message without typing the path.

## Configuration

Most settings live in the **Settings** panel inside Zen:

| Setting | Description |
|---------|-------------|
| Provider | Choose your AI provider (DeepSeek, Claude, Gemini, Qwen, Ollama, ...) |
| Model | Select the model to use |
| Account | Manage credentials per provider |
| Context Size | How much history to send per request |
| Permission Mode | How much autonomy the AI has |

## Troubleshooting

- **AI can't edit files** — check the permission mode in the chat footer. *Read Only* blocks all writes.
- **Wrong model answering** — verify the active account and model in the Accounts panel before sending.
- **UI shows stale content** — run `Developer: Reload Window` from the Command Palette.
- **A command was blocked** — switch to *Full Access* or *Approval* mode if you trust the operation.

## Contributing

See [for-developer.md](for-developer.md) for local development setup, build workflow, and debugging instructions.

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
Made with ❤️ by <a href="https://github.com/KhanhRomVN">KhanhRomVN</a>
</div>