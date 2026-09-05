#!/usr/bin/env node
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  InitializeParams,
  InitializeResult,
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fs from "fs";
import { ProjectAnalyzer, UnusedFinding } from "./analyzer";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let analyzer: ProjectAnalyzer | undefined;
let debounceTimer: NodeJS.Timeout | undefined;
const DEBOUNCE_MS = 1000;

function findTsConfig(rootPath: string): string | undefined {
  const candidate = path.join(rootPath, "tsconfig.json");
  return fs.existsSync(candidate) ? candidate : undefined;
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const rootPath =
    params.rootUri?.replace("file://", "") ?? params.rootPath ?? process.cwd();

  const tsConfigFilePath = findTsConfig(rootPath);
  const initOptions = params.initializationOptions as {
    entryPatterns?: string[];
    ignorePatterns?: string[];
  } | undefined;

  if (tsConfigFilePath) {
    analyzer = new ProjectAnalyzer({
      tsConfigFilePath,
      entryPatterns: initOptions?.entryPatterns ?? ["src/index.ts", "src/main.ts"],
      ignorePatterns: initOptions?.ignorePatterns,
    });
  } else {
    connection.console.warn(
      "ts-reap: no tsconfig.json found at project root; analyzer not started."
    );
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

function scheduleAnalysis(changedFilePath?: string) {
  if (!analyzer) return;
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    runAnalysisAndPublish(changedFilePath);
  }, DEBOUNCE_MS);
}

function toDiagnostic(finding: UnusedFinding): Diagnostic {
  return {
    severity: DiagnosticSeverity.Warning,
    range: {
      start: { line: finding.startLine, character: finding.startChar },
      end: { line: finding.endLine, character: finding.endChar },
    },
    message: finding.message,
    source: "ts-reap",
  };
}

function runAnalysisAndPublish(changedFilePath?: string) {
  if (!analyzer) return;

  try {
    analyzer.refresh();
    const allFindings = analyzer.findUnusedExports();

    // Group findings by file so we only send diagnostics for currently open docs
    // (avoids spamming the client with data for files it hasn't opened yet).
    const byFile = new Map<string, UnusedFinding[]>();
    for (const finding of allFindings) {
      const list = byFile.get(finding.filePath) ?? [];
      list.push(finding);
      byFile.set(finding.filePath, list);
    }

    for (const doc of documents.all()) {
      const filePath = doc.uri.replace("file://", "");
      const findings = byFile.get(filePath) ?? [];
      connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics: findings.map(toDiagnostic),
      });
    }
  } catch (err) {
    connection.console.error(`ts-reap analysis failed: ${String(err)}`);
  }
}

documents.onDidOpen((event) => {
  const filePath = event.document.uri.replace("file://", "");
  analyzer?.updateFile(filePath, event.document.getText());
  scheduleAnalysis(filePath);
});

documents.onDidChangeContent((event) => {
  const filePath = event.document.uri.replace("file://", "");
  analyzer?.updateFile(filePath, event.document.getText());
  scheduleAnalysis(filePath);
});

documents.onDidSave((event) => {
  scheduleAnalysis(event.document.uri.replace("file://", ""));
});

documents.listen(connection);
connection.listen();
