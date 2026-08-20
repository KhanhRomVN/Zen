import { buildIdentityPrompt } from "./identity";
import { buildSystemContext, type SystemInfo } from "./system-context";

export type SystemPromptMode = "simple" | "promax";

export interface PromptModeConfig {
  language: string;
  systemInfo: SystemInfo;
}

/**
 * Build ProMax mode context dynamic theo OS được chọn (Windows vs Linux/POSIX).
 */
export function buildProMaxContext(systemInfo: SystemInfo): string {
  const effectiveOS =
    systemInfo.targetOS === "windows"
      ? "Windows"
      : systemInfo.targetOS === "linux"
        ? "Linux"
        : systemInfo.os;

  const isWindows = /windows/i.test(effectiveOS);

  const osSection = isWindows
    ? `  3. WINDOWS OS SHELL COMPLIANCE:
     * The execution environment is Windows (PowerShell / CMD).
     * NEVER use Linux-specific utilities ('sed', 'awk', 'rm -f', 'grep -E', 'export', 'cat').
     * For file operations, use Node.js scripts or native PowerShell commands.
     * Always use forward slashes '/' in all file paths (e.g. 'node src/index.js').
     * Only run standard atomic CLI commands (e.g. 'npm install', 'npm test', 'git status'). Do NOT cross-call shells ('cmd /c', 'powershell -Command' inside bash).`
    : `  3. LINUX / POSIX OS SHELL COMPLIANCE:
     * The execution environment is Linux / macOS (Bash / Zsh / sh).
     * Standard POSIX utilities ('cat', 'grep', 'rm', 'mkdir', 'chmod', 'sed') are fully supported.
     * Always use forward slashes '/' in all file paths.
     * Only run standard atomic CLI commands (e.g. 'npm install', 'npm test', 'git status').`;

  return `# PROMAX MODE DIRECTIVES — ONE-SHOT PRECISION & REQUEST CONSERVATION
- ONE-SHOT PRODUCTION ARCHITECTURE: Design high-performance, production-ready architecture from TURN 1 (InstancedMesh for 3D, memoization, modular code).
- TWO-PASS THINKING & MENTAL LINTING: Spend 30–60s in <thinking> to:
  * Pass 1 (Design): Map out complete architecture, state flow, and edge cases.
  * Pass 2 (Mental Syntax & Diff Check): Mentally trace every closing bracket '}', ')', ';', variable name, XML tag, and verify that new_content has NO duplicate calls, missing breaks, or dangling code.
- ZERO-NARRATION TOOL ACTION (CRITICAL — NEVER PROCRASTINATE):
  * NEVER emit prose-only messages promising action (NEVER say "Tôi sẽ bắt đầu phân tích...", "Đang đọc file...", "Tôi sẽ gọi tool ngay bây giờ..." without emitting the XML tool tag in the SAME turn).
  * If information is needed, ALWAYS emit the XML tool call (<list_files>, <read_file>, <find_files>, <grep>) IMMEDIATELY in that turn.
  * When user says "tiếp tục" / "continue" -> DO NOT say "Được, tôi tiếp tục", EMIT THE NEXT TOOL CALL DIRECTLY.
- EXPANSIVE CODE COMPLETION: Output 100% complete, working implementations. ZERO placeholders (NEVER write '// TODO', '// add remaining logic here', '// implement later').
- NO-HTML-ENTITIES (CRITICAL): Inside <content>, <new_content>, and <old_content>, ALWAYS write raw code characters directly ('<', '>', '&', '"', '\''). NEVER escape code into HTML entities (NEVER write '&lt;', '&gt;', '&amp;', '&quot;', '&#39;').

- FLAWLESS FILE EDITING & ANTI-TRUNCATION STRATEGY:
  1. SIZE-TIERED DISPATCH:
     * For new files or small files (<150 lines): Use <write_to_file> to output the ENTIRE file in ONE clean shot. Eliminates whitespace mismatch errors completely.
     * For medium/large files (>150 lines): Use <replace_in_file> for localized edits to prevent output token truncation.
  2. BOUNDARY & ANCHOR RULE (PREVENT DUPLICATE CODE LEAKS):
     * When modifying a 'case', function, or block, old_content MUST span the full boundary (from header to 'break;' or closing '}').
     * NEVER match just a single header line like 'case "xyz":' when replacing logic, or the old body beneath it will leak as duplicate/unreachable code.
  3. VERBATIM COPY-PASTE (ZERO SEARCH TEXT NOT FOUND):
     * Always copy old_content verbatim from the latest <read_file> output, preserving exact whitespace and indentation. Never guess or type from memory.
     * Keep old_content concise yet uniquely anchored (3–8 lines).
  4. TAG CLOSE INTEGRITY: Closing tag must strictly be </new_content> (never </old_content>).

- SAFE COMMAND & TOOL EXECUTION (ZERO REQUEST WASTE):
  1. PREFER BUILT-IN TOOLS OVER SHELL:
     * To inspect/find files: ALWAYS use <find_files> or <list_files> (NEVER run shell commands like 'dir', 'ls', 'Get-Item', 'stat').
     * To read files: ALWAYS use <read_file> (NEVER run 'cat', 'type', 'head').
     * To search text: ALWAYS use <grep> (NEVER run 'grep', 'findstr', 'Select-String' via shell).
  2. NO INLINE SCRIPTS (NO QUOTE ESCAPING ERRORS):
     * NEVER run inline scripts with nested quotes via 'node -e "..."' or 'python -c "..."'. Nested quotes break across shell wrappers.
     * If a script is needed, write a temporary file with <write_to_file><file_path>_test.js</file_path>... and run <run_command><command>node _test.js</command></run_command>.
${osSection}
- MAX-FILES-PER-SESSION (SESSION CAP): You are allowed to read or write at most ${systemInfo.maxFilesPerSession ?? 5} files in this conversation session. Track the count of unique files modified/read; when reaching the limit of ${systemInfo.maxFilesPerSession ?? 5} files, stop and inform the user.
- AGGRESSIVE BATCHING: Combine independent reads/discovery tools in a single turn. Read the full relevant range at once instead of making micro-range reads across multiple turns.`;
}

/**
 * Compact Tools Reference for ProMax mode (Nén 80% dung lượng, đầy đủ 100% cú pháp).
 */
export const PROMAX_TOOLS_COMPACT = `# TOOLS (Compact XML Reference)

Use XML tags for tool calls. Output tool calls directly:

- **find_files**: Find files by pattern: \`<find_files><file_name>*.ts</file_name><folder_path>src</folder_path></find_files>\`
- **list_files**: List folder tree: \`<list_files><folder_path>path/to/folder</folder_path><depth>2</depth></list_files>\`
- **read_file**: \`<read_file><file_path>path/to/file</file_path></read_file>\`
  Optional line range: \`<read_file><file_path>path/to/file</file_path><start_line>1</start_line><end_line>100</end_line></read_file>\`
- **grep**: Search text via regex: \`<grep><search_term>pattern</search_term><folder_path>src</folder_path></grep>\`
- **write_to_file**: Create/overwrite file with full content (uses real newlines, RAW code without &lt; &gt; &amp;):
  \`<write_to_file><file_path>path/to/file</file_path><content>full file content</content></write_to_file>\`
- **replace_in_file**: Replace code block (old_content must match exactly byte-for-byte from read_file, 3–8 lines):
  \`<replace_in_file><file_path>path/to/file</file_path>\n<old_content>exact original code with boundary</old_content>\n<new_content>replacement code</new_content>\n</replace_in_file>\`
  *Note: Closing tag must strictly be </new_content> (never </old_content>).*
- **run_command**: Run standard CLI command (use built-in tools find_files/read_file instead of shell ls/cat; never use node -e "..." with quotes):
  \`<run_command><command>npm test</command><folder_path>optional/path</folder_path></run_command>\`
- **delete_file**: Delete a file: \`<delete_file><file_path>path/to/file</file_path></delete_file>\`
- **revert_file**: Undo edits: \`<revert_file><file_path>path/to/file</file_path></revert_file>\`

## Response Tags
- \`<thinking>\`: Your 2-pass plan & mental syntax verification (Vietnamese).
- \`<markdown>\`: Explanations & communication with user (Vietnamese).
- \`<question>\`: Ask user confirmation when uncertain:
  \`<question><q id="1" type="confirm" label="Propose action here. Proceed?" /><q id="2" type="single" label="Choose option:"><option>Option A (recommended)</option><option>Option B</option></q></question>\``;

/**
 * Build system prompt cho ProMax mode.
 * Simple mode do index.ts xử lý riêng (combinePrompts gốc).
 */
export function buildPromptForMode(
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string {
  const { language, systemInfo } = config;

  if (mode === "promax") {
    const sections = [
      buildIdentityPrompt(language, "promax"),
      buildProMaxContext(systemInfo),
      PROMAX_TOOLS_COMPACT,
      buildSystemContext(systemInfo),
    ];
    return sections.join("\n\n---\n\n");
  }

  return buildIdentityPrompt(language, "simple");
}