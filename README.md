<div align="center">

<img src="https://raw.githubusercontent.com/KhanhRomVN/Zen/main/images/icon.png" width="120" alt="Zen Logo" />

# Zen — Free AI Chat For ALL LLM

**A powerful AI agent living inside VSCode. Free. No subscription. No lock-in.**

[![Version](https://img.shields.io/badge/version-2.3.2-blue.svg)](https://github.com/KhanhRomVN/Zen)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VSCode](https://img.shields.io/badge/VSCode-^1.84.0-007ACC.svg)](https://code.visualstudio.com/)

> *For developers who need great AI but don't want to pay for it.*

</div>

---

## What is Zen?

Zen is a VSCode extension that turns your editor into a full AI coding agent. Instead of paying monthly for Copilot or Cursor, Zen lets you connect directly to any AI provider — from a personal API key to a free web account — and use it as an agent that can read, write, and run commands across your entire codebase.

Zen has two AI connection layers:

- **API Provider** — Connect via standard API keys (OpenAI-compatible). Use this when you have a key.
- **Web Provider** — Connect to AI websites with generous free tiers (ChatGPT, Gemini, Claude, Qwen, GitHub Copilot…) by automating Chromium with your existing browser profile. No key required, no cost.

Both layers are managed through a unified **Account Management** system that stores multiple accounts, tracks usage, rotates automatically, and supports account pool sharing.

---

## Core Features

### 🤖 Multi-Provider AI

| Type | Supported Providers |
|------|---------------------|
| **API** | OpenAI, DeepSeek, Anthropic Claude, Google Gemini, Qwen/Alibaba Cloud, Ollama (local), any OpenAI-compatible endpoint |
| **Web (free)** | ChatGPT, Claude.ai, Gemini, Qwen, GitHub Copilot, and more — via Chromium profile automation |

Switch provider, model, or account at any time from the model selector in the chat UI.

---

### 🧠 A Real AI Agent

Zen doesn't just answer questions — it performs actual tasks on your codebase:

**Reading files**
- Read files by path, read specific line ranges
- Find files by glob pattern, search content by regex (grep)
- Read binary formats: PDF, Word (.docx), RTF — not just plain text

**Writing & editing files**
- Create new files, overwrite content
- Surgically replace code snippets (replace_in_file) with byte-perfect matching
- Delete files

**Terminal**
- Propose and run shell commands
- Persistent terminal sessions across multiple commands
- Parse stdout/stderr to handle errors automatically

**Git**
- View git status, git diff
- Auto-generate commit messages and perform commits

**Other tools**
- Full-text search across the project (grep with regex)
- View project structure (list files with configurable depth)
- View file change history (replace history)
- Preview files inside VSCode

---

### 🛡️ 3-Level Permission System

Control exactly how much autonomy the agent has:

| Mode | Behavior |
|------|----------|
| **Full Access** | All tools run automatically, no prompts |
| **Approval** | Reads run automatically; writes, terminal, and git require confirmation |
| **Read Only** | AI can only inspect code, cannot modify anything |

Switch modes from the chat footer toolbar — takes effect immediately.

---

### 💾 Checkpoint & Revert

Before every file modification or deletion, Zen automatically creates a snapshot (checkpoint). After the AI edits a file, a checkpoint bar appears in chat:

```
📍 CHECKPOINT  [🗎 View diff]  [↶ Revert]
```

- **View diff** — Compare before/after changes in the VSCode diff editor
- **Revert** — Restore the file to its state before the AI touched it, with one click

Revert supports cascade: reverting a message rolls back all file changes made by that message and everything after it.

---

### 📊 Smart Account Management

This is what sets Zen apart from other AI extensions.

**Multiple accounts, multiple providers**
Store unlimited accounts (API keys or web session cookies) per provider. In any conversation, you choose exactly which account to use.

**Usage tracking**
Every account is tracked: request count, token count, successful vs. failed requests. View stats directly in the Accounts panel.

**Smart limits**
Set `max_req_conversation` and `max_token_conversation` per account to avoid exceeding quotas. The system warns you when an account approaches its limit.

**Import / Export**
Back up your entire account pool to a JSON file. Import from JSON or a SQLite database file. Easily share account pools between machines or with teammates.

**Usage reset**
Each account has a `reset_usage_at` timestamp — counters reset automatically on the configured cycle.

---

### 🌐 Web Provider (HTTPS Automation)

Zen connects to free AI websites by running Chromium with your real user profile. Here's how it works:

1. Log in to an AI website (ChatGPT, Gemini, Claude.ai…) using your normal Chrome browser, saving the session to a profile
2. Set the `chromium_profile_dir` path in Zen Settings
3. Zen uses that profile to communicate with the website — exactly as if you were chatting manually, but fully automated

No API reverse engineering. No API key. Works with any AI website that has a web interface.

---

### 💬 Conversation History

All conversations are saved automatically to `~/.khanhromvn-zen/projects/{hash}/`. Each project has its own history, up to 30 conversations.

- Browse all history from the **History** panel
- Resume any previous conversation
- Rename conversations
- Delete individual conversations or clear all
- Open a conversation's storage folder in your file manager

---

### 🛒 Skills Marketplace

Zen integrates with **mcp.directory** — a community marketplace for AI skills. Each skill is a prompt template that extends the AI's capabilities for a specific task (image generation, code analysis, database queries…).

- Browse skills directly in the **Marketplace** panel
- Install a skill with one click
- When `useSkillEnabled = true`, the list of installed skills is attached to the system prompt so the AI knows to use them

---

### 🔧 LSP Diagnostics

Zen integrates with VSCode's Language Server Protocol to catch type/syntax errors after the AI edits code:

- When `diagnosticEnabled = true`: the AI receives error reports from the language server and auto-fixes them
- When `diagnosticEnabled = false`: the `LSP-DIAGNOSTICS-FALLBACK` constraint is added to the system prompt, requiring the AI to proactively run a linter/type-checker after every code change

Supports TypeScript, Python, Rust, Go, Java, Ruby, C/C++ via language servers automatically installed to `~/.khanhromvn-zen/lsp/`.

---

### ⚙️ System Prompt Engine

Zen has a multi-layer, fully customizable system prompt:

**Behavior modes** — control the AI's working style:
- `fast` — minimal questions, minimal explanations, move fast
- `balanced` — balance between speed and care (default)
- `thorough` — careful, asks more questions, confirms before large changes
- `autopilot` — maximum autonomy, never pauses to ask

**Prompt length modes** — control system prompt size:
- `short` — compact, token-efficient
- `medium` — full behavior rules, no worked examples
- `long` — complete prompt including worked examples
- `none` — no system prompt sent (useful for fine-tuned models)

**Response language** — the AI replies in the language you choose (English, Vietnamese, Japanese…)

---

### 📋 Rules (Custom Instructions)

Create a `.zen/rules.md` file in your project to set project-specific rules for the AI — naming conventions, code style, framework preferences. Rules are automatically attached to every conversation's context.

---

### 🗄️ Database Integration

Zen supports direct database connections so the AI can query real data:

- **MySQL / MariaDB**
- **PostgreSQL**
- **MongoDB**

Each workspace can have its own `activeDatabaseManagerId`. The AI can run queries, inspect schemas, and analyze data within a conversation.

---

### 🎨 UI

- Streaming responses with real-time syntax-highlighted code blocks (powered by [Shiki](https://github.com/shikijs/shiki))
- Copy button on every code block
- Click file paths in responses to open them directly in the editor
- Dark/Light theme follows your VSCode theme
- Token usage bar below each response (can be hidden)
- File attachment — attach files from your workspace to a message
- Live write preview — watch the AI edit files in real time

---

## Installation

### From the VSCode Marketplace

Search **"Zen"** in the Extensions panel (`Ctrl+Shift+X`) and click Install.

### From VSIX (offline)

```bash
code --install-extension khanhromvn-zen-2.3.2.vsix
```

---

## Getting Started

### 1. Open Zen

Click the **Zen** icon in the Activity Bar (left sidebar) or use the Command Palette:

```
Ctrl+Shift+P → Zen: Open Chat
```

### 2. Connect an AI provider

Open the **Accounts** panel (organization icon in the toolbar):

**Using an API key:**
- Choose a provider (DeepSeek, OpenAI, Claude, Gemini, Qwen, Ollama…)
- Enter your API key or endpoint URL
- Select a model

**Using a free web account:**
- Go to **Settings** → enter your Chromium profile directory path
- Log in to the AI website using Chrome with that profile
- Select the web provider in Accounts

### 3. Start chatting

Type a request and press Enter. For example:

```
Read src/utils.ts and summarize the exported functions
```
```
Fix the bug in handleSubmit — the `data` variable can be undefined
```
```
Create a new React component called UserCard with props name, email, avatar
```
```
Run npm test and fix any failing tests
```

---

## Usage

### Adding files to context

Right-click any file in Explorer → **Add to Zen Context** to attach it to your next message without typing the path.

### Checkpoint & diff

After the AI edits a file, a checkpoint bar appears in chat. Click **🗎** to view the diff, click **↶** to revert.

### Switching permission mode

Use the selector in the chat footer. Changes take effect immediately.

### Viewing history

Click the **History** icon in the toolbar → browse all past conversations, click any to resume.

### Marketplace

Click the **Extensions** icon in the toolbar → browse and install community skills.

---

## Configuration

All settings are saved in Zen's Settings panel.

| Setting | Description | Default |
|---------|-------------|---------|
| `Provider / Model / Account` | Active AI selection | — |
| `Permission Mode` | fullAccess / approval / readOnly | `fullAccess` |
| `AI Response Language` | Language for AI responses | `English` |
| `Behavior Mode` | fast / balanced / thorough / autopilot | `balanced` |
| `Prompt Length` | short / medium / long / none | `none` |
| `Checkpoint` | Create snapshot before editing files | `on` |
| `Diagnostic` | Fetch LSP errors after code edits | `on` |
| `Skill Integration` | Attach installed skills list to prompt | `on` |
| `Show Token Usage` | Display token metadata bar | `on` |
| `Live Write Preview` | Watch AI write files in real time | `on` |
| `Chromium Profile Dir` | Path to Chrome profile for web providers | — |
| `Backend API URL` | Backend server URL for self-hosted setup | `localhost:8888` |

---

## Data Storage

All data is stored locally on your machine:

```
~/.khanhromvn-zen/
├── projects/
│   └── {projectHash}/
│       └── {conversationId}/
│           ├── {conversationId}.json     ← all messages + metadata
│           ├── checkpoints/              ← file snapshots before edits
│           └── replace_history/         ← per-edit replace history
└── lsp/
    ├── typescript-language-server/
    ├── pyright/
    ├── rust-analyzer/
    └── ...
```

No data is sent to Zen's servers. AI requests go directly from your machine to the provider (OpenAI, Anthropic…).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| AI can't edit files | Check Permission Mode — `Read Only` blocks all writes |
| Wrong model answering | Verify the active account and model in the Accounts panel |
| UI shows stale content | `Ctrl+Shift+P` → `Developer: Reload Window` |
| A command was blocked | Switch to `Full Access` or `Approval` mode |
| Web provider won't connect | Check the Chromium profile dir; make sure you're logged in to the website |
| LSP not catching errors | Open the file in the editor first to activate the language server |
| Conversations not saving | Check write permissions on `~/.khanhromvn-zen/` |

---

## Contributing

See [for-developer.md](for-developer.md) for local development setup, build workflow, and debugging instructions.

**Tech stack:**
- Extension host: TypeScript + Node.js + VSCode API
- Webview UI: React + TypeScript + TailwindCSS v4 + Zustand
- Build: Webpack (extension) + Webpack (webview)
- Syntax highlighting: Shiki

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Made with ❤️ by [KhanhRomVN](https://github.com/KhanhRomVN)

**Free AI for everyone. No subscription. No lock-in.**

</div>
