/**
 * Test mô phỏng cơ chế parse replace_in_file từ ResponseParser.ts và ReplaceInFileParser.ts
 * 
 * Mục đích: Kiểm tra xem parser xử lý như thế nào khi new_content chứa JSX (có dấu <, >)
 * 
 * Chạy: node tests/replace-in-file-parser-test.js
 * 
 * Test cases:
 *   1. Response thuần chỉ có <replace_in_file> (không có text bao quanh)
 *   2. Response có <thinking> + <markdown> + <replace_in_file> (mô phỏng response AI đầy đủ)
 */

// ============================================================
// PORT từ src/webview-ui/src/features/chat/utils/ToolParser.ts
// ============================================================

/**
 * Params that carry multi-line file content — must NOT be trimmed.
 * (Giữ nguyên logic từ ToolParser.ts, thêm "old_content" và "new_content")
 */
const CONTENT_PARAMS = new Set(["content", "diff", "old_content", "new_content"]);

/**
 * PORT từ extractParamValue trong ToolParser.ts
 * Trích xuất giá trị của một tag con từ innerContent bằng regex.
 */
function extractParamValue(content, paramName) {
  const isContentParam = CONTENT_PARAMS.has(paramName);

  // Try standard XML tag (fully closed tag)
  const standardRegex = new RegExp(
    `<${paramName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${paramName}>`,
    "i",
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    let value = standardMatch[1];
    // Remove ```text wrappers if present
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    // For file content params: only strip a single leading/trailing newline
    return isContentParam ? value.replace(/^\n|\n$/g, "") : value.trim();
  }

  // Fallback: Try to extract with more lenient pattern
  const lenientRegex = new RegExp(
    `<${paramName}[^>]*>\\s*([\\s\\S]*?)\\s*<\\/${paramName}>`,
    "i",
  );
  const lenientMatch = content.match(lenientRegex);
  if (lenientMatch) {
    let value = lenientMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    return isContentParam ? value.replace(/^\n|\n$/g, "") : value.trim();
  }

  return null;
}

// ============================================================
// PORT từ src/webview-ui/src/features/chat/services/parsers/ReplaceInFileParser.ts
// ============================================================

function parseReplaceInFile(innerContent) {
  let filePath = extractParamValue(innerContent, "file_path");
  let oldContent = extractParamValue(innerContent, "old_content");
  let newContent = extractParamValue(innerContent, "new_content");

  // Fallback: Try alternative tag names
  if (!filePath) {
    filePath = extractParamValue(innerContent, "path");
  }
  if (!oldContent) {
    oldContent = extractParamValue(innerContent, "old");
  }
  if (!newContent) {
    newContent = extractParamValue(innerContent, "new");
  }

  return {
    file_path: filePath || "(missing)",
    old_content: oldContent || "(missing)",
    new_content: newContent || "(missing)",
  };
}

// ============================================================
// Mô phỏng bước 1: ResponseParser tìm tag <replace_in_file>...</replace_in_file>
// ============================================================

function extractReplaceInFileBlock(response) {
  // Regex tìm toàn bộ block <replace_in_file ...> ... </replace_in_file>
  // Giống logic trong findNextTag của ResponseParser.ts
  const regex = /<replace_in_file(?:\s+[^>]*)?>([\s\S]*?)<\/replace_in_file>/i;
  const match = response.match(regex);
  if (match) {
    return match[1]; // innerContent
  }
  return null;
}

// ============================================================
// Hàm chạy test dùng chung
// ============================================================

function runTest(label, response) {
  console.log("\n" + "=".repeat(70));
  console.log(`TEST: ${label}`);
  console.log("=".repeat(70));

  // Bước 1: Trích xuất innerContent từ response
  const innerContent = extractReplaceInFileBlock(response);

  if (!innerContent) {
    console.log("❌ FAIL: Không tìm thấy block <replace_in_file> trong response!");
    console.log("\nResponse preview (300 ký tự đầu):");
    console.log(response.substring(0, 300));
    return false;
  }

  console.log(`✅ Bước 1: Tìm thấy block <replace_in_file>, innerContent dài ${innerContent.length} ký tự`);

  // Bước 2: Parse innerContent
  const result = parseReplaceInFile(innerContent);

  console.log("\n--- KẾT QUẢ PARSE ---");
  console.log("file_path   :", result.file_path);
  console.log("old_content :", result.old_content.length, "ký tự");
  console.log("new_content :", result.new_content.length, "ký tự");

  // Kiểm tra các điểm quan trọng
  console.log("\n--- KIỂM TRA CHI TIẾT ---");

  const checks = [
    {
      name: "file_path trỏ đến GitStatusBlock.tsx",
      pass: result.file_path.includes("GitStatusBlock.tsx"),
    },
    {
      name: "old_content chứa 'getStatusColor'",
      pass: result.old_content.includes("getStatusColor"),
    },
    {
      name: "old_content KHÔNG chứa 'getStatusIcon' (hàm mới, chỉ có trong new_content)",
      pass: !result.old_content.includes("getStatusIcon"),
    },
    {
      name: "new_content chứa 'getStatusIcon'",
      pass: result.new_content.includes("getStatusIcon"),
    },
    {
      name: "new_content chứa '<Pencil size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<Pencil size={14}"),
    },
    {
      name: "new_content chứa '<Plus size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<Plus size={14}"),
    },
    {
      name: "new_content chứa '<Trash2 size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<Trash2 size={14}"),
    },
    {
      name: "new_content chứa '<Move size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<Move size={14}"),
    },
    {
      name: "new_content chứa '<HelpCircle size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<HelpCircle size={14}"),
    },
    {
      name: "new_content chứa '<FolderOpen size={14}' (JSX self-closing tag)",
      pass: result.new_content.includes("<FolderOpen size={14}"),
    },
    {
      name: "new_content chứa '<svg xmlns' (nested JSX tag mở)",
      pass: result.new_content.includes('<svg xmlns="http://www.w3.org/2000/svg"'),
    },
    {
      name: "new_content chứa '</svg>' (nested JSX tag đóng)",
      pass: result.new_content.includes("</svg>"),
    },
    {
      name: "new_content chứa '<path d=' (deeply nested self-closing JSX)",
      pass: result.new_content.includes('<path d="M12 19V5"'),
    },
    {
      name: "new_content chứa 'unstagedItems' (filter mới)",
      pass: result.new_content.includes("unstagedItems"),
    },
    {
      name: "new_content KHÔNG bị cắt ở giữa (dòng cuối chứa 'unpushedCommits')",
      pass: (() => {
        const lastLine = result.new_content.trimEnd().split("\n").pop() || "";
        return lastLine.includes("unpushedCommits") && lastLine.includes("isUnpushedCommit");
      })(),
    },
    {
      name: "old_content KHÔNG bị lẫn nội dung từ new_content (không chứa 'unstagedItems')",
      pass: !result.old_content.includes("unstagedItems"),
    },
    {
      name: "old_content kết thúc đúng (dòng cuối là 'unpushedCommits')",
      pass: (() => {
        const lastLine = result.old_content.trimEnd().split("\n").pop() || "";
        return lastLine.includes("unpushedCommits");
      })(),
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    if (!check.pass) allPassed = false;
    console.log(`${icon} ${check.name}`);
  }

  // Preview nếu có lỗi
  if (!allPassed) {
    console.log("\n--- DEBUG: PREVIEW NEW_CONTENT (10 dòng cuối) ---");
    const lines = result.new_content.split("\n");
    console.log(lines.slice(-10).join("\n"));
    console.log("\n--- DEBUG: PREVIEW OLD_CONTENT (10 dòng cuối) ---");
    const oldLines = result.old_content.split("\n");
    console.log(oldLines.slice(-10).join("\n"));
  }

  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log(`✅ TEST "${label}" — TẤT CẢ ${checks.length} KIỂM TRA ĐỀU QUA!`);
  } else {
    console.log(`❌ TEST "${label}" — CÓ KIỂM TRA THẤT BẠI!`);
  }
  console.log("=".repeat(70));

  return allPassed;
}

// ============================================================
// TEST CASE 1: Response thuần — chỉ có <replace_in_file>
// (Chính là response người dùng vừa paste, không có text bao quanh)
// ============================================================

const testCase1 = `<replace_in_file>
<path>src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/blocks/GitStatusBlock.tsx</path>
<old_content>  const getStatusColor = (status: string): string => {
    if (status === 'M' || status === 'MM' || status === 'AM') return $('--warn') || '#d4a72c';
    if (status === 'A' || status === 'R' || status === 'C') return $('--teal') || '#4ec9b0';
    if (status === 'D') return $('--error') || '#f14c4c';
    if (status === '?') return $('--info') || '#569cd6';
    if (status === 'U') return $('--violet') || '#8b5cf6';
    return $('--text-primary');
  };

  const stagedItems = statusItems.filter((item) => item.staged && !item.isUnpushedCommit);
  const unpushedCommits = statusItems.filter((item) => item.isUnpushedCommit);</old_content>
<new_content>  const getStatusColor = (status: string): string => {
    if (status === 'M' || status === 'MM' || status === 'AM') return $('--warn') || '#d4a72c';
    if (status === 'A' || status === 'R' || status === 'C') return $('--teal') || '#4ec9b0';
    if (status === 'D') return $('--error') || '#f14c4c';
    if (status === '?') return $('--info') || '#569cd6';
    if (status === 'U') return $('--violet') || '#8b5cf6';
    return $('--text-primary');
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      M: <Pencil size={14} strokeWidth={2} />,
      MM: <Pencil size={14} strokeWidth={2} />,
      AM: <Pencil size={14} strokeWidth={2} />,
      A: <Plus size={14} strokeWidth={2} />,
      D: <Trash2 size={14} strokeWidth={2} />,
      R: <Move size={14} strokeWidth={2} />,
      C: <Move size={14} strokeWidth={2} />,
      '?': <HelpCircle size={14} strokeWidth={2} />,
      '!': <FolderOpen size={14} strokeWidth={2} />,
      U: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      ),
    };
    return iconMap[status] || <FolderOpen size={14} strokeWidth={2} />;
  };

  const stagedItems = statusItems.filter((item) => item.staged && !item.isUnpushedCommit);
  const unstagedItems = statusItems.filter((item) => !item.staged && !item.isUnpushedCommit);
  const unpushedCommits = statusItems.filter((item) => item.isUnpushedCommit);</new_content>
</replace_in_file>`;

// ============================================================
// TEST CASE 2: Response đầy đủ — có <thinking> + <markdown> + <replace_in_file>
// (Mô phỏng response AI hoàn chỉnh như ban đầu người dùng gặp lỗi)
// ============================================================

const testCase2 = `
<thinking>
OK, the warning says the unused imports are still there. My replacement didn't work because I used the same content. Let me now make the actual changes. I'll do multiple replacements:

1. Add getStatusIcon function after getStatusColor
2. Add unstagedItems after stagedItems  
3. Add unstaged section in the render

Let me do these one at a time, matching exact content.
</thinking>

<markdown>Thêm getStatusIcon function, unstagedItems filter, và unstaged section vào GitStatusBlock.</markdown>

<replace_in_file>
<path>src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/blocks/GitStatusBlock.tsx</path>
<old_content>  const getStatusColor = (status: string): string => {
    if (status === 'M' || status === 'MM' || status === 'AM') return $('--warn') || '#d4a72c';
    if (status === 'A' || status === 'R' || status === 'C') return $('--teal') || '#4ec9b0';
    if (status === 'D') return $('--error') || '#f14c4c';
    if (status === '?') return $('--info') || '#569cd6';
    if (status === 'U') return $('--violet') || '#8b5cf6';
    return $('--text-primary');
  };

  const stagedItems = statusItems.filter((item) => item.staged && !item.isUnpushedCommit);
  const unpushedCommits = statusItems.filter((item) => item.isUnpushedCommit);</old_content>
<new_content>  const getStatusColor = (status: string): string => {
    if (status === 'M' || status === 'MM' || status === 'AM') return $('--warn') || '#d4a72c';
    if (status === 'A' || status === 'R' || status === 'C') return $('--teal') || '#4ec9b0';
    if (status === 'D') return $('--error') || '#f14c4c';
    if (status === '?') return $('--info') || '#569cd6';
    if (status === 'U') return $('--violet') || '#8b5cf6';
    return $('--text-primary');
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      M: <Pencil size={14} strokeWidth={2} />,
      MM: <Pencil size={14} strokeWidth={2} />,
      AM: <Pencil size={14} strokeWidth={2} />,
      A: <Plus size={14} strokeWidth={2} />,
      D: <Trash2 size={14} strokeWidth={2} />,
      R: <Move size={14} strokeWidth={2} />,
      C: <Move size={14} strokeWidth={2} />,
      '?': <HelpCircle size={14} strokeWidth={2} />,
      '!': <FolderOpen size={14} strokeWidth={2} />,
      U: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      ),
    };
    return iconMap[status] || <FolderOpen size={14} strokeWidth={2} />;
  };

  const stagedItems = statusItems.filter((item) => item.staged && !item.isUnpushedCommit);
  const unstagedItems = statusItems.filter((item) => !item.staged && !item.isUnpushedCommit);
  const unpushedCommits = statusItems.filter((item) => item.isUnpushedCommit);</new_content>
</replace_in_file>`;

// ============================================================
// CHẠY TẤT CẢ TEST CASES
// ============================================================

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║     TEST PARSER: replace_in_file với JSX trong new_content          ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");

const results = [];

results.push({
  name: "Case 1: Response thuần (chỉ có <replace_in_file>)",
  passed: runTest("Case 1: Response thuần (chỉ có <replace_in_file>)", testCase1),
});

results.push({
  name: "Case 2: Response đầy đủ (<thinking> + <markdown> + <replace_in_file>)",
  passed: runTest("Case 2: Response đầy đủ (<thinking> + <markdown> + <replace_in_file>)", testCase2),
});

// ============================================================
// TỔNG KẾT
// ============================================================

console.log("\n");
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                        TỔNG KẾT CUỐI CÙNG                          ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");

let totalPassed = 0;
for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} ${r.name}`);
  if (r.passed) totalPassed++;
}

console.log(`\n📊 Kết quả: ${totalPassed}/${results.length} test cases passed`);

if (totalPassed === results.length) {
  console.log(`
✅ TẤT CẢ TEST CASES ĐỀU QUA!

📌 KẾT LUẬN:
  - Parser tầng webview (extractParamValue trong ToolParser.ts) dùng regex
    <paramName>...</paramName> để trích xuất nội dung — regex này tìm CHÍNH XÁC
    chuỗi đóng "</paramName>" nên KHÔNG bị confused bởi các tag JSX như 
    <Pencil>, <Plus>, <svg>, <path> nằm bên trong nội dung.
    
  - Dù response có <thinking> và <markdown> bao quanh hay không, parser vẫn
    trích xuất đúng block <replace_in_file> và parse chính xác nội dung.
    
  - Lỗi MISSING_REQUIRED_PARAM: new_content ban đầu LÀ DO TẦNG BACKEND
    (hệ thống thực thi tool), KHÔNG phải do parser trong webview.
    Backend có thể dùng XML parser chuẩn và bị lỗi khi gặp < > trong nội dung
    không được escape/CDATA.
`);
} else {
  console.log(`
❌ MỘT SỐ TEST THẤT BẠI — xem chi tiết ở trên.
`);
}