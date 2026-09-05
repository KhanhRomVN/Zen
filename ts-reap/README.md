# ts-reap

An advanced TypeScript/JavaScript language server that catches what vanilla
`tsserver` doesn't: **project-wide unused exports, functions, and
declarations**. Standard LSP diagnostics (`noUnusedLocals`,
`noUnusedParameters`) only look inside a single file. `ts-reap` builds a
whole-project reference graph (via [ts-morph](https://ts-morph.com)) and
flags anything that's exported but never imported/used anywhere else.

## Status

Early scaffold. Core pieces in place:

- `src/analyzer.ts` — wraps a `ts-morph` `Project`, walks every source file's
  exported declarations, and checks `findReferencesAsNodes()` across the
  whole project to decide if something is truly unused.
- `src/server.ts` — a `vscode-languageserver` server that debounces file
  changes, re-runs the analysis, and publishes `Diagnostic[]` back to any
  connected editor.

## How it works

1. On `initialize`, the server locates `tsconfig.json` at the workspace
   root and creates a `ts-morph` `Project` from it (this reads the whole
   project's file list, not just the open buffer).
2. On every `didOpen` / `didChangeContent`, the in-memory source file is
   updated and a debounced (1s) full re-analysis is scheduled — analyzing
   on every keystroke would be too expensive on large projects.
3. `findUnusedExports()` iterates every non-ignored, non-entry-point file's
   exported declarations and counts references project-wide. 
4. **Re-exports are filtered out** - `export * from './module'` is not counted
   as "real usage", only actual imports and usage in code count.
5. Diagnostics are published per open document (`connection.sendDiagnostics`),
   showing up as warning squiggles in the editor.

## Installation

```bash
npm install -g @khanhromvn/ts-reap
```

Or use as a dependency:

```bash
npm install --save-dev @khanhromvn/ts-reap
```

## Usage

### CLI Mode

```bash
# Run the language server
ts-reap --stdio
```

### Programmatic Usage

```typescript
import { ProjectAnalyzer } from '@khanhromvn/ts-reap';

const analyzer = new ProjectAnalyzer({
  tsConfigFilePath: '/path/to/tsconfig.json',
  entryPatterns: ['src/index.ts', 'src/main.ts'],
  ignorePatterns: ['**/*.test.ts', '**/node_modules/**']
});

const unusedExports = analyzer.findUnusedExports();
console.log('Unused exports:', unusedExports);
```

### VS Code Extension

Install the companion VS Code extension: `ts-reap-vscode`

```bash
code --install-extension khanhromvn.ts-reap-vscode
```

## Configuration (planned)

Right now `entryPatterns` (files allowed to have "unused" exports, since
they're consumed by a bundler/runtime rather than another TS file) is
hardcoded in `server.ts`. Planned: a `.ts-reaprc.json` at the project root:

```json
{
  "entry": ["src/index.ts", "src/main.ts"],
  "ignore": ["**/*.test.ts", "**/generated/**"]
}
```

## Roadmap

- [x] Filter out re-export references (export * from '...')
- [ ] Load config from `.ts-reaprc.json` / `initializationOptions`
- [ ] Incremental re-analysis (only re-check files touched by the changed
      file's import graph, not the entire project) for large codebase perf
- [ ] Detect unused type-only exports (interfaces, type aliases) separately
      from value exports
- [ ] Detect unused enum members
- [ ] "Unused" quick-fix code action (remove declaration / add to ignore list)
- [x] VS Code client extension (`vscode-languageclient`)
- [ ] CLI mode (`ts-reap check`) for CI, independent of any editor
- [ ] GitHub Actions integration
- [ ] Support for monorepos with multiple tsconfig.json files

## Why not just use Knip?

Fair question — [Knip](https://knip.dev) already does this well and ships a
VS Code extension. `ts-reap` exists for people who want a leaner, LSP-native
implementation they fully understand and control (or who want to extend
detection logic in ways Knip's config doesn't expose). If you just need the
feature today, use Knip.

## License

MIT
