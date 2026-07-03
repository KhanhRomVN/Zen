/**
 * Test to diagnose streaming/SSE issues with tool tag recognition
 * This simulates how tags arrive in chunks during SSE streaming
 */

console.log("🌊 Streaming Tool Tag Recognition Test\n");
console.log("=".repeat(80));

// ============================================================================
// SSE STREAM CHUNKING SIMULATOR
// ============================================================================

/**
 * Creates realistic SSE-style chunks from a complete response
 * Simulates how real SSE streams break data at arbitrary byte boundaries
 * 
 * @param {string} completeResponse - The full response text
 * @param {Object} options - Chunking options
 * @param {number} options.minChunkSize - Minimum chunk size (default: 1)
 * @param {number} options.maxChunkSize - Maximum chunk size (default: 20)
 * @param {boolean} options.randomize - Use random chunk sizes (default: true)
 * @param {number} options.seed - Random seed for reproducibility (default: 42)
 * @returns {string[]} Array of chunks
 */
function createSSEStreamChunks(completeResponse, options = {}) {
  const {
    minChunkSize = 1,
    maxChunkSize = 20,
    randomize = true,
    seed = 42
  } = options;
  
  // Simple seeded random for reproducibility
  let randomSeed = seed;
  const seededRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  const chunks = [];
  let position = 0;
  
  while (position < completeResponse.length) {
    let chunkSize;
    
    if (randomize) {
      // Random size between min and max
      chunkSize = Math.floor(seededRandom() * (maxChunkSize - minChunkSize + 1)) + minChunkSize;
    } else {
      // Fixed max size
      chunkSize = maxChunkSize;
    }
    
    // Don't exceed remaining content
    chunkSize = Math.min(chunkSize, completeResponse.length - position);
    
    const chunk = completeResponse.substring(position, position + chunkSize);
    chunks.push(chunk);
    position += chunkSize;
  }
  
  return chunks;
}

// Mock complete AI response with various tool tags
const mockCompleteResponse = `<thinking>Pass 1 (Plan):- The grep command failed because I accidentally used 'undefined' as the search term instead of the actual pattern.- I need to search for \`func AutoMigrate\` properly.- The error is from my own malformed tool call. I'll correct it now.Pass 2 (Verify):- I will run a proper grep with the correct search term.- No markdown in tool turn.</thinking><grep><search_term>func AutoMigrate</search_term><folder_path>server/internal/database</folder_path></grep>`;

// Generate realistic SSE chunks
const streamChunks = createSSEStreamChunks(mockCompleteResponse, {
  minChunkSize: 5,
  maxChunkSize: 25,
  randomize: true,
  seed: 42
});

console.log("\n✅ Test 1: Simulated SSE Streaming");
console.log("-".repeat(80));
console.log(`Original response length: ${mockCompleteResponse.length} chars`);
console.log(`Generated chunks: ${streamChunks.length}`);
console.log(`Chunk sizes: ${streamChunks.map(c => c.length).join(", ")}\n`);

let accumulatedContent = "";
const toolPatterns = [
  "thinking",
  "grep",
  "read_file",
  "write_to_file",
];

streamChunks.forEach((chunk, index) => {
  accumulatedContent += chunk;
  const chunkPreview = chunk.length > 40 
    ? `${chunk.substring(0, 37)}...` 
    : chunk;
  
  console.log(`Chunk ${index + 1} (${chunk.length} chars): "${chunkPreview}"`);
  console.log(`   Accumulated: ${accumulatedContent.length} chars`);
  
  // Check what tags are detectable at this point
  const detectableTags = [];
  for (const toolName of toolPatterns) {
    const openRegex = new RegExp(`<${toolName}(?:\\s+[^>]*)?>`, "i");
    const closeRegex = new RegExp(`<\\/${toolName}>`, "i");
    
    if (openRegex.test(accumulatedContent)) {
      const isClosed = closeRegex.test(accumulatedContent);
      detectableTags.push(`${toolName}(${isClosed ? "closed" : "open"})`);
    }
  }
  
  console.log(`   Detectable tags: ${detectableTags.length > 0 ? detectableTags.join(", ") : "none"}`);
  console.log();
});

console.log("Final accumulated content:");
console.log(accumulatedContent);
console.log(`\n✅ Content integrity: ${accumulatedContent === mockCompleteResponse ? "PASS" : "FAIL"}`);

// ============================================================================
// PARSER VALIDATION - Test if accumulated content can be parsed correctly
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("🔍 PARSER VALIDATION - Testing Each Accumulated State");
console.log("=".repeat(80));

/**
 * Simplified parser to test tag extraction at each streaming step
 */
function parseStreamingContent(content) {
  const result = {
    thinking: { open: false, closed: false, content: null, partial: false },
    grep: { open: false, closed: false, params: {}, partial: false },
    errors: []
  };
  
  // Check for thinking tag
  const thinkingOpenMatch = content.match(/<thinking>/i);
  const thinkingCloseMatch = content.match(/<\/thinking>/i);
  
  if (thinkingOpenMatch) {
    result.thinking.open = true;
    if (thinkingCloseMatch) {
      result.thinking.closed = true;
      const thinkingContent = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
      if (thinkingContent) {
        result.thinking.content = thinkingContent[1];
      }
    } else {
      // Unclosed thinking - check for partial
      const partialContent = content.substring(thinkingOpenMatch.index + 10);
      result.thinking.partial = true;
      result.thinking.content = partialContent;
    }
  }
  
  // Check for grep tag
  const grepOpenMatch = content.match(/<grep>/i);
  const grepCloseMatch = content.match(/<\/grep>/i);
  
  if (grepOpenMatch) {
    result.grep.open = true;
    if (grepCloseMatch) {
      result.grep.closed = true;
      
      // Extract parameters
      const searchTermMatch = content.match(/<search_term>([\s\S]*?)<\/search_term>/i);
      const folderPathMatch = content.match(/<folder_path>([\s\S]*?)<\/folder_path>/i);
      
      if (searchTermMatch) {
        result.grep.params.search_term = searchTermMatch[1];
      } else {
        result.errors.push("Missing or incomplete <search_term>");
      }
      
      if (folderPathMatch) {
        result.grep.params.folder_path = folderPathMatch[1];
      } else {
        result.errors.push("Missing or incomplete <folder_path>");
      }
    } else {
      result.grep.partial = true;
      
      // Try to extract what we have so far
      const searchTermMatch = content.match(/<search_term>([\s\S]*?)(?:<\/search_term>)?/i);
      const folderPathMatch = content.match(/<folder_path>([\s\S]*?)(?:<\/folder_path>)?/i);
      
      if (searchTermMatch) {
        result.grep.params.search_term = searchTermMatch[1];
      }
      if (folderPathMatch) {
        result.grep.params.folder_path = folderPathMatch[1];
      }
    }
  }
  
  // Check for partial tag at end
  const partialTagMatch = /<[\/]?[a-zA-Z0-9_]*$/.exec(content);
  if (partialTagMatch) {
    result.errors.push(`Partial tag at end: "${partialTagMatch[0]}"`);
  }
  
  return result;
}

// Re-run streaming simulation with parser validation
let testAccumulated = "";
const parserStates = [];

streamChunks.forEach((chunk, index) => {
  testAccumulated += chunk;
  const parseResult = parseStreamingContent(testAccumulated);
  parserStates.push({
    chunkIndex: index + 1,
    accumulated: testAccumulated.length,
    parseResult
  });
});

// Show parser state at key transitions
console.log("\n📊 Parser State Transitions:");
console.log("-".repeat(80));

const keyFrames = [
  1, // First chunk
  Math.floor(streamChunks.length / 4), // 25%
  Math.floor(streamChunks.length / 2), // 50%
  Math.floor(streamChunks.length * 3 / 4), // 75%
  streamChunks.length // Final
];

keyFrames.forEach(frame => {
  const state = parserStates[frame - 1];
  if (!state) return;
  
  console.log(`\nChunk ${state.chunkIndex} (${state.accumulated} chars):`);
  console.log(`  Thinking: ${state.parseResult.thinking.open ? (state.parseResult.thinking.closed ? "✅ closed" : "⏳ open") : "❌ not found"}`);
  console.log(`  Grep: ${state.parseResult.grep.open ? (state.parseResult.grep.closed ? "✅ closed" : "⏳ open") : "❌ not found"}`);
  
  if (state.parseResult.grep.closed) {
    console.log(`    └─ search_term: "${state.parseResult.grep.params.search_term || "missing"}"`);
    console.log(`    └─ folder_path: "${state.parseResult.grep.params.folder_path || "missing"}"`);
  }
  
  if (state.parseResult.errors.length > 0) {
    console.log(`  ⚠️ Errors: ${state.parseResult.errors.join(", ")}`);
  }
});

// Final validation
console.log("\n" + "=".repeat(80));
console.log("✅ FINAL PARSE VALIDATION");
console.log("=".repeat(80));

const finalParse = parserStates[parserStates.length - 1].parseResult;

console.log("\n🎯 Thinking Block:");
console.log(`  Status: ${finalParse.thinking.closed ? "✅ Complete" : "❌ Incomplete"}`);
if (finalParse.thinking.content) {
  const preview = finalParse.thinking.content.substring(0, 100);
  console.log(`  Content: "${preview}${finalParse.thinking.content.length > 100 ? "..." : ""}"`);
  console.log(`  Length: ${finalParse.thinking.content.length} chars`);
}

console.log("\n🎯 Grep Tool Call:");
console.log(`  Status: ${finalParse.grep.closed ? "✅ Complete" : "❌ Incomplete"}`);
console.log(`  Parameters:`);
console.log(`    search_term: "${finalParse.grep.params.search_term || "MISSING"}"`);
console.log(`    folder_path: "${finalParse.grep.params.folder_path || "MISSING"}"`);

if (finalParse.errors.length > 0) {
  console.log("\n❌ PARSE ERRORS:");
  finalParse.errors.forEach(err => console.log(`  - ${err}`));
} else {
  console.log("\n✅ No parse errors detected!");
}

// Test 2: Partial tag at end of stream
console.log("\n✅ Test 2: Partial Tag Handling");
console.log("-".repeat(80));

const partialCases = [
  { content: "Some text <gre", expected: "partial tag '<gre'" },
  { content: "Some text <grep", expected: "partial tag '<grep'" },
  { content: "Some text <grep>", expected: "open tag without close" },
  { content: "Some text <grep><search", expected: "nested partial parameter tag" },
  { content: "Some text <grep><search_term>test", expected: "open param tag without close" },
];

partialCases.forEach((testCase, index) => {
  console.log(`\nCase ${index + 1}: ${testCase.expected}`);
  console.log(`   Content: "${testCase.content}"`);
  
  // Check for partial tag at end
  const partialTagMatch = /<[\/]?[a-zA-Z0-9_]*$/.exec(testCase.content);
  if (partialTagMatch) {
    console.log(`   ⚠️ Detected partial tag: "${partialTagMatch[0]}"`);
    console.log(`   Text before partial: "${testCase.content.substring(0, partialTagMatch.index)}"`);
  } else {
    console.log(`   ✅ No partial tag at end`);
  }
  
  // Check for unclosed tags
  const grepOpenMatch = testCase.content.match(/<grep(?:\s+[^>]*)?>/ );
  const grepCloseMatch = testCase.content.match(/<\/grep>/);
  if (grepOpenMatch && !grepCloseMatch) {
    console.log(`   ⚠️ Unclosed <grep> tag detected`);
  }
});

// Test 3: Content with special characters that might break parsing
console.log("\n✅ Test 3: Special Characters in Content");
console.log("-".repeat(80));

const specialCharCases = [
  {
    name: "Regex with escaped characters",
    content: '<grep><search_term>extractParam\\([^)]+\\)\\s*\\?\\?</search_term></grep>',
  },
  {
    name: "Content with < and >",
    content: '<grep><search_term>string | undefined</search_term></grep>',
  },
  {
    name: "Content with XML entities",
    content: '<grep><search_term>&lt;tag&gt;</search_term></grep>',
  },
  {
    name: "Content with newlines and special chars",
    content: '<grep><search_term>Pattern:\n- Item 1\n- Item 2</search_term></grep>',
  },
];

specialCharCases.forEach((testCase) => {
  console.log(`\n${testCase.name}:`);
  console.log(`   Content: ${testCase.content.substring(0, 80)}${testCase.content.length > 80 ? "..." : ""}`);
  
  const grepMatch = testCase.content.match(/<grep>([\s\S]*?)<\/grep>/i);
  if (grepMatch) {
    const innerContent = grepMatch[1];
    const searchTermMatch = innerContent.match(/<search_term>([\s\S]*?)<\/search_term>/i);
    
    if (searchTermMatch) {
      console.log(`   ✅ Successfully extracted search_term: "${searchTermMatch[1]}"`);
    } else {
      console.log(`   ❌ Failed to extract search_term`);
    }
  } else {
    console.log(`   ❌ Failed to match <grep> tag`);
  }
});

// Test 4: Tag ordering and nesting issues
console.log("\n✅ Test 4: Tag Ordering Issues");
console.log("-".repeat(80));

const orderingCases = [
  {
    name: "Correct order",
    content: "<thinking>Analysis</thinking><grep><search_term>test</search_term></grep>",
    shouldWork: true,
  },
  {
    name: "Nested thinking inside grep (should ignore thinking)",
    content: "<grep><thinking>This should be ignored</thinking><search_term>test</search_term></grep>",
    shouldWork: true,
  },
  {
    name: "Multiple grep tags",
    content: "<grep><search_term>test1</search_term></grep><grep><search_term>test2</search_term></grep>",
    shouldWork: true,
  },
  {
    name: "Interleaved unclosed tags",
    content: "<thinking>Start<grep><search_term>test</search_term></grep>",
    shouldWork: false,
  },
];

orderingCases.forEach((testCase) => {
  console.log(`\n${testCase.name}:`);
  console.log(`   Expected: ${testCase.shouldWork ? "✅ Should work" : "⚠️ May have issues"}`);
  
  const thinkingMatches = (testCase.content.match(/<thinking>/gi) || []).length;
  const grepMatches = (testCase.content.match(/<grep>/gi) || []).length;
  const thinkingCloses = (testCase.content.match(/<\/thinking>/gi) || []).length;
  const grepCloses = (testCase.content.match(/<\/grep>/gi) || []).length;
  
  console.log(`   Tags: thinking(${thinkingMatches}/${thinkingCloses}) grep(${grepMatches}/${grepCloses})`);
  
  const allClosed = thinkingMatches === thinkingCloses && grepMatches === grepCloses;
  console.log(`   Status: ${allClosed ? "✅ All tags closed" : "⚠️ Unclosed tags detected"}`);
});

// Final summary
console.log("\n" + "=".repeat(80));
console.log("🎯 STREAMING DIAGNOSTIC SUMMARY");
console.log("=".repeat(80));

console.log("\nKey Findings:");
console.log("1. ✅ Tags can be recognized even when arriving in chunks");
console.log("2. ⚠️ Partial tags at stream end need special handling");
console.log("3. ✅ Special characters in content are handled by regex");
console.log("4. ⚠️ Nested or interleaved tags may cause issues");

console.log("\nPotential Issues:");
console.log("- If SSE stream is split mid-tag, parser must wait for completion");
console.log("- Unclosed tags at stream end should be flagged as 'partial'");
console.log("- Content with < or > characters might confuse simple regex");
console.log("- Tool tags inside thinking blocks should be extracted separately");

console.log("\n" + "=".repeat(80));
