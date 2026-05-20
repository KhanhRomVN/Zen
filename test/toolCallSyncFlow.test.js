/**
 * toolCallSyncFlow.test.js
 *
 * Mục đích: Mô phỏng và xác minh luồng sync/async của vòng lặp REQ -> RES -> ToolExec -> REQ
 * trong Zen AI Agent extension.
 *
 * Chạy bằng: node test/toolCallSyncFlow.test.js
 */

"use strict";

// ============================================================
// Helper utilities
// ============================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, description) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${description}`);
  }
}

const suites = [];

function describe(title, fn) {
  suites.push({ title, fn });
}

async function it(description, fn) {
  try {
    await fn();
  } catch (err) {
    testCount++;
    failCount++;
    console.error(`  ❌ ERROR in "${description}":`, err.message);
  }
}

// ============================================================
// Mock implementation of the sequential tool-call flow
// Mimics: useChatLLM (sendMessage) -> useToolExecution (handleToolRequest) -> sendMessage again
// ============================================================

/**
 * Simulates the AI backend streaming a response.
 * Returns the full response text after the given delay.
 */
async function mockStreamResponse(responseText, delayMs = 50) {
  return new Promise((resolve) => setTimeout(() => resolve(responseText), delayMs));
}

/**
 * Simulates executing a single tool action.
 * Returns a tool result string after the given delay.
 */
async function mockExecuteTool(toolType, params, delayMs = 30) {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(`[${toolType}] Result:\n\`\`\`\n${JSON.stringify(params)}\n\`\`\``),
      delayMs,
    ),
  );
}

/**
 * Minimal XML tool call parser to simulate ResponseParser.parseAIResponse.
 */
function parseAIResponse(content) {
  const actions = [];
  // Simple regex to find tool calls like <read_file><file_path>...</file_path></read_file>
  const toolRegex = /<(read_file|write_to_file|list_files|run_command|replace_in_file)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = toolRegex.exec(content)) !== null) {
    const toolType = match[1];
    const innerXml = match[2];
    const params = {};
    // Extract params
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(innerXml)) !== null) {
      params[paramMatch[1]] = paramMatch[2].trim();
    }
    actions.push({ type: toolType, params });
  }
  return { actions };
}

// ============================================================
// Core simulation: the main sequential processing loop
// ============================================================

/**
 * Simulates a full round-trip:
 * 1. User sends message
 * 2. AI responds (possibly with tool calls)
 * 3. Tools are executed sequentially
 * 4. Tool results are sent back to AI
 * 5. AI responds again (possibly with more tools, recurse)
 *
 * @returns {string[]} executionLog - timestamped log of events in order
 */
async function simulateAgentLoop(userMessage, maxRounds = 5) {
  const executionLog = [];
  let round = 0;

  // Predefined scenario: first round has tool call, second round is final answer
  const mockResponses = [
    // Round 1: AI requests to read a file
    `Let me check the README for you.\n<read_file><file_path>README.md</file_path></read_file>`,
    // Round 2: AI gives final answer after seeing tool result
    `Based on the README, the project is a VSCode extension for AI chat.`,
  ];

  const log = (msg) => {
    const ts = Date.now();
    executionLog.push({ ts, msg });
    // console.log(`  [${ts}] ${msg}`); // Uncomment for verbose output
  };

  log(`USER: ${userMessage}`);

  let currentMessages = [{ role: "user", content: userMessage }];
  let isProcessing = false;

  const sendMessage = async (content, skipFirstRequestLogic = false) => {
    // SYNC GUARD: simulates the isProcessing guard in useChatLLM
    if (isProcessing && !skipFirstRequestLogic) {
      throw new Error("RACE CONDITION: sendMessage called while still processing!");
    }

    isProcessing = true;
    log(`[sendMessage] → Sending to LLM (round ${round + 1}). content length: ${content.length}`);

    const responseText = mockResponses[round] || "I'm done.";
    round++;

    // Simulate streaming response (async wait)
    const aiResponseContent = await mockStreamResponse(responseText, 30);
    log(`[sendMessage] ← Got AI response (round ${round}). Length: ${aiResponseContent.length}`);

    isProcessing = false;
    log(`[sendMessage] isProcessing = false`);

    // Parse for tool calls
    const { actions } = parseAIResponse(aiResponseContent);
    log(`[sendMessage] Parsed ${actions.length} tool action(s): ${actions.map((a) => a.type).join(", ") || "none"}`);

    if (actions.length > 0 && round <= maxRounds) {
      // SYNC: We call handleToolRequest and AWAIT it fully before sendMessage is done
      log(`[sendMessage] Calling handleToolRequest (sync)...`);
      const toolResults = await handleToolRequest(actions, aiResponseContent);
      log(`[sendMessage] handleToolRequest completed. Sending tool results back.`);

      // Send tool results back - this is the next "skipFirstRequestLogic=true" call
      await sendMessage(toolResults, true);
    }
  };

  const handleToolRequest = async (actions, sourceMessageContent) => {
    log(`[handleToolRequest] Executing ${actions.length} action(s) sequentially.`);
    const results = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      log(`[handleToolRequest] Starting action ${i + 1}/${actions.length}: ${action.type}`);

      // SYNC: await each tool one by one
      const result = await mockExecuteTool(action.type, action.params, 20);
      log(`[handleToolRequest] Action ${i + 1} done: ${action.type}`);
      results.push(result);
    }

    log(`[handleToolRequest] All actions done. Returning combined results.`);
    return results.join("\n\n");
  };

  await sendMessage(userMessage);
  return executionLog;
}

// ============================================================
// Test suites
// ============================================================

describe("Sequential Tool Call Flow - Order Verification", async () => {
  await it("should process REQ -> RES -> TOOL -> REQ in strict order", async () => {
    const log = await simulateAgentLoop("Can you check the README?");

    // Flatten messages
    const msgs = log.map((e) => e.msg);

    // Check key ordering
    const userIdx = msgs.findIndex((m) => m.startsWith("USER:"));
    const firstSendIdx = msgs.findIndex((m) => m.includes("[sendMessage] → Sending"));
    const firstResIdx = msgs.findIndex((m) => m.includes("[sendMessage] ← Got AI response"));
    const toolStartIdx = msgs.findIndex((m) => m.includes("[handleToolRequest] Executing"));
    const toolDoneIdx = msgs.findIndex((m) => m.includes("[handleToolRequest] All actions done"));
    const secondSendIdx = msgs.findLastIndex((m) => m.includes("[sendMessage] → Sending"));
    const secondResIdx = msgs.findLastIndex((m) => m.includes("[sendMessage] ← Got AI response"));

    assert(userIdx < firstSendIdx, "USER message comes before first LLM request");
    assert(firstSendIdx < firstResIdx, "LLM request comes before LLM response");
    assert(firstResIdx < toolStartIdx, "LLM response comes before tool execution");
    assert(toolStartIdx < toolDoneIdx, "Tool execution starts before it finishes");
    assert(toolDoneIdx < secondSendIdx, "Tool execution finishes before next LLM request");
    assert(secondSendIdx < secondResIdx, "Second LLM request comes before second LLM response");
  });
});

describe("RACE CONDITION Detection - Double sendMessage Guard", async () => {
  await it("should throw if sendMessage is called concurrently without skipFirstRequestLogic", async () => {
    let raceDetected = false;
    let isProcessing = false;

    const mockSendMessage = async (content, skipFirstRequestLogic = false) => {
      if (isProcessing && !skipFirstRequestLogic) {
        raceDetected = true;
        throw new Error("RACE CONDITION detected!");
      }
      isProcessing = true;
      await new Promise((r) => setTimeout(r, 50)); // simulate work
      isProcessing = false;
    };

    // Call twice simultaneously WITHOUT skipFirstRequestLogic
    const [r1, r2] = await Promise.allSettled([
      mockSendMessage("First message"),
      mockSendMessage("Second message simultaneously"), // should fail
    ]);

    assert(raceDetected, "Race condition guard fires when sendMessage is called concurrently");
    assert(r1.status === "fulfilled", "First request completes normally");
    assert(r2.status === "rejected", "Second concurrent request is rejected");
  });

  await it("should NOT block skipFirstRequestLogic calls (tool results)", async () => {
    let isProcessing = true; // Simulate already processing

    const mockSendMessage = async (content, skipFirstRequestLogic = false) => {
      if (isProcessing && !skipFirstRequestLogic) {
        throw new Error("Blocked!");
      }
      return "ok";
    };

    let result;
    try {
      result = await mockSendMessage("tool result", true /* skipFirstRequestLogic */);
    } catch (e) {
      result = "BLOCKED";
    }

    assert(result === "ok", "skipFirstRequestLogic=true bypasses the isProcessing guard");
  });
});

describe("Sequential Tool Execution - No Parallel Tools", async () => {
  await it("should execute multiple tools sequentially, not in parallel", async () => {
    const executionOrder = [];

    const mockTool = (name, delay) =>
      new Promise((resolve) => {
        executionOrder.push(`start:${name}`);
        setTimeout(() => {
          executionOrder.push(`end:${name}`);
          resolve(`result:${name}`);
        }, delay);
      });

    // Sequential execution (simulating the for loop in handleToolRequest)
    const actions = ["read_file", "list_files", "run_command"];
    const results = [];
    for (const action of actions) {
      const result = await mockTool(action, 10);
      results.push(result);
    }

    // Validate strict sequential pattern: start:A, end:A, start:B, end:B, ...
    assert(executionOrder[0] === "start:read_file", "First tool starts first");
    assert(executionOrder[1] === "end:read_file", "First tool ends before second starts");
    assert(executionOrder[2] === "start:list_files", "Second tool starts after first ends");
    assert(executionOrder[3] === "end:list_files", "Second tool ends before third starts");
    assert(executionOrder[4] === "start:run_command", "Third tool starts after second ends");
    assert(executionOrder[5] === "end:run_command", "Third tool ends last");
  });

  await it("should NOT execute tools in parallel", async () => {
    const activeAt = [];

    const mockTool = (name, delay) =>
      new Promise((resolve) => {
        activeAt.push(name);
        setTimeout(() => {
          const peakConcurrency = activeAt.filter((n) => n !== null).length;
          activeAt[activeAt.indexOf(name)] = null;
          resolve(peakConcurrency);
        }, delay);
      });

    // Parallel execution (what we want to AVOID)
    const parallelResults = await Promise.all([
      mockTool("read_file", 20),
      mockTool("list_files", 20),
      mockTool("run_command", 20),
    ]);

    const maxConcurrencyParallel = Math.max(...parallelResults);

    // Reset for sequential test
    activeAt.length = 0;
    const seqResults = [];
    for (const name of ["read_file", "list_files", "run_command"]) {
      const r = await mockTool(name, 20);
      seqResults.push(r);
    }
    const maxConcurrencySequential = Math.max(...seqResults);

    assert(maxConcurrencyParallel > 1, "Parallel execution has concurrency > 1 (used as reference)");
    assert(maxConcurrencySequential === 1, "Sequential execution never has concurrency > 1");
  });
});

describe("Buffer Flushing Logic - All Tools Done Before Sending", async () => {
  await it("should only flush results to LLM when ALL tools in a batch are complete", async () => {
    const flushLog = [];

    const mockFlush = (results) => {
      flushLog.push({ event: "flush", resultsCount: results.length });
    };

    // Simulate: 3 tools, only flush when all 3 are done
    const toolResults = [];
    const totalTools = 3;

    for (let i = 0; i < totalTools; i++) {
      const result = await mockExecuteTool(`tool_${i}`, {}, 5);
      toolResults.push(result);

      // Only flush when all done
      if (toolResults.length === totalTools) {
        mockFlush(toolResults);
      }
    }

    assert(flushLog.length === 1, "Flush called exactly once (after all tools complete)");
    assert(flushLog[0].resultsCount === 3, "Flush receives all 3 tool results at once");
  });
});

describe("XML Tool Call Parser - Parsing Correctness", async () => {
  await it("should parse a well-formed XML tool call", async () => {
    const content = `Let me read the file.\n<read_file><file_path>README.md</file_path></read_file>`;
    const { actions } = parseAIResponse(content);
    assert(actions.length === 1, "One action parsed from well-formed XML");
    assert(actions[0].type === "read_file", "Correct tool type parsed");
    assert(actions[0].params.file_path === "README.md", "Correct file_path param parsed");
  });

  await it("should parse multiple XML tool calls", async () => {
    const content = `<read_file><file_path>a.ts</file_path></read_file>\n<list_files><path>src/</path></list_files>`;
    const { actions } = parseAIResponse(content);
    assert(actions.length === 2, "Two actions parsed from content with multiple XML tags");
    assert(actions[0].type === "read_file", "First action is read_file");
    assert(actions[1].type === "list_files", "Second action is list_files");
  });

  await it("should return empty actions for plain text response", async () => {
    const content = `The answer is 42. No tools needed here.`;
    const { actions } = parseAIResponse(content);
    assert(actions.length === 0, "No actions parsed from plain text response");
  });
});

// ============================================================
// Summary
// ============================================================

async function runAll() {
  for (const suite of suites) {
    console.log(`\n📦 ${suite.title}`);
    await suite.fn();
  }

  console.log("\n\n============================================================");
  console.log(`📊 Test Results: ${passCount}/${testCount} passed, ${failCount} failed`);
  console.log("============================================================\n");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
