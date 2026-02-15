import { ACTION_NAMES, TOOL_LABELS, TOOL_COLORS } from "./constants";

export const getActionName = (type: string): string => {
  return ACTION_NAMES[type] || type;
};

export const getFilename = (action: any): string => {
  if (action.type === "execute_command") {
    const cmd = action.params.command || "";
    return cmd.length > 50 ? cmd.substring(0, 50) + "..." : cmd;
  }
  const path = action.params.path || "";
  return path.split("/").pop() || path || "";
};

export const getToolLabel = (type: string): string => {
  return TOOL_LABELS[type] || TOOL_LABELS.default;
};

export const getToolColor = (type: string): string => {
  return TOOL_COLORS[type] || TOOL_COLORS.default;
};

export const parseNewCodeFromDiff = (diff: string): string => {
  if (!diff) return "";

  // Match REPLACE block: =======\n<content>\n>>>>>>> REPLACE
  const replaceMatch = diff.match(
    /=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/
  );
  if (replaceMatch) {
    return replaceMatch[1].trim();
  }

  // Fallback: return entire diff if no REPLACE block found
  return diff;
};

// Stateless handler for diff click
export const handleDiffClick = (e: React.MouseEvent, action: any) => {
  e.stopPropagation();
  const vscodeApi = (window as any).vscodeApi;
  if (vscodeApi) {
    // Extract new code from diff or use content directly
    let newCode = "";
    if (action.type === "replace_in_file" && action.params.diff) {
      newCode = parseNewCodeFromDiff(action.params.diff);
    } else if (action.type === "write_to_file" && action.params.content) {
      newCode = action.params.content;
    }

    vscodeApi.postMessage({
      command: "openDiffView",
      filePath: action.params.path,
      newCode: newCode,
    });
  }
};

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};
