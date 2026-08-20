/**
 * Test case thực tế từ user - để tìm ra nguyên nhân lỗi MISSING_REQUIRED_PARAM
 */

// PORT từ ToolParser.ts
const CONTENT_PARAMS = new Set(["content", "diff", "old_content", "new_content"]);

function decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractParamValue(content, paramName) {
  const isContentParam = CONTENT_PARAMS.has(paramName);

  // Use manual tag matching
  const openingTag = new RegExp(`<${paramName}(?:\\s+[^>]*)?>`, "i");
  const openingMatch = content.match(openingTag);

  if (openingMatch) {
    const startIndex = openingMatch.index + openingMatch[0].length;
    const closingTag = `</${paramName}>`;
    const closingIndex = content.indexOf(closingTag, startIndex);

    if (closingIndex !== -1) {
      let value = content.substring(startIndex, closingIndex);
      value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
      const decoded = decodeHtmlEntities(value);
      return isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
    }
  }

  // Fallback regex
  const standardRegex = new RegExp(
    `<${paramName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${paramName}>`,
    "i",
  );
  const standardMatch = content.match(standardRegex);
  if (standardMatch) {
    let value = standardMatch[1];
    value = value.replace(/^```text\s*\n?|\n?```\s*$/g, "");
    const decoded = decodeHtmlEntities(value);
    return isContentParam ? decoded.replace(/^\n|\n$/g, "") : decoded.trim();
  }

  return null;
}

function parseReplaceInFile(innerContent) {
  let filePath = extractParamValue(innerContent, "file_path");
  let oldContent = extractParamValue(innerContent, "old_content");
  let newContent = extractParamValue(innerContent, "new_content");

  if (!filePath) filePath = extractParamValue(innerContent, "path");
  if (!oldContent) oldContent = extractParamValue(innerContent, "old");
  if (!newContent) newContent = extractParamValue(innerContent, "new");

  return {
    file_path: filePath || "(missing)",
    old_content: oldContent || "(missing)",
    new_content: newContent || "(missing)",
  };
}

// ============================================================
// TEST CASE: Ví dụ thực tế từ user BỊ LỖI
// ============================================================

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║         TEST: Case thực tế từ user BỊ LỖI (large content)           ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const failedCase = `<replace_in_file>
<file_path>src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/TagRouter.tsx</file_path>
<old_content>  if (toolType === 'replace_in_file') {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    return (
      <ReplaceInFileRenderer
        key={actionIndex}
        action={action}
        actionIndex={actionIndex}
        messageId={messageId}
        isActionClicked={clickedActions.has(\`\${messageId}-action-\${actionIndex}\`)}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
        conversationId={conversationId}
        mergedItems={toolGroup}
      />
    );
  }</old_content>
<new_content>  if (toolType === 'replace_in_file') {
    return (
      <>
        {toolGroup.map(({ action, index }) => (
          <ReplaceInFileRenderer
            key={index}
            action={action}
            actionIndex={index}
            messageId={messageId}
            isActionClicked={clickedActions.has(\`\${messageId}-action-\${index}\`)}
            isActiveGroup={isActiveGroup && index === toolGroup[0].index}
            isLastMessage={isLastMessage}
            isLastItemInList={
              isLastItemInList &&
              index === toolGroup[toolGroup.length - 1].index
            }
            toolOutputs={toolOutputs}
            allMessages={allMessages}
            fileStatsMap={fileStatsMap}
            onToolClick={onToolClick}
            conversationId={conversationId}
            mergedItems={undefined}
          />
        ))}
      </>
    );
  }</new_content>
</replace_in_file>`;

const result = parseReplaceInFile(failedCase);

console.log("📋 PARSE RESULTS:");
console.log("─".repeat(70));
console.log(`file_path: ${result.file_path}`);
console.log(`old_content length: ${result.old_content === "(missing)" ? "MISSING!" : result.old_content.length}`);
console.log(`new_content length: ${result.new_content === "(missing)" ? "MISSING!" : result.new_content.length}`);
console.log("");

// Check if parsing succeeded
const allPresent =
  result.file_path !== "(missing)" &&
  result.old_content !== "(missing)" &&
  result.new_content !== "(missing)";

if (allPresent) {
  console.log("✅ SUCCESS: All params extracted correctly!");
  console.log("");
  console.log("🔍 new_content preview (first 200 chars):");
  console.log(result.new_content.substring(0, 200));
  console.log("");
  console.log("🔍 new_content preview (last 200 chars):");
  console.log(result.new_content.substring(Math.max(0, result.new_content.length - 200)));
} else {
  console.log("❌ FAILED: Some params are missing!");
  if (result.file_path === "(missing)") console.log("  - file_path is missing");
  if (result.old_content === "(missing)") console.log("  - old_content is missing");
  if (result.new_content === "(missing)") console.log("  - new_content is missing");
}

console.log("\n" + "=".repeat(70));

// ============================================================
// TEST CASE: Ví dụ nhỏ hơn từ user KHÔNG LỖI
// ============================================================

console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
console.log("║        TEST: Case nhỏ hơn từ user KHÔNG LỖI (small content)         ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

const successCase = `<replace_in_file>
<file_path>src/renderer/src/components/RightPanel/Agent/feature/Chat/components/ChatBody/AIMessageBox/TagRouter.tsx</file_path>
<old_content>  if (toolType === 'replace_in_file') {
    const action = firstAction;
    const actionIndex = toolGroup[0].index;
    return (</old_content>
<new_content>  if (toolType === 'replace_in_file') {
    return (
      <>
        {toolGroup.map(({ action, index }) => (</new_content>
</replace_in_file>`;

const result2 = parseReplaceInFile(successCase);

console.log("📋 PARSE RESULTS:");
console.log("─".repeat(70));
console.log(`file_path: ${result2.file_path}`);
console.log(`old_content length: ${result2.old_content === "(missing)" ? "MISSING!" : result2.old_content.length}`);
console.log(`new_content length: ${result2.new_content === "(missing)" ? "MISSING!" : result2.new_content.length}`);
console.log("");

const allPresent2 =
  result2.file_path !== "(missing)" &&
  result2.old_content !== "(missing)" &&
  result2.new_content !== "(missing)";

if (allPresent2) {
  console.log("✅ SUCCESS: All params extracted correctly!");
  console.log("");
  console.log("🔍 new_content:");
  console.log(result2.new_content);
} else {
  console.log("❌ FAILED: Some params are missing!");
  if (result2.file_path === "(missing)") console.log("  - file_path is missing");
  if (result2.old_content === "(missing)") console.log("  - old_content is missing");
  if (result2.new_content === "(missing)") console.log("  - new_content is missing");
}

console.log("\n" + "=".repeat(70));

// ============================================================
// PHÂN TÍCH
// ============================================================

console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                            PHÂN TÍCH                                 ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

console.log("📊 So sánh 2 cases:");
console.log(`  Case BỊ LỖI:     new_content = ${result.new_content === "(missing)" ? "MISSING" : result.new_content.length + " chars"}`);
console.log(`  Case KHÔNG LỖI:  new_content = ${result2.new_content === "(missing)" ? "MISSING" : result2.new_content.length + " chars"}`);
console.log("");

if (allPresent && allPresent2) {
  console.log("✅ CẢ HAI CASE ĐỀU PARSE THÀNH CÔNG Ở WEBVIEW!");
  console.log("");
  console.log("📌 KẾT LUẬN:");
  console.log("  Webview parser hoạt động tốt với cả 2 cases.");
  console.log("  Nếu user gặp lỗi MISSING_REQUIRED_PARAM, nguyên nhân phải là:");
  console.log("  1. Backend (extension) parse XML trước khi gửi sang webview");
  console.log("  2. Hoặc có validation ở backend bị lỗi");
  console.log("  3. Hoặc content bị truncate trong quá trình streaming");
} else {
  console.log("❌ CÓ CASE BỊ LỖI!");
  console.log("  Parser webview KHÔNG thể extract params đúng.");
  console.log("  Nguyên nhân: Có thể do JSX tags làm confused regex.");
}
