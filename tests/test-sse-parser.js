/**
 * Test SSE Response Parser
 * Run: node tests/test-sse-parser.js
 */

// Import the parser (we'll need to handle TypeScript)
const fs = require('fs');
const path = require('path');

// Mock the dependencies
const normalizeTagVariants = (content) => content;
const parseToolAction = (toolName, innerContent, rawXml) => ({
  type: toolName,
  params: {},
  rawXml: rawXml
});
const extractParamValue = (content, param) => null;
const extractThinkingBlocks = (content) => {
  const thinkingBlocks = [];
  
  const toolTags = [
    'write_to_file', 'replace_in_file', 'read_file', 'run_command',
    'list_files', 'delete_file', 'delete_folder', 'move_file',
    'execute_agent_action', 'grep', 'git_status', 'commit_message', 'git_diff',
    'code', 'file', 'markdown', 'question'
  ];

  let processed = '';
  let i = 0;
  let inBacktick = false;
  let backtickCount = 0;
  
  while (i < content.length) {
    // Check for backticks (both single ` and triple ```)
    if (content[i] === '`') {
      let currentBacktickCount = 0;
      let j = i;
      while (j < content.length && content[j] === '`') {
        currentBacktickCount++;
        j++;
      }
      
      if (inBacktick && currentBacktickCount === backtickCount) {
        inBacktick = false;
        backtickCount = 0;
      } else if (!inBacktick) {
        inBacktick = true;
        backtickCount = currentBacktickCount;
      }
      
      processed += content.substring(i, j);
      i = j;
      continue;
    }
    
    if (inBacktick) {
      processed += content[i];
      i++;
      continue;
    }
    
    let foundToolTag = false;
    for (const toolTag of toolTags) {
      const openTag = `<${toolTag}`;
      if (content.substring(i, i + openTag.length).toLowerCase() === openTag.toLowerCase()) {
        const closingTag = `</${toolTag}>`;
        const closingIndex = content.toLowerCase().indexOf(closingTag.toLowerCase(), i);
        
        if (closingIndex !== -1) {
          const toolBlock = content.substring(i, closingIndex + closingTag.length);
          processed += toolBlock;
          i = closingIndex + closingTag.length;
          foundToolTag = true;
          break;
        } else {
          processed += content.substring(i);
          i = content.length;
          foundToolTag = true;
          break;
        }
      }
    }
    
    if (foundToolTag) {
      continue;
    }
    
    const thinkingOpenTag = '<thinking>';
    if (content.substring(i, i + thinkingOpenTag.length).toLowerCase() === thinkingOpenTag.toLowerCase()) {
      // Find the REAL closing </thinking> tag (not inside backticks/code blocks)
      // Strategy: track all backtick sequences using a stack
      let thinkingEndIndex = -1;
      let scanPos = i + thinkingOpenTag.length;
      
      // Stack to track open backtick contexts
      const backtickStack = [];
      
      while (scanPos < content.length) {
        // Skip escaped backticks (\`)
        if (scanPos > 0 && content[scanPos - 1] === '\\' && content[scanPos] === '`') {
          scanPos++;
          continue;
        }
        
        // Check for backtick sequences
        if (content[scanPos] === '`') {
          let btCount = 0;
          let btPos = scanPos;
          while (btPos < content.length && content[btPos] === '`') {
            btCount++;
            btPos++;
          }
          
          // Try to close an existing backtick context with matching count
          let found = false;
          for (let si = backtickStack.length - 1; si >= 0; si--) {
            if (backtickStack[si] === btCount) {
              // Found matching close - remove from stack
              backtickStack.splice(si, 1);
              found = true;
              break;
            }
          }
          
          if (!found) {
            // Opening new backtick context
            backtickStack.push(btCount);
          }
          
          scanPos = btPos;
          continue;
        }
        
        // Only check for </thinking> when NO open backtick contexts
        if (backtickStack.length === 0) {
          const closingTag = '</thinking>';
          if (content.substring(scanPos, scanPos + closingTag.length).toLowerCase() === closingTag.toLowerCase()) {
            thinkingEndIndex = scanPos;
            break;
          }
        }
        
        scanPos++;
      }
      
      if (thinkingEndIndex !== -1) {
        const thinkingContent = content.substring(i + thinkingOpenTag.length, thinkingEndIndex);
        const idx = thinkingBlocks.length;
        thinkingBlocks.push(thinkingContent);
        processed += `__THINKING_${idx}__`;
        i = thinkingEndIndex + '</thinking>'.length;
        continue;
      } else {
        const unclosedContent = content.substring(i + thinkingOpenTag.length);
        return {
          remainingContent: processed,
          thinkingBlocks,
          unclosedThinkingContent: unclosedContent
        };
      }
    }
    
    processed += content[i];
    i++;
  }

  return {
    remainingContent: processed,
    thinkingBlocks,
    unclosedThinkingContent: null
  };
};

// Parse function (simplified version of ResponseParser.ts)
const parseAIResponse = (content) => {
  const result = {
    followupQuestion: null,
    followupOptions: null,
    taskName: null,
    actions: [],
    contentBlocks: [],
    displayText: "",
    question: null,
  };

  let remainingContent = content;

  // Hide </no_response> markers
  remainingContent = remainingContent.replace(/<\/no_response\s*>/gi, "");

  // Normalize all tag name variants to canonical forms
  remainingContent = normalizeTagVariants(remainingContent);

  // Pre-extract <thinking> blocks
  const {
    remainingContent: contentAfterThinking,
    thinkingBlocks,
    unclosedThinkingContent,
  } = extractThinkingBlocks(remainingContent);
  remainingContent = contentAfterThinking;

  const toolPatterns = [
    "read_file",
    "write_to_file",
    "replace_in_file",
    "run_command",
    "list_files",
    "delete_file",
    "delete_folder",
    "move_file",
    "execute_agent_action",
    "grep",
    "git_status",
    "commit_message",
    "git_diff",
    "code",
    "file",
    "markdown",
    "question",
  ];

  // Helper to find next tag
  const findNextTag = (str) => {
    let minIndex = -1;
    let bestMatch = null;
    let bestTool = "";
    let isClosed = false;

    // 1. Try to find complete (closed) tags first
    for (const toolName of toolPatterns) {
      let closingTagPattern = toolName;
      if (toolName === "read_file") {
        closingTagPattern = "read_files?";
      }

      const regex = new RegExp(
        `<${toolName}(?:\\s+[^>]*)?\\s*(?:>([\\s\\S]*?)<\\/${closingTagPattern}\\s*>|\\/>)`,
        "i",
      );
      const match = regex.exec(str);

      if (match) {
        if (minIndex === -1 || match.index < minIndex) {
          minIndex = match.index;
          bestMatch = match;
          bestTool = toolName;
          isClosed = true;
        }
      }
    }

    // 2. If no closed tag/block found, check for unclosed start tags
    for (const toolName of toolPatterns) {
      const openRegex = new RegExp(`<${toolName}(?:\\s+[^>]*)?>`, "i");
      const match = openRegex.exec(str);
      if (match) {
        if (minIndex === -1 || match.index < minIndex) {
          minIndex = match.index;
          bestMatch = match;
          bestTool = toolName;
          isClosed = false;
        }
      }
    }

    return { index: minIndex, match: bestMatch, toolName: bestTool, isClosed };
  };

  const pushTextOrCodeBlocks = (baseType, content) => {
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    const segments = [];

    while ((match = regex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: baseType, content: textBefore });
      }

      const language = match[1] || "text";
      const codeContent = match[2].trimEnd();
      if (
        language === "markdown" ||
        (language === "text" && !codeContent.includes("\n"))
      ) {
        segments.push({ type: baseType, content: codeContent });
      } else {
        segments.push({
          type: "code",
          content: codeContent,
          language: language,
        });
      }

      lastIndex = regex.lastIndex;
    }

    const textAfter = content.substring(lastIndex);
    if (textAfter.trim()) {
      segments.push({ type: baseType, content: textAfter });
    }

    if (segments.length === 1 && segments[0].type !== "code") {
      result.contentBlocks.push(segments[0]);
    } else if (segments.length > 0) {
      result.contentBlocks.push({ type: "mixed_content", segments });
    }
  };

  let scanStr = remainingContent;

  while (scanStr.length > 0) {
    const { index, match, toolName, isClosed } = findNextTag(scanStr);

    if (index !== -1 && match) {
      const prefix = scanStr.substring(0, index);
      if (prefix.trim()) {
        pushTextOrCodeBlocks("markdown", prefix);
      }

      const rawXml = match[0];

      if (isClosed) {
        const innerContent = match[1];

        if (toolName === "markdown") {
          if (innerContent && innerContent.trim()) {
            pushTextOrCodeBlocks("markdown", innerContent.trim());
          }
        }

        scanStr = scanStr.substring(index + rawXml.length);
      } else {
        break;
      }
    } else {
      const partialTagMatch = /<[\/]?[a-zA-Z0-9_]*$/.exec(scanStr);
      if (partialTagMatch) {
        const textBeforePartial = scanStr.substring(0, partialTagMatch.index);
        if (textBeforePartial.trim()) {
          pushTextOrCodeBlocks("markdown", textBeforePartial);
        }
      } else {
        if (scanStr.trim()) {
          pushTextOrCodeBlocks("markdown", scanStr);
        }
      }
      break;
    }
  }

  result.displayText = result.contentBlocks
    .filter((b) => b.type === "markdown")
    .map((b) => b.content)
    .join("\n\n");

  // Restore thinking blocks from placeholders
  const placeholderRegex = /__THINKING_(\d+)__/g;

  const expandedBlocks = [];
  for (const block of result.contentBlocks) {
    if (block.type === "markdown" && placeholderRegex.test(block.content)) {
      placeholderRegex.lastIndex = 0;
      const parts = block.content.split(/__THINKING_(\d+)__/);
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          if (parts[i].trim()) {
            expandedBlocks.push({ type: "markdown", content: parts[i] });
          }
        } else {
          const thinkingIdx = parseInt(parts[i], 10);
          expandedBlocks.push({
            type: "thinking",
            content: thinkingBlocks[thinkingIdx] ?? "",
          });
        }
      }
    } else {
      expandedBlocks.push(block);
    }
  }

  result.contentBlocks = expandedBlocks;

  if (unclosedThinkingContent !== null) {
    result.contentBlocks.push({
      type: "thinking",
      content: unclosedThinkingContent,
    });
  }

  return result;
};

// SSE Response samples (extracted from SSE format)
const response1 = `<thinking>Pass 1 (Plan):
- User yêu cầu test response với chỉ có mỗi thẻ thinking.
- Yêu cầu đơn giản: chỉ cần trả về một response bắt đầu bằng thinking tags.
- Không có file nào cần đọc, chỉnh sửa, hay thực thi lệnh.
- Đây là test đơn thuần, không có yêu cầu xử lý logic hay code.

Pass 2 (Verify):
- Không có assumption nào cần kiểm tra.
- Không có tool nào được gọi → có thể output markdown bình thường.
- Đảm bảo response chỉ chứa thinking block và nội dung bên trong.</thinking>

<markdown>Đã test thành công. Response này chỉ chứa thẻ \`<thinking>\` với đúng hai section yêu cầu: **Pass 1 (Plan)** và **Pass 2 (Verify)**. Không có nội dung thừa.</markdown>`;

const response2 = `<thinking>Pass 1 (Plan):
- User says "xin chào" (hello in Vietnamese).
- This is a greeting, no specific coding task.
- I will respond with a greeting in Vietnamese, keep it concise and friendly.
- No files to read, edit, or commands to run.

Pass 2 (Verify):
- No assumptions needed.
- No tools required.
- Direct response is appropriate.</thinking>

<markdown>Xin chào! Tôi là Elara, trợ lý lập trình AI. Tôi sẵn sàng giúp bạn với các dự án code, debug, hoặc bất kỳ vấn đề kỹ thuật nào. Bạn cần hỗ trợ gì hôm nay?</markdown>`;

// Helper to display parsed result
const displayResult = (responseName, parsed) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ${responseName} - PARSED RESULT`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log('📊 Summary:');
  console.log(`   - Actions: ${parsed.actions.length}`);
  console.log(`   - Content Blocks: ${parsed.contentBlocks.length}`);
  console.log(`   - Has Question: ${parsed.question !== null}`);
  
  console.log('\n📝 Content Blocks:');
  parsed.contentBlocks.forEach((block, idx) => {
    console.log(`\n   [${idx}] Type: ${block.type}`);
    if (block.type === 'thinking') {
      console.log(`       Content Preview: "${block.content.substring(0, 100)}..."`);
      console.log(`       Full Length: ${block.content.length} chars`);
    } else if (block.type === 'markdown') {
      console.log(`       Content: "${block.content}"`);
    } else if (block.type === 'mixed_content') {
      console.log(`       Segments: ${block.segments.length}`);
      block.segments.forEach((seg, segIdx) => {
        console.log(`         [${segIdx}] ${seg.type}: "${seg.content.substring(0, 50)}..."`);
      });
    }
  });
  
  console.log('\n💬 Display Text (What user sees):');
  console.log(`   "${parsed.displayText}"`);
  
  console.log('\n🖥️  UI Rendering:');
  console.log('   ┌─────────────────────────────────────────────────────────────────┐');
  parsed.contentBlocks.forEach((block, idx) => {
    if (block.type === 'thinking') {
      console.log('   │ 💭 Thinking (collapsible/expandable)                           │');
      console.log('   ├─────────────────────────────────────────────────────────────────┤');
    } else if (block.type === 'markdown') {
      const lines = block.content.split('\n');
      lines.forEach(line => {
        const paddedLine = line.padEnd(63);
        console.log(`   │ ${paddedLine} │`);
      });
    }
  });
  console.log('   └─────────────────────────────────────────────────────────────────┘');
  
  console.log('\n✅ Full Parsed Object:');
  console.log(JSON.stringify(parsed, null, 2));
};

// Response 3: Complex thinking with multiple backticks and nested tags
const response3 = `<thinking>Pass 1 (Plan):
- User wants to test \`<thinking>\` tag with backticks
- We need to handle: \`single\`, \`\`double\`\`, and \`\`\`triple\`\`\` backticks
- Also test with code blocks:
\`\`\`typescript
function example() {
  const tag = "<thinking>nested tag</thinking>";
  return tag;
}
\`\`\`
- Test inline code with tags: \`<markdown>\`, \`</code>\`, \`<file>\`
- Test escaped sequences: \\n, \\t, \\\`
- Test special chars: <>&"'
- Test Unicode: 你好, مرحبا, здравствуй, 🎉

Pass 2 (Verify):
- All backtick types preserved
- Code blocks intact
- No false tag detection
- Unicode handled correctly</thinking>

<markdown>**Test Result**: Parser correctly handles:
- Single backticks: \`code\`
- Code blocks:
\`\`\`javascript
const x = "<thinking>not a real tag</thinking>";
\`\`\`
- Mixed content with \`inline code\` and **bold** text
- Special characters: <div>, &amp;, "quotes"
- Emoji: 🚀 ✨ 💡</markdown>`;

// Response 4: Edge case - thinking inside thinking (should only parse outer)
const response4 = `<thinking>Outer thinking block
This contains text mentioning thinking tags in plain text (not in backticks).
The parser should NOT treat these as real tags.
Some analysis here...</thinking>

<markdown>Result: Only outer thinking block was parsed.</markdown>`;

// Response 5: Streaming case - unclosed thinking
const response5 = `<thinking>Pass 1 (Plan):
- This is a streaming response
- The thinking tag is not closed yet
- Simulating real-time SSE streaming
- More content coming...`;

// Run tests
console.log('\n🧪 TESTING SSE RESPONSE PARSER\n');

console.log('Testing Response 1 (Basic)...');
const parsed1 = parseAIResponse(response1);
displayResult('Response 1 - Basic', parsed1);

console.log('\n\nTesting Response 2 (Greeting)...');
const parsed2 = parseAIResponse(response2);
displayResult('Response 2 - Greeting', parsed2);

console.log('\n\nTesting Response 3 (Complex with backticks)...');
const parsed3 = parseAIResponse(response3);
displayResult('Response 3 - Complex Backticks', parsed3);

console.log('\n\nTesting Response 4 (Edge case)...');
const parsed4 = parseAIResponse(response4);
displayResult('Response 4 - Edge Case', parsed4);

console.log('\n\nTesting Response 5 (Streaming - unclosed)...');
const parsed5 = parseAIResponse(response5);
displayResult('Response 5 - Streaming', parsed5);

console.log('\n\n✨ All tests completed!\n');
