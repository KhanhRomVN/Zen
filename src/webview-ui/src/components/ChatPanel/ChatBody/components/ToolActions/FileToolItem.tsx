import React from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import FileIcon from "../../../../common/FileIcon";
import { CodeBlock } from "../../../../CodeBlock";
import { RichtextBlock } from "../../../../RichtextBlock";
import { ToolHeader } from "../../../../ToolHeader";
import { parseDiff } from "../../../../../utils/diffUtils";
import { getFilename, getToolColor } from "../../utils";
import { extensionService } from "../../../../../services/ExtensionService";
import { Message } from "../../types";
import ExecuteButton from "./ExecuteButton";
import { useI18n } from "../../../../../hooks/useI18n";


const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  py: "python", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  java: "java", c: "c", cpp: "cpp", cs: "csharp", go: "go", rs: "rust", php: "php",
  rb: "ruby", swift: "swift", kt: "kotlin", html: "html", css: "css", scss: "scss",
  json: "json", xml: "xml", yaml: "yaml", yml: "yaml", md: "markdown",
  sh: "shell", bash: "shell", sql: "sql", properties: "properties",
  ini: "ini", toml: "toml", makefile: "makefile",
};

interface FileToolItemProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  allMessages?: Message[];
  fileStatsMap: Record<string, { lines: number; loading: boolean }>;
  onToolClick: (action: ToolAction, messageId: string, index: number, type: "accept_all" | "accept_once" | "reject") => void;
}

function truncatePath(path?: string): string {
  if (!path) return "";
  const segments = path.split(/[/\\]/);
  if (segments.length <= 3) return path;
  return `${segments[0]}/../${segments.slice(-2).join("/")}`;
}

const FileToolItem: React.FC<FileToolItemProps> = ({
  action, actionIndex, messageId, isActionClicked, isActiveGroup,
  isLastMessage, isLastItemInList, toolOutputs, allMessages, fileStatsMap, onToolClick,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const { t } = useI18n();
  const toolType = action.type;
  const toolColor = getToolColor(toolType);
  const actionId = `${messageId}-action-${actionIndex}`;
  const fileExt = getFilename(action).split(".").pop() || "txt";

  const rawPath = action.params.file_path || action.params.symbol || action.params.folder_path || action.params.path || getFilename(action);

  let codeContent = "";
  let lineHighlights: { startLine: number; endLine: number; type: "added" | "removed" }[] = [];
  let codeLanguage = toolType === "replace_in_file"
    ? EXTENSION_TO_LANGUAGE[fileExt.toLowerCase()] || fileExt
    : "typescript";

  if (action.type === "replace_in_file" && action.params.diff) {
    const result = parseDiff(action.params.diff);
    codeContent = result.code;
    lineHighlights = result.lineHighlights;
  } else if (toolType === "write_to_file") {
    codeContent = action.params.content || "";
  } else if (toolType === "list_files" || toolType === "search_files" || toolType === "read_file" ||
             toolType === "get_outline" || toolType === "get_definition" || toolType === "get_references") {
    codeContent = toolOutputs?.[actionId]?.output || "";

    if (!codeContent) {
      const currentMsgIndex = allMessages ? allMessages.findIndex((m) => m.id === messageId) : -1;
      const resultMessage = allMessages?.find((m) => m.actionIds?.includes(actionId));
      const nextNonEmptyUser = allMessages
        ?.slice(currentMsgIndex + 1)
        .find((m) => m.role === "user" && m.content?.trim().length > 0);

      const escapedPath = rawPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\[${toolType}\\s+for\\s+['"]?${escapedPath}['"]?\\s*\\]`, "i");
      const patternMatch = allMessages
        ?.slice(currentMsgIndex + 1)
        .find((m) => m.content?.trim().length > 0 && pattern.test(m.content));

      const outputMessage = resultMessage || patternMatch || nextNonEmptyUser;
      if (outputMessage?.content) {
        const regexStr = `\\[${toolType}\\s+for\\s+['"]?${escapedPath}['"]?\\s*\\]\\s*Result:?\\s*[\\r\\n]+\\s*\`\`\`[\\w]*[\\r\\n]+([\\s\\S]*?)[\\r\\n]+\\s*\`\`\``;
        const match = new RegExp(regexStr).exec(outputMessage.content);
        if (match?.[1]) {
          codeContent = match[1];
        } else if (resultMessage && !outputMessage.content.includes("Result:")) {
          codeContent = outputMessage.content.replace(/^```[\w]*\n/, "").replace(/\n```$/, "");
        } else {
          const rawMatch = new RegExp(`\\[${toolType}\\s+for\\s+['"]?${escapedPath}['"]?\\s*\\]\\s*Result:?\\s*[\\r\\n]+\\s*([\\s\\S]*?)(?=\\s*\\[\\w+\\s+for|$)`).exec(outputMessage.content);
          if (rawMatch?.[1]) {
            codeContent = rawMatch[1];
          }
        }
      }
    }
    codeLanguage = toolType === "get_outline" ? "typescript" : "markdown";
  }

  let diffStats = null;
  if (action.type === "replace_in_file" && action.params.diff) {
    diffStats = parseDiff(action.params.diff).stats;
  }

  const linesCount = action.type === "write_to_file" ? action.params.content?.split("\n").length || 0 : 0;
  const isPartial = action.isPartial;
  const isError = !!toolOutputs?.[actionId]?.isError;

  const nextUserMessage = allMessages
    ? allMessages
        .slice(allMessages.findIndex((m) => m.id === messageId) + 1)
        .find((m) => m.role === "user")
    : undefined;

  const isWriteOrEditTool = toolType === "write_to_file" || toolType === "replace_in_file";
  const isCompleted =
    !isPartial &&
    (isActionClicked ||
      isError ||
      (isWriteOrEditTool
        ? !!toolOutputs?.[actionId] || !!nextUserMessage
        : (codeContent && codeContent.trim().length > 0) || !!nextUserMessage));

  const isLoading = !isCompleted && isPartial;
  const displayPath = truncatePath(rawPath);

  const prefix =
    toolType === "replace_in_file" ? t("tools.update")
    : toolType === "write_to_file" ? (fileStatsMap[rawPath] ? t("tools.rewrite") : t("tools.create"))
    : toolType === "list_files" ? t("tools.list")
    : toolType === "search_files" ? t("tools.search")
    : toolType === "get_outline" ? "Outline"
    : toolType === "get_definition" ? "Definition"
    : toolType === "get_references" ? "References"
    : t("tools.read");

  return (
    <div
      className="timeline-item"
      style={{
        display: "flex", flexDirection: "column", gap: "6px",
        paddingLeft: "29px",
        paddingBottom: isLastItemInList ? (isLastMessage ? "0px" : "12px") : "8px",
      }}
    >
      <ToolHeader
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--vscode-editor-foreground)" }}>
            <span style={{ fontWeight: 600, opacity: 0.8 }}>{prefix}</span>
            <FileIcon
              path={rawPath}
              isFolder={toolType === "list_files" || !!action.params.folder_path}
              style={{ width: "16px", height: "16px" }}
            />
            <span style={{ fontWeight: 500, opacity: 0.9, fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: "11px" }}>
              {displayPath}
            </span>
            {isPartial && (
              <span style={{ fontSize: "10px", opacity: 0.6, fontStyle: "italic", marginLeft: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: "10px" }} />
                {t("tools.streaming")}
              </span>
            )}
            {diffStats && (
              <span style={{ display: "flex", gap: "4px", opacity: 0.7, fontSize: "11px", marginLeft: "4px", fontWeight: 500 }}>
                <span style={{ color: "var(--vscode-gitDecoration-addedResourceForeground)" }}>+{diffStats.added}</span>
                <span style={{ color: "var(--vscode-gitDecoration-deletedResourceForeground)" }}>-{diffStats.removed}</span>
              </span>
            )}
            {linesCount > 0 && (
              <span style={{ opacity: 0.7, fontSize: "11px", marginLeft: "4px", fontWeight: 500 }}>+{linesCount} lines</span>
            )}
          </div>
        }
        statusColor={isError ? "var(--vscode-errorForeground)" : isCompleted ? "#3fb950" : isActiveGroup ? "var(--vscode-button-background)" : "var(--vscode-descriptionForeground)"}
        diffStats={undefined}
        isPartial={isPartial}
        onClick={() => {
          if (toolType === "list_files" || toolType === "search_files" || toolType === "replace_in_file" || toolType === "write_to_file" ||
              toolType === "get_outline" || toolType === "get_definition" || toolType === "get_references") {
            setIsCollapsed((v) => !v);
          } else {
            extensionService.postMessage({ command: "openFile", path: rawPath });
          }
        }}
      />

      {!isCompleted && !isPartial && (isActiveGroup || !isLastMessage) && (
        <div style={{ marginTop: "8px", marginBottom: "8px" }}>
          <ExecuteButton
            isActive={!!isActiveGroup}
            isCompleted={!!isCompleted}
            isLastMessage={!!isLastMessage}
            isLoading={false}
            toolColor={toolColor}
            title="Approve action"
            labelText={t("tools.approve")}
            onExecute={(e, type) => onToolClick(action, messageId, actionIndex, type)}
          />
        </div>
      )}

      {(toolType === "replace_in_file" || toolType === "write_to_file" ||
        toolType === "get_outline" || toolType === "get_definition" || toolType === "get_references" ||
        ((toolType === "list_files" || toolType === "search_files") && codeContent)) && (
        <>
          {toolType === "list_files" || toolType === "search_files" ? (
            !isCollapsed && (
              <RichtextBlock
                content={codeContent}
                showHeader={false}
                maxHeight={300}
                defaultCollapsed={false}
                isFilePathList={true}
                basePath={action.params.path || action.params.folder_path || ""}
                onFileClick={(fullPath) => extensionService.postMessage({ command: "openFile", path: fullPath })}
              />
            )
          ) : (
            !isCollapsed && !(isPartial && (toolType === "replace_in_file" || toolType === "write_to_file")) && (
              <CodeBlock
                code={codeContent}
                language={codeLanguage}
                maxLines={25}
                isCollapsed={false}
                showLineNumbers={true}
                lineHighlights={lineHighlights}
              />
            )
          )}
        </>
      )}
    </div>
  );
};

export { truncatePath };
export default FileToolItem;
