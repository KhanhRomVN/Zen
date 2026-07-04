/**
 * Test to diagnose question block rendering issues
 * This simulates the res1 -> res2 scenario where res2 doesn't display
 */

console.log("🎯 Question Block Rendering Diagnostic Test\n");
console.log("=".repeat(80));

// ============================================================================
// MOCK RESPONSES
// ============================================================================

const res1 = `<thinking>Pass 1 (Plan):- User request: "test tag question" — this appears to be a test of the \`<question>\` tag functionality.- Target: No files or code changes needed. This is a system test.- Plan: Respond with a demonstration of the \`<question>\` tag as a test case, showing how it works.Pass 2 (Verify):- No files to read or edit.- No assumptions — the user explicitly wants to test the question tag.- Since this is a test request and no actual task needs to be performed, I can proceed with a demonstration directly.</thinking><markdown>Đây là một ví dụ về cách sử dụng thẻ \`<question>\` để hỏi người dùng nhiều câu hỏi cùng lúc:</markdown><question><q id="1" type="single" label="Bạn muốn thử nghiệm chức năng nào tiếp theo?"><option>Đọc và chỉnh sửa file</option><option>Chạy lệnh terminal</option><option>Tìm kiếm code trong dự án</option><option>Chỉ hỏi thêm câu hỏi khác</option></q><q id="2" type="multi" label="Bạn muốn tôi hỗ trợ những gì?"><option>Viết code mới</option><option>Sửa lỗi</option><option>Giải thích logic code</option><option>Tối ưu hiệu suất</option></q><q id="3" type="text" label="Nếu bạn có yêu cầu cụ thể, hãy nhập tại đây:" /><q id="4" type="confirm" label="Bạn đã hiểu cách hoạt động của thẻ question chưa?" /></question>`;

const res2 = `<thinking>Pass 1 (Plan):- User provided answers to the test questions: they chose "test" for each option and provided "test" as custom input.- This confirms the \`<question>\` tag functionality is working correctly.- User wants to continue with "test" — this appears to still be a system test request, not a real task.- No files to read, no code changes needed.- Plan: Acknowledge the test results and offer to move to a real task or continue testing.Pass 2 (Verify):- No assumptions — the user explicitly says "test" in all fields.- No files or code involved.- The purpose is to verify the question-answer flow works.- Since no actual work is requested, I'll respond with a confirmation and offer next steps.</thinking><markdown>Cảm ơn bạn đã test! Tôi nhận thấy:- **Câu 1**: Bạn chọn "Khác: test" → thẻ \`single\` hoạt động tốt.- **Câu 2**: Bạn chọn "Khác: test, Khác" → thẻ \`multi\` cho phép chọn nhiều tùy chọn.- **Câu 3**: Bạn nhập "test" → thẻ \`text\` nhận input tự do.- **Câu 4**: Bạn chọn "Ý kiến: test" → thẻ \`confirm\` nhận phản hồi tùy chỉnh.Hệ thống câu hỏi hoạt động chính xác như thiết kế.Bạn muốn tiếp tục với một tác vụ thực tế hay test thêm chức năng khác?</markdown><question><q id="1" type="single" label="Bạn muốn làm gì tiếp theo?"><option>Bắt đầu một tác vụ thực tế (ví dụ: sửa lỗi, viết code mới)</option><option>Test thêm chức năng khác (ví dụ: đọc file, chạy lệnh)</option><option>Kết thúc phiên test</option></q><q id="2" type="text" label="Nếu bạn có yêu cầu cụ thể, hãy mô tả chi tiết:" /></question>`;

// ============================================================================
// SIMPLIFIED PARSER (mirrors ResponseParser.ts logic)
// ============================================================================

function parseResponse(content) {
  const result = {
    contentBlocks: [],
    thinking: null,
    displayText: ""
  };

  // Extract thinking
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkingMatch) {
    result.thinking = thinkingMatch[1];
    content = content.replace(thinkingMatch[0], '');
  }

  // Find all tags
  const tagRegex = /<(markdown|question|code|file)(?:\s+[^>]*)?>[\s\S]*?<\/\1>|<(markdown|question|code|file)(?:\s+[^>]*)?\/>/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    // Text before tag
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      result.contentBlocks.push({
        type: "markdown",
        content: textBefore.trim()
      });
    }

    const tagName = match[1] || match[2];
    const fullMatch = match[0];

    if (tagName === "markdown") {
      const innerMatch = fullMatch.match(/<markdown>([\s\S]*?)<\/markdown>/i);
      if (innerMatch) {
        result.contentBlocks.push({
          type: "markdown",
          content: innerMatch[1].trim()
        });
      }
    } else if (tagName === "question") {
      // Parse question block
      const questionData = parseQuestionBlock(fullMatch);
      if (questionData) {
        result.contentBlocks.push(questionData);
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Text after all tags
  const textAfter = content.substring(lastIndex);
  if (textAfter.trim()) {
    result.contentBlocks.push({
      type: "markdown",
      content: textAfter.trim()
    });
  }

  return result;
}

function parseQuestionBlock(xmlContent) {
  const questions = [];
  
  // Find all <q> tags
  const qRegex = /<q\s+id="([^"]+)"\s+type="([^"]+)"\s+label="([^"]*)"\s*(?:\/>|>([\s\S]*?)<\/q>)/gi;
  let qMatch;
  
  while ((qMatch = qRegex.exec(xmlContent)) !== null) {
    const id = qMatch[1];
    const type = qMatch[2];
    const label = qMatch[3];
    const inner = qMatch[4] || "";
    
    const options = [];
    if (inner) {
      const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
      let optMatch;
      while ((optMatch = optionRegex.exec(inner)) !== null) {
        options.push(optMatch[1].trim());
      }
    }
    
    // Validate: single/multi need at least 2 options
    if ((type === "single" || type === "multi") && options.length < 2) {
      console.warn(`⚠️ SKIPPING question "${id}" - type ${type} needs at least 2 options, got ${options.length}`);
      continue;
    }
    
    questions.push({
      id,
      type,
      label: label || `Question ${questions.length + 1}`,
      options: options.length > 0 ? options : undefined
    });
  }
  
  if (questions.length === 0) {
    console.warn("⚠️ No valid questions found in question block");
    return null;
  }
  
  return {
    type: "question",
    questions: questions,
    options: [] // Legacy compatibility
  };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

console.log("\n📋 Test 1: Parse res1 (First response with questions)");
console.log("-".repeat(80));

const parsed1 = parseResponse(res1);
console.log("✅ Parse result:");
console.log(`  - contentBlocks: ${parsed1.contentBlocks.length}`);
console.log(`  - Block types: ${parsed1.contentBlocks.map(b => b.type).join(", ")}`);
console.log(`  - Has question: ${parsed1.contentBlocks.some(b => b.type === "question")}`);

const questionBlock1 = parsed1.contentBlocks.find(b => b.type === "question");
if (questionBlock1) {
  console.log(`  - Questions count: ${questionBlock1.questions?.length || 0}`);
  console.log(`  - Question IDs: ${questionBlock1.questions?.map(q => q.id).join(", ") || "none"}`);
} else {
  console.log("  ❌ No question block found!");
}

console.log("\n📋 Test 2: Parse res2 (Second response - THE PROBLEM)");
console.log("-".repeat(80));

const parsed2 = parseResponse(res2);
console.log("✅ Parse result:");
console.log(`  - contentBlocks: ${parsed2.contentBlocks.length}`);
console.log(`  - Block types: ${parsed2.contentBlocks.map(b => b.type).join(", ")}`);
console.log(`  - Has question: ${parsed2.contentBlocks.some(b => b.type === "question")}`);

const questionBlock2 = parsed2.contentBlocks.find(b => b.type === "question");
if (questionBlock2) {
  console.log(`  - Questions count: ${questionBlock2.questions?.length || 0}`);
  console.log(`  - Question IDs: ${questionBlock2.questions?.map(q => q.id).join(", ") || "none"}`);
} else {
  console.log("  ❌ No question block found!");
}

// ============================================================================
// COMPARISON
// ============================================================================

console.log("\n📊 Comparison:");
console.log("-".repeat(80));

const res1HasMarkdown = parsed1.contentBlocks.some(b => b.type === "markdown");
const res1HasQuestion = parsed1.contentBlocks.some(b => b.type === "question");
const res2HasMarkdown = parsed2.contentBlocks.some(b => b.type === "markdown");
const res2HasQuestion = parsed2.contentBlocks.some(b => b.type === "question");

console.log(`res1: markdown=${res1HasMarkdown}, question=${res1HasQuestion}`);
console.log(`res2: markdown=${res2HasMarkdown}, question=${res2HasQuestion}`);

if (res1HasQuestion && res2HasQuestion) {
  console.log("\n✅ PASS: Both responses have question blocks");
} else if (!res2HasQuestion) {
  console.log("\n❌ FAIL: res2 doesn't have question block (THIS IS THE BUG)");
} else {
  console.log("\n❌ FAIL: res1 doesn't have question block");
}

// ============================================================================
// DETAILED CONTENT ANALYSIS
// ============================================================================

console.log("\n🔍 Detailed Content Analysis:");
console.log("-".repeat(80));

console.log("\nres1 content structure:");
parsed1.contentBlocks.forEach((block, i) => {
  if (block.type === "question") {
    console.log(`  ${i + 1}. ${block.type} (${block.questions?.length || 0} questions)`);
    block.questions?.forEach((q, j) => {
      console.log(`     ${j + 1}. [${q.id}] ${q.type}: "${q.label}"`);
    });
  } else {
    const preview = block.content?.substring(0, 50).replace(/\n/g, ' ') || "";
    console.log(`  ${i + 1}. ${block.type}: "${preview}..."`);
  }
});

console.log("\nres2 content structure:");
parsed2.contentBlocks.forEach((block, i) => {
  if (block.type === "question") {
    console.log(`  ${i + 1}. ${block.type} (${block.questions?.length || 0} questions)`);
    block.questions?.forEach((q, j) => {
      console.log(`     ${j + 1}. [${q.id}] ${q.type}: "${q.label}"`);
    });
  } else {
    const preview = block.content?.substring(0, 50).replace(/\n/g, ' ') || "";
    console.log(`  ${i + 1}. ${block.type}: "${preview}..."`);
  }
});

// ============================================================================
// VISIBILITY SIMULATION
// ============================================================================

console.log("\n👁️ Visibility Simulation (ChatBody.tsx):");
console.log("-".repeat(80));

const messages = [
  {
    id: "msg-1",
    role: "assistant",
    content: res1,
    uiHidden: false,
    isCancelled: false,
    parsed: parsed1
  },
  {
    id: "msg-2", 
    role: "user",
    content: "User answered questions",
    uiHidden: false,
    isCancelled: false
  },
  {
    id: "msg-3",
    role: "assistant", 
    content: res2,
    uiHidden: false,
    isCancelled: false,
    parsed: parsed2
  }
];

const visibleMessages = messages.filter(m => !m.uiHidden && !m.isCancelled);

console.log(`Total messages: ${messages.length}`);
console.log(`Visible messages: ${visibleMessages.length}`);
console.log(`Message IDs: ${visibleMessages.map(m => m.id).join(", ")}`);

const msg3 = visibleMessages.find(m => m.id === "msg-3");
if (msg3 && msg3.parsed) {
  console.log(`\nmsg-3 (res2) visibility: ✅ VISIBLE`);
  console.log(`  - contentBlocks: ${msg3.parsed.contentBlocks.length}`);
  console.log(`  - Has question: ${msg3.parsed.contentBlocks.some(b => b.type === "question")}`);
} else {
  console.log(`\nmsg-3 (res2) visibility: ❌ HIDDEN`);
}

// ============================================================================
// FINAL DIAGNOSIS
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("🎯 DIAGNOSTIC SUMMARY");
console.log("=".repeat(80));

if (parsed2.contentBlocks.length === 0) {
  console.log("\n❌ ROOT CAUSE: Parser returned empty contentBlocks for res2");
  console.log("   → Check XML structure in res2");
  console.log("   → Verify tag closing");
} else if (!res2HasQuestion) {
  console.log("\n❌ ROOT CAUSE: Question block not parsed from res2");
  console.log("   → Parser found tags but didn't create question block");
  console.log("   → Check question validation logic");
} else if (!msg3) {
  console.log("\n❌ ROOT CAUSE: res2 message filtered from visibleMessages");
  console.log("   → Check uiHidden/isCancelled flags");
} else {
  console.log("\n✅ Parser and visibility checks PASSED");
  console.log("   → Issue must be in rendering layer (AIMessageBox/QuestionBlock)");
  console.log("   → Check browser console logs during actual render");
}

console.log("\n" + "=".repeat(80));
