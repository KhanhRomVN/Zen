/**
 * ClaudeContentProcessor
 * ──────────────────────
 * Xử lý raw content trả về từ claude.ai (qua AIWeb2API) trước khi
 * đưa vào UI / ResponseParser.
 *
 * Các bước:
 * 1. Strip <conversation_title>…</conversation_title>  — claude.ai tự inject,
 *    Zen không dùng tag này (Zen có SetConversationTitleHandler riêng).
 * 2. Parse __CLAUDE_TOOL__:…__END_TOOL__ markers → Zen XML tool tags.
 *    Markers được AIWeb2API SSE parser emit khi detect tool_use event của claude.
 *
 * Import ClaudeToolParser từ Zen/src/parsers/claude — cần alias path
 * hoặc relative import tuỳ tsconfig của webview-ui.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProcessClaudeContentResult {
  /** Content đã strip + convert, sẵn sàng để ResponseParser xử lý */
  content: string;
  /** Số tool call đã được convert sang Zen XML */
  convertedToolCount: number;
  /** Số tool call detected-only (bash_tool, present_files) */
  detectedOnlyCount: number;
}

export interface ProcessClaudeContentOptions {
  /**
   * Nếu true → bỏ qua việc map sandbox path sang workspace path.
   * Dùng khi conversation đang chạy trực tiếp trên claude.ai (không phải
   * sandbox) — path trong tool call đã là system path thật, không cần convert.
   * Default: false (có map path).
   */
  disablePathMapping?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CONVERSATION_TITLE_REGEX = /<conversation_title>[\s\S]*?<\/conversation_title>\s*/gi;
const TOOL_MARKER_START = "__CLAUDE_TOOL__:";
const TOOL_MARKER_END = "__END_TOOL__";

/**
 * Paths bắt đầu bằng các prefix này là internal sandbox paths — không có
 * ý nghĩa trên workspace của user → skip tool call hoàn toàn.
 *   /mnt/user-data/outputs/ — nơi claude lưu file để user download
 *   /mnt/user-data/uploads/ — file upload tạm thời
 *   /mnt/user-data/         — toàn bộ vùng sandbox data
 */
const SANDBOX_SKIP_PREFIXES = [
  "/mnt/user-data/",
  "/mnt/",
];

// ─── Path Mapper ──────────────────────────────────────────────────────────

/**
 * Kiểm tra path có phải sandbox-internal không (nên skip tool call).
 */
function isSandboxInternalPath(p: string): boolean {
  return SANDBOX_SKIP_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/**
 * Map sandbox path → workspace path.
 *
 * Rules:
 *   /home/claude/work/<project>/<rest> → <workspacePath>/<rest>
 *   /home/claude/<rest> (ngoài work/)  → <workspacePath>/<rest>  (file claude tạo thẳng vào home)
 *   ./relative hay ../relative          → giữ nguyên (Zen tự resolve)
 *   path khác                          → giữ nguyên
 */
function mapSandboxPath(sandboxPath: string, workspacePath: string): string {
  const DEBUG = "[mapSandboxPath]";
  console.log(
    `${DEBUG} IN  sandboxPath=${JSON.stringify(sandboxPath)} workspacePath=${JSON.stringify(workspacePath)}`,
  );

  if (!sandboxPath) {
    console.log(`${DEBUG} OUT empty path → return as-is`);
    return sandboxPath;
  }

  if (sandboxPath.startsWith("./") || sandboxPath.startsWith("../")) {
    console.log(`${DEBUG} OUT relative (./ or ../) → return as-is: ${JSON.stringify(sandboxPath)}`);
    return sandboxPath;
  }

  const WORK_PREFIX = "/home/claude/work/";
  const HOME_PREFIX = "/home/claude/";

  if (sandboxPath.startsWith(WORK_PREFIX)) {
    const afterWork = sandboxPath.slice(WORK_PREFIX.length);
    const slashIdx = afterWork.indexOf("/");
    if (slashIdx === -1) {
      console.log(`${DEBUG} OUT sandbox work root only → workspacePath: ${JSON.stringify(workspacePath)}`);
      return workspacePath;
    }
    const rel = afterWork.slice(slashIdx + 1);
    const result = rel
      ? `${workspacePath.replace(/\/$/, "")}/${rel}`
      : workspacePath;
    console.log(`${DEBUG} OUT sandbox work path → ${JSON.stringify(result)}`);
    return result;
  }

  if (sandboxPath.startsWith(HOME_PREFIX)) {
    const afterHome = sandboxPath.slice(HOME_PREFIX.length);
    // afterHome = "<folderName>/<rest>" hoặc "work/<project>/<rest>"
    // Strip 1 segment đầu (folderName hoặc "work") rồi lấy phần còn lại
    const slashIdx = afterHome.indexOf("/");
    if (slashIdx === -1) {
      // Chỉ có tên folder, không có sub-path → root workspace
      console.log(`${DEBUG} OUT sandbox home root only → workspacePath: ${JSON.stringify(workspacePath)}`);
      return workspacePath;
    }
    const segment = afterHome.slice(0, slashIdx); // "Zentri" hoặc "work"
    let rel: string;
    if (segment === "work") {
      // /home/claude/work/<project>/<rest> → strip thêm 1 segment nữa
      const afterWork = afterHome.slice(slashIdx + 1); // "<project>/<rest>"
      const workSlashIdx = afterWork.indexOf("/");
      if (workSlashIdx === -1) {
        console.log(`${DEBUG} OUT sandbox work root only → workspacePath`);
        return workspacePath;
      }
      rel = afterWork.slice(workSlashIdx + 1);
    } else {
      // /home/claude/<folderName>/<rest> → strip folderName
      rel = afterHome.slice(slashIdx + 1);
    }
    const result = rel
      ? `${workspacePath.replace(/\/$/, "")}/${rel}`
      : workspacePath;
    console.log(`${DEBUG} OUT sandbox home path → ${JSON.stringify(result)}`);
    return result;
  }

  // Relative path không có ./ prefix (vd: "README.md", "src/utils.ts")
  if (!sandboxPath.startsWith("/")) {
    const result = `${workspacePath.replace(/\/$/, "")}/${sandboxPath}`;
    console.log(`${DEBUG} OUT relative (no prefix) → ${JSON.stringify(result)}`);
    return result;
  }

  console.log(`${DEBUG} OUT absolute non-sandbox → return as-is: ${JSON.stringify(sandboxPath)}`);
  return sandboxPath;
}

// ─── XML helpers ──────────────────────────────────────────────────────────

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Tool Converters ──────────────────────────────────────────────────────

function convertView(input: Record<string, unknown>, ws: string): string {
  const p = mapSandboxPath((input.path as string) || "", ws);
  return `<read_file><file_path>${escXml(p)}</file_path></read_file>`;
}

function convertStrReplace(input: Record<string, unknown>, ws: string): string {
  const rawPath = (input.path as string) || "";
  const p = mapSandboxPath(rawPath, ws);
  return [
    `<replace_in_file>`,
    `<original_tool_name>str_replace</original_tool_name>`,
    `<original_path>${escXml(rawPath)}</original_path>`,
    `<file_path>${escXml(p)}</file_path>`,
    `<old_content>${(input.old_str as string) || ""}</old_content>`,
    `<new_content>${(input.new_str as string) || ""}</new_content>`,
    `</replace_in_file>`,
  ].join("\n");
}

function convertCreateFile(input: Record<string, unknown>, ws: string): string {
  const rawPath = (input.path as string) || "";
  const p = mapSandboxPath(rawPath, ws);
  return [
    `<write_to_file>`,
    `<original_tool_name>create_file</original_tool_name>`,
    `<original_path>${escXml(rawPath)}</original_path>`,
    `<file_path>${escXml(p)}</file_path>`,
    `<content>${(input.file_text as string) || (input.content as string) || ""}</content>`,
    `</write_to_file>`,
  ].join("\n");
}

/**
 * Convert bash_tool → Zen <run_command>
 *
 * Claude input: { command: string, restart?: boolean }
 * Zen XML: <run_command><command>...</command></run_command>
 *
 * Validation: Command MUST start with "cd /home/claude/<projectName> &&".
 * If not → return null (skip tool call completely).
 * If yes → strip prefix, return command to run from workspace.
 */
function convertBashTool(
  input: Record<string, unknown>,
  ws: string,
): string | null {
  const command = (input.command as string) || "";
  const restartTag = input.restart === true ? "\n<restart>true</restart>" : "";

  // Regex: cd /home/claude/<projectName> && <rest>
  // Capture group 1: projectName
  // Capture group 2: actual command
  const cdPrefixRegex = /^cd\s+\/home\/claude\/([^/\s]+)\s+&&\s+(.+)$/s;
  const match = command.match(cdPrefixRegex);

  if (!match) {
    console.log(
      `[convertBashTool] SKIP — command does not start with "cd /home/claude/<projectName> &&": ${JSON.stringify(command.slice(0, 100))}`,
    );
    return null;
  }

  const projectName = match[1];
  const actualCommand = match[2];

  console.log(
    `[convertBashTool] VALID — projectName="${projectName}", actualCommand="${actualCommand.slice(0, 60)}..."`,
  );

  // Return Zen XML with stripped command (to be run from workspace root)
  return `<run_command><command>${actualCommand}</command>${restartTag}</run_command>`;
}

/**
 * Convert 1 tool call.
 * Returns: Zen XML string | null (skip — unknown tool hoặc sandbox-internal path)
 *
 * NOTE: Không còn "" (detected-only) nữa — tất cả tool được convert sang Zen XML.
 * present_files: UI-only action (expose download link từ sandbox), không có Zen equivalent.
 */
function convertTool(
  name: string,
  input: Record<string, unknown>,
  ws: string,
  disablePathMapping: boolean,
): string | null {
  // Lấy path chính của tool để kiểm tra sandbox-internal
  const rawPath = (input.path as string) || "";

  console.log(
    `[convertTool] name="${name}" rawPath=${JSON.stringify(rawPath)} ws=${JSON.stringify(ws)} disablePathMapping=${disablePathMapping}`,
  );

  switch (name) {
    case "str_replace": {
      if (!disablePathMapping && isSandboxInternalPath(rawPath)) return null;
      const p = disablePathMapping ? rawPath : mapSandboxPath(rawPath, ws);
      return [
        `<replace_in_file><file_path>${escXml(p)}</file_path>`,
        `<old_content>${(input.old_str as string) || ""}</old_content>`,
        `<new_content>${(input.new_str as string) || ""}</new_content>`,
        `</replace_in_file>`,
      ].join("\n");
    }
    case "create_file": {
      if (!disablePathMapping && isSandboxInternalPath(rawPath)) return null;
      const p = disablePathMapping ? rawPath : mapSandboxPath(rawPath, ws);
      return [
        `<write_to_file>`,
        `<file_path>${escXml(p)}</file_path>`,
        `<content>${(input.file_text as string) || (input.content as string) || ""}</content>`,
        `</write_to_file>`,
      ].join("\n");
    }
    case "view": {
      if (!disablePathMapping && isSandboxInternalPath(rawPath)) return null;
      const p = disablePathMapping ? rawPath : mapSandboxPath(rawPath, ws);
      return `<read_file><file_path>${escXml(p)}</file_path></read_file>`;
    }
    case "bash_tool":
      return convertBashTool(input, ws);
    // present_files: UI-only action (expose sandbox download link),
    // không có Zen equivalent → bỏ qua.
    case "present_files":
      return null;
    default:
      return null; // unknown, bỏ marker
  }
}

// ─── Main processor ───────────────────────────────────────────────────────

export function processClaudeContent(
  rawContent: string,
  workspacePath: string,
  options: ProcessClaudeContentOptions = {},
): ProcessClaudeContentResult {
  const DEBUG_PREFIX = "[ClaudeContentProcessor]";
  const disablePathMapping = options.disablePathMapping ?? false;

  // ── Step 1: Strip <conversation_title> ──────────────────────────────
  const beforeStrip = rawContent;
  let content = rawContent.replace(CONVERSATION_TITLE_REGEX, "");
  if (content !== beforeStrip) {
    console.log(`${DEBUG_PREFIX} Stripped <conversation_title> tag`);
  }

  // ── Step 2: Parse tool markers ───────────────────────────────────────
  let convertedToolCount = 0;
  let detectedOnlyCount = 0;
  let result = "";
  let remaining = content;

  console.log(
    `${DEBUG_PREFIX} Starting tool marker parse. workspacePath="${workspacePath}", contentLength=${content.length}, disablePathMapping=${disablePathMapping}`,
  );

  const hasAnyMarker = content.includes(TOOL_MARKER_START);
  if (!hasAnyMarker) {
    console.log(`${DEBUG_PREFIX} No tool markers found — returning as-is`);
    return { content: content.trim(), convertedToolCount: 0, detectedOnlyCount: 0 };
  }

  let markerIndex = 0;

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf(TOOL_MARKER_START);
    if (startIdx === -1) {
      result += remaining;
      break;
    }

    result += remaining.slice(0, startIdx);
    const afterStart = remaining.slice(startIdx + TOOL_MARKER_START.length);
    const endIdx = afterStart.indexOf(TOOL_MARKER_END);

    if (endIdx === -1) {
      // Marker chưa kết thúc — giữ lại nguyên
      console.warn(
        `${DEBUG_PREFIX} Incomplete tool marker at index ${markerIndex} — keeping raw`,
      );
      result += TOOL_MARKER_START + afterStart;
      break;
    }

    const jsonStr = afterStart.slice(0, endIdx);
    remaining = afterStart.slice(endIdx + TOOL_MARKER_END.length);

    let toolCall: { name: string; id: string; input: Record<string, unknown> };
    try {
      toolCall = JSON.parse(jsonStr);
    } catch (e) {
      console.error(
        `${DEBUG_PREFIX} Failed to parse tool JSON at marker ${markerIndex}:`,
        e,
        "\nRaw JSON (first 200 chars):",
        jsonStr.slice(0, 200),
      );
      markerIndex++;
      continue; // bỏ marker này
    }

    console.log(
      `${DEBUG_PREFIX} Marker #${markerIndex}: name="${toolCall.name}", id="${toolCall.id}", inputKeys=${Object.keys(toolCall.input).join(",")}`,
    );

    const zenXml = convertTool(toolCall.name, toolCall.input, workspacePath, disablePathMapping);

    if (zenXml === null) {
      const rawPath = (toolCall.input.path as string) || "";
      if (isSandboxInternalPath(rawPath)) {
        console.log(
          `${DEBUG_PREFIX} Marker #${markerIndex} (${toolCall.name}): skipped — sandbox-internal path "${rawPath}"`,
        );
      } else {
        console.log(
          `${DEBUG_PREFIX} Marker #${markerIndex} (${toolCall.name}): unknown tool, skipped`,
        );
      }
    } else if (zenXml === "") {
      // Không còn detected-only sau khi refactor, branch này không bao giờ xảy ra.
      // Giữ lại để tránh silent bug nếu có regression.
      console.warn(
        `${DEBUG_PREFIX} Marker #${markerIndex} (${toolCall.name}): unexpected empty XML (should not happen)`,
      );
      detectedOnlyCount++;
    } else {
      console.log(
        `${DEBUG_PREFIX} Marker #${markerIndex} (${toolCall.name}): converted to Zen XML:\n${zenXml}`,
      );
      result += zenXml;
      convertedToolCount++;
    }

    markerIndex++;
  }

  const finalContent = result.trim();
  console.log(
    `${DEBUG_PREFIX} Done. converted=${convertedToolCount}, detectedOnly=${detectedOnlyCount}, finalLength=${finalContent.length}`,
  );

  return { content: finalContent, convertedToolCount, detectedOnlyCount };
}
