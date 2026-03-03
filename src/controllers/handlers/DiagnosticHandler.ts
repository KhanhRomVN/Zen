import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ContextManager } from "../../context/ContextManager";
import { ShikiService } from "../../services/ShikiService";

export class DiagnosticHandler {
  constructor(private contextManager: ContextManager) {}

  public async handleGetSymbolDefinition(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { symbol, path: filePath, requestId } = message;
      if (!symbol) throw new Error("Symbol is required");

      let definitions: any[] = [];

      if (filePath) {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) throw new Error("No workspace");
          const uri = path.isAbsolute(filePath)
            ? vscode.Uri.file(filePath)
            : vscode.Uri.joinPath(workspaceFolder.uri, filePath);
          const documentSymbols: vscode.DocumentSymbol[] | undefined =
            await vscode.commands.executeCommand(
              "vscode.executeDocumentSymbolProvider",
              uri,
            );

          const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
          const ignoreCheck = await fsAnalyzer.isIgnored(uri.fsPath);
          if (ignoreCheck.ignored) {
            throw new Error(
              `Path '${filePath}' is out of scope (ignored by .gitignore or project settings).`,
            );
          }

          if (documentSymbols) {
            const findSymbol = (
              syms: vscode.DocumentSymbol[],
            ): vscode.DocumentSymbol | undefined => {
              for (const sym of syms) {
                if (sym.name === symbol) return sym;
                if (sym.children) {
                  const found = findSymbol(sym.children);
                  if (found) return found;
                }
              }
              return undefined;
            };

            const found = findSymbol(documentSymbols);
            if (found) {
              definitions.push({
                uri: uri,
                range: found.range,
              });
            }
          }
        } catch (e) {
          console.error("Error finding symbol in specific file:", e);
        }
      }

      if (definitions.length === 0) {
        const workspaceSymbols: vscode.SymbolInformation[] | undefined =
          await vscode.commands.executeCommand(
            "vscode.executeWorkspaceSymbolProvider",
            symbol,
          );

        if (workspaceSymbols && workspaceSymbols.length > 0) {
          const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
          const relevant: vscode.SymbolInformation[] = [];
          for (const s of workspaceSymbols) {
            if (s.location.uri.fsPath.includes("node_modules")) continue;
            const check = await fsAnalyzer.isIgnored(s.location.uri.fsPath);
            if (!check.ignored && s.name === symbol) {
              relevant.push(s);
            }
          }

          definitions =
            relevant.length > 0
              ? relevant.map((s) => s.location)
              : workspaceSymbols.map((s) => s.location);
        }
      }

      if (definitions.length === 0) {
        webviewView.webview.postMessage({
          command: "getSymbolDefinitionResult",
          requestId,
          result: `No definition found for symbol: ${symbol}`,
        });
        return;
      }

      let resultText = `Definitions for '${symbol}':\n`;
      let count = 0;

      for (const def of definitions) {
        if (count >= 5) {
          resultText += `\n... and ${definitions.length - count} more.`;
          break;
        }

        try {
          const document = await vscode.workspace.openTextDocument(def.uri);
          const startLine = Math.max(0, def.range.start.line - 2);
          const endLine = Math.min(
            document.lineCount - 1,
            def.range.end.line + 5,
          );

          let snippet = "";
          for (let i = startLine; i <= endLine; i++) {
            const prefix =
              i >= def.range.start.line && i <= def.range.end.line
                ? "> "
                : "  ";
            snippet += `${prefix}${i + 1}: ${document.lineAt(i).text}\n`;
          }

          let displayPath = def.uri.fsPath;
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (
            workspaceFolder &&
            displayPath.startsWith(workspaceFolder.uri.fsPath)
          ) {
            displayPath = path.relative(
              workspaceFolder.uri.fsPath,
              displayPath,
            );
          }

          resultText += `\nFile: ${displayPath} (Line ${def.range.start.line + 1})\n\`\`\`${path.extname(displayPath).substring(1)}\n${snippet}\`\`\`\n`;
          count++;
        } catch (e) {
          resultText += `\nFile: ${def.uri.fsPath} (Error reading content)\n`;
        }
      }

      webviewView.webview.postMessage({
        command: "getSymbolDefinitionResult",
        requestId,
        result: resultText,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "getSymbolDefinitionResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleGetReferences(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { symbol, path: filePath, requestId } = message;
      if (!symbol) throw new Error("Symbol is required");

      let targetLocation: vscode.Location | undefined;

      if (filePath) {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) throw new Error("No workspace");
          const uri = path.isAbsolute(filePath)
            ? vscode.Uri.file(filePath)
            : vscode.Uri.joinPath(workspaceFolder.uri, filePath);
          const documentSymbols: vscode.DocumentSymbol[] | undefined =
            await vscode.commands.executeCommand(
              "vscode.executeDocumentSymbolProvider",
              uri,
            );

          const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
          const ignoreCheck = await fsAnalyzer.isIgnored(uri.fsPath);
          if (ignoreCheck.ignored) {
            throw new Error(
              `Path '${filePath}' is out of scope (ignored by .gitignore or project settings).`,
            );
          }

          if (documentSymbols) {
            const findSymbol = (
              syms: vscode.DocumentSymbol[],
            ): vscode.DocumentSymbol | undefined => {
              for (const sym of syms) {
                if (sym.name === symbol) return sym;
                if (sym.children) {
                  const found = findSymbol(sym.children);
                  if (found) return found;
                }
              }
              return undefined;
            };

            const found = findSymbol(documentSymbols);
            if (found) {
              targetLocation = new vscode.Location(
                uri,
                found.selectionRange.start,
              );
            }
          }
        } catch (e) {}
      }

      if (!targetLocation) {
        const workspaceSymbols: vscode.SymbolInformation[] | undefined =
          await vscode.commands.executeCommand(
            "vscode.executeWorkspaceSymbolProvider",
            symbol,
          );

        if (workspaceSymbols && workspaceSymbols.length > 0) {
          const relevant = workspaceSymbols.find(
            (s) =>
              s.name === symbol &&
              !s.location.uri.fsPath.includes("node_modules"),
          );
          targetLocation = relevant
            ? relevant.location
            : workspaceSymbols[0].location;
        }
      }

      if (!targetLocation) {
        webviewView.webview.postMessage({
          command: "getReferencesResult",
          requestId,
          result: `Could not locate symbol '${symbol}' to find references for. Try providing the file_path.`,
        });
        return;
      }

      const references: vscode.Location[] | undefined =
        await vscode.commands.executeCommand(
          "vscode.executeReferenceProvider",
          targetLocation.uri,
          targetLocation.range.start,
        );

      if (!references || references.length === 0) {
        webviewView.webview.postMessage({
          command: "getReferencesResult",
          requestId,
          result: `No references found for symbol: ${symbol}`,
        });
        return;
      }

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const filteredRefs: vscode.Location[] = [];
      for (const ref of references) {
        if (ref.uri.fsPath.includes("node_modules")) continue;
        const check = await fsAnalyzer.isIgnored(ref.uri.fsPath);
        if (!check.ignored) {
          filteredRefs.push(ref);
        }
      }

      if (filteredRefs.length === 0) {
        webviewView.webview.postMessage({
          command: "getReferencesResult",
          requestId,
          result: `References found, but all were in node_modules.`,
        });
        return;
      }

      const refsByFile = new Map<string, vscode.Location[]>();
      for (const ref of filteredRefs) {
        const fsPath = ref.uri.fsPath;
        if (!refsByFile.has(fsPath)) {
          refsByFile.set(fsPath, []);
        }
        refsByFile.get(fsPath)!.push(ref);
      }

      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      let resultText = `Found ${filteredRefs.length} references for '${symbol}' in ${refsByFile.size} files:\n\n`;
      let fileCount = 0;

      for (const [fsPath, locs] of refsByFile.entries()) {
        if (fileCount >= 10) {
          resultText += `\n... and ${refsByFile.size - fileCount} more files.`;
          break;
        }

        let displayPath = fsPath;
        if (workspaceFolder && displayPath.startsWith(workspaceFolder)) {
          displayPath = path.relative(workspaceFolder, displayPath);
        }

        resultText += `**${displayPath}** (${locs.length} usages):\n`;

        try {
          const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(fsPath),
          );

          let locCount = 0;
          for (const loc of locs) {
            if (locCount >= 3) {
              resultText += `  ... and ${locs.length - locCount} more in this file.\n`;
              break;
            }
            const line = loc.range.start.line;
            const text = document.lineAt(line).text.trim();
            resultText += `  L${line + 1}: \`${text}\`\n`;
            locCount++;
          }
        } catch (e) {
          resultText += `  (Could not read file contents)\n`;
        }
        resultText += "\n";
        fileCount++;
      }

      webviewView.webview.postMessage({
        command: "getReferencesResult",
        requestId,
        result: resultText.trim(),
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "getReferencesResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleGetFileOutline(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { path: filePath, requestId } = message;
      if (!filePath) throw new Error("File path is required");

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const uri = path.isAbsolute(filePath)
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolder.uri, filePath);
      const absolutePath = uri.fsPath;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absolutePath);
      if (ignoreCheck.ignored) {
        throw new Error(
          `Path '${filePath}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const documentSymbols: vscode.DocumentSymbol[] | undefined =
        await vscode.commands.executeCommand(
          "vscode.executeDocumentSymbolProvider",
          uri,
        );

      if (!documentSymbols || documentSymbols.length === 0) {
        webviewView.webview.postMessage({
          command: "getFileOutlineResult",
          requestId,
          result: `No structural outline available for ${filePath}. The file might not be supported by language servers, or has no symbols. Try read_file instead.`,
        });
        return;
      }

      const getKindString = (kind: vscode.SymbolKind): string => {
        const kinds = Object.keys(vscode.SymbolKind).filter((k) =>
          isNaN(Number(k)),
        );
        return kinds[kind] || "Unknown";
      };

      let resultText = `Outline for ${filePath}:\n\n`;

      const processSymbol = (
        sym: vscode.DocumentSymbol,
        indent: string = "",
      ) => {
        let kindInfo = "";
        if (sym.kind === vscode.SymbolKind.Class) kindInfo = "Class: ";
        else if (
          sym.kind === vscode.SymbolKind.Function ||
          sym.kind === vscode.SymbolKind.Method
        )
          kindInfo = "Function: ";
        else if (sym.kind === vscode.SymbolKind.Interface)
          kindInfo = "Interface: ";
        else if (sym.kind === vscode.SymbolKind.Variable && indent === "")
          kindInfo = "Export: ";
        else if (sym.kind === vscode.SymbolKind.Property)
          kindInfo = "Property: ";
        else if (sym.kind === vscode.SymbolKind.Enum) kindInfo = "Enum: ";
        else if (sym.kind === vscode.SymbolKind.EnumMember) kindInfo = "- ";
        else kindInfo = `[${getKindString(sym.kind)}] `;

        if (
          indent.length > 4 &&
          (sym.kind === vscode.SymbolKind.Variable ||
            sym.kind === vscode.SymbolKind.Constant)
        ) {
          return;
        }

        resultText += `${indent}${kindInfo}${sym.name} (Lines ${sym.range.start.line + 1}-${sym.range.end.line + 1})\n`;

        if (sym.children && sym.children.length > 0) {
          const sortedChildren = [...sym.children].sort(
            (a, b) => a.range.start.line - b.range.start.line,
          );
          for (const child of sortedChildren) {
            processSymbol(child, indent + "  ");
          }
        }
      };

      const sortedSymbols = [...documentSymbols].sort(
        (a, b) => a.range.start.line - b.range.start.line,
      );
      for (const sym of sortedSymbols) {
        processSymbol(sym);
      }

      webviewView.webview.postMessage({
        command: "getFileOutlineResult",
        requestId,
        result: resultText,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "getFileOutlineResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleHighlightCode(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const shiki = ShikiService.getInstance();
    const html = await shiki.highlight(
      message.code,
      message.language,
      message.themeKind || vscode.window.activeColorTheme.kind,
      message.themeId,
      message.lineHighlights,
      message.startLineNumber,
      message.showLineNumbers !== false,
    );
    webviewView.webview.postMessage({
      command: "highlightCodeResult",
      requestId: message.requestId,
      html,
    });
  }
}
