# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-XX

### Added
- Initial release
- Language server implementation using ts-morph
- Project-wide unused export detection
- Re-export filtering (export * from '...' not counted as usage)
- Configurable entry points and ignore patterns
- LSP diagnostics for unused exports

### Features
- Detects unused interfaces, types, classes, functions, and constants
- Works across entire TypeScript/JavaScript project
- Integrates with any LSP-compatible editor
- Debounced analysis for performance

### Known Limitations
- Analysis can be slow on very large projects (>1000 files)
- No incremental analysis yet (full project re-scan on change)
- Type-only exports not separately categorized
