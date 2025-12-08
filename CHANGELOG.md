# Changelog

All notable changes to the "Zen" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-08

### 🎉 Initial Release

The first stable release of Zen - Free AI Chat For ALL LLM extension for Visual Studio Code.

### ✨ Added

#### Core Features
- **Multi-LLM Chat Interface**: Integrated AI chat panel in VSCode sidebar with support for multiple LLM providers
- **WebSocket Communication**: Real-time bidirectional communication between extension and webview using WebSocket server
- **Context Management**: Intelligent context building and workspace analysis for AI interactions
- **Agent Capability System**: Extensible agent permission and capability management framework

#### Chat Panel Features
- **Streaming Responses**: Real-time streaming of AI responses with typing indicators
- **Code Syntax Highlighting**: Automatic syntax highlighting for code blocks in chat messages
- **Copy Code Functionality**: One-click copy for code snippets
- **Collapsible Prompts**: Expandable/collapsible prompt request sections for cleaner UI
- **Message Formatting**: Rich text formatting with markdown support

#### File Operations
- **Read Files**: AI can read and analyze project files with full path resolution
- **Write to File**: Create new files with AI-generated content
- **Replace in File**: Smart content replacement with pattern matching
- **List Files**: Browse directory structures and file listings
- **Search Files**: Search across workspace with pattern matching

#### Checkpoint System
- **Visual Checkpoints**: Track file modifications with visual checkpoint dividers
- **Diff View Integration**: Compare current file state with checkpoint content using VSCode's native diff editor
- **Revert Functionality**: Revert files to previous checkpoint states with confirmation dialog
- **Action Tracking**: Each checkpoint tracks the `actionId` that created it
- **Smart Button Reactivation**: Reverted actions reactivate their original tool buttons for re-execution
- **Dual Icon Interface**: Separate icons for diff viewing (🗎) and reverting (↶) with distinct hover colors
  - Diff icon: Blue hover (#3b82f6)
  - Revert icon: Orange hover (#f59e0b)

#### Conversation Management
- **History Panel**: Browse and load previous conversations with rich metadata
- **Conversation Cards**: Display conversation previews with:
  - Provider and container name badges
  - Creation and last modified timestamps
  - Total request count
  - Total context size
- **New Chat**: Start fresh conversations while preserving history
- **Auto-save**: Automatic conversation persistence to global state
- **Read-only Mode**: Loaded historical conversations are read-only to prevent accidental modifications

#### Settings Panel
- **Provider Configuration**: Configure multiple AI providers and models
- **API Key Management**: Secure storage of API credentials in VSCode settings
- **Container Settings**: Manage request containers and routing
- **Context Configuration**: Adjust context window sizes and behavior
- **Theme Integration**: Settings UI adapts to VSCode theme

#### Developer Experience
- **Theme Awareness**: Automatic adaptation to VSCode light/dark themes
- **System Information**: Automatic OS and environment detection
- **Command Palette Integration**: Quick access via command palette
- **Activity Bar Icon**: Dedicated sidebar icon for easy access
- **Toolbar Actions**: Quick access to settings, history, and new chat
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **State Persistence**: Conversation and settings persistence across sessions

#### Technical Infrastructure
- **TypeScript**: Full TypeScript implementation for type safety
- **React UI**: Modern React-based webview interface
- **Webpack Bundling**: Optimized bundling for extension and webview
- **WebSocket Server**: Singleton WebSocket manager with automatic port allocation
- **Global State Manager**: Centralized state management for conversations and settings
- **File System Analyzer**: Intelligent workspace and file system analysis
- **Context Builder**: Smart context construction for AI interactions

### 🔧 Technical Details

#### Extension Architecture
- **Main Extension**: `extension.ts` - Core extension logic and VSCode API integration
- **WebView Provider**: `ZenChatViewProvider` - Manages webview lifecycle and communication
- **Context System**: Workspace analysis, file system scanning, and context building
- **Agent System**: Capability management and permission handling
- **Storage System**: Global state persistence for conversations and settings

#### Build System
- **Webpack Configuration**: Optimized bundling with source maps
- **TypeScript Compilation**: Strict type checking and compilation
- **Watch Mode**: Development mode with automatic recompilation
- **Production Build**: Minified and optimized production bundles
- **DTS Cleanup**: Automatic removal of unnecessary declaration files

#### Dependencies
- **ws**: WebSocket server implementation (^8.18.3)
- **React**: UI framework for webview
- **TypeScript**: Type-safe development (^5.8.2)
- **Webpack**: Module bundling (^5.98.0)

### 📦 Package Information
- **Publisher**: KhanhRomVN
- **License**: MIT
- **VSCode Engine**: ^1.50.0
- **Categories**: Other

### 🐛 Known Issues
- None reported in initial release

### 🔒 Security
- API keys stored securely in VSCode settings
- WebSocket server bound to localhost only
- File operations restricted to workspace directories

---

## [Unreleased]

### Planned Features
- Multi-file diff view
- Batch file operations
- Custom prompt templates
- Export conversation history
- Advanced search in history
- Keyboard shortcuts customization
- Plugin system for custom tools

---

**Note**: This is the initial release. Future updates will be documented in this changelog following the same format.

For more information, visit: [https://github.com/KhanhRomVN/Zen](https://github.com/KhanhRomVN/Zen)
