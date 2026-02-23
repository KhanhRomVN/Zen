import * as assert from "assert";
import { EchoSuppressor, stripMarkers } from "../src/utils/terminalUtils";

describe("Bulk Terminal Execution Tests - Multi-Command Reuse", () => {
  let suppressor: EchoSuppressor;
  const prompt = "(base) user@host:~/Entropy$ ";

  beforeEach(() => {
    suppressor = new EchoSuppressor();
  });

  /**
   * REPRODUCE ISSUE 1: Missing Command/Prompt in LLM Context
   * Scenario: Run first command, then run second command on same terminal.
   */
  it("should preserve prompt and command when using smarter extraction (Fixed Logic)", () => {
    const actionId1 = "id-1";
    const cmd1 = 'echo "Hello world!"';
    const wrapped1 = `stty -echo; echo "ZEN_CMD_START: ${actionId1}"; ${cmd1}; echo "ZEN_CMD_END: ${actionId1}"; stty echo\n`;

    // Simulation of ProcessManager.sendInput logic
    suppressor.add(wrapped1, cmd1 + "\n");
    suppressor.add(wrapped1, cmd1 + "\n");

    // Simulated output from terminal bridge
    const rawOutput1 =
      prompt +
      wrapped1 +
      "Hello world!\r\n" +
      "ZEN_CMD_END: " +
      actionId1 +
      "\r\n" +
      prompt;

    // Process via suppressor (for TerminalBlock UI)
    const uiOutput1 = suppressor.process(rawOutput1);

    // Fixed Extraction Logic (using stripMarkers instead of aggressive substring)
    const llmOutput1 = stripMarkers(uiOutput1, actionId1);

    assert.ok(llmOutput1.includes(prompt), "Command 1: Should contain prompt");
    assert.ok(
      llmOutput1.includes(cmd1),
      "Command 1: Should contain command echo",
    );

    // --- SECOND COMMAND ON SAME TERMINAL ---
    const actionId2 = "id-2";
    const cmd2 = 'echo "Goodbye!"';
    const wrapped2 = `stty -echo; echo "ZEN_CMD_START: ${actionId2}"; ${cmd2}; echo "ZEN_CMD_END: ${actionId2}"; stty echo\n`;

    suppressor.add(wrapped2, cmd2 + "\n");
    suppressor.add(wrapped2, cmd2 + "\n");

    // Simulation of actual terminal output
    const rawOutput2 =
      prompt +
      wrapped2 +
      "Goodbye!\r\n" +
      "ZEN_CMD_END: " +
      actionId2 +
      "\r\n" +
      prompt;

    const uiOutput2 = suppressor.process(rawOutput2);
    const llmOutput2 = stripMarkers(uiOutput2, actionId2);

    console.log("Fixed LLM Output 2:", JSON.stringify(llmOutput2));

    // SUCCESS: Now LLM receives EVERYTHING except the markers.
    assert.ok(llmOutput2.includes(prompt), "Command 2: Should preserve prompt");
    assert.ok(
      llmOutput2.includes(cmd2),
      "Command 2: Should preserve command echo",
    );
    assert.ok(
      !llmOutput2.includes("ZEN_CMD_START"),
      "Command 2: Markers should be gone",
    );
  });

  /**
   * PROPOSED FIX 1: Use regex-based stripMarkers instead of aggressive substring
   */
  it("should preserve prompt and command when using regex stripMarkers (Fixed Logic)", () => {
    const actionId = "id-fixed";
    const cmd = 'echo "Goodbye!"';
    const wrapped = `stty -echo; echo "ZEN_CMD_START: ${actionId}"; ${cmd}; echo "ZEN_CMD_END: ${actionId}"; stty echo\n`;

    // Simulating UI output where EchoSuppressor failed OR markers are present
    const uiOutput =
      prompt +
      wrapped +
      "Goodbye!\r\n" +
      "ZEN_CMD_END: " +
      actionId +
      "\r\n" +
      prompt;

    // Instead of aggressive substring, we use the regex-based stripMarkers (already in project)
    const fixedLlmOutput = stripMarkers(uiOutput, actionId);

    console.log("Fixed LLM Output:", JSON.stringify(fixedLlmOutput));

    assert.ok(fixedLlmOutput.includes(prompt), "FIXED: Should preserve prompt");
    assert.ok(
      fixedLlmOutput.includes(cmd),
      "FIXED: Should preserve command echo",
    );
    assert.ok(
      !fixedLlmOutput.includes("ZEN_CMD_START"),
      "FIXED: Should strip markers",
    );
  });

  /**
   * PROPOSED FIX 2: Check for existing prompt before injecting manual one
   */
  it("should avoid double prompt when checking existing prompt (Fixed Logic)", () => {
    const actionId = "id-123";
    const cmd = 'echo "test"';
    const wrapped = `stty -echo; echo "ZEN_CMD_START: ${actionId}"; ${cmd}; echo "ZEN_CMD_END: ${actionId}"; stty echo\n`;

    suppressor.add(wrapped, cmd + "\n");
    suppressor.add(wrapped, cmd + "\n");

    const rawOutput =
      prompt +
      wrapped +
      "test\r\n" +
      "ZEN_CMD_END: " +
      actionId +
      "\r\n" +
      prompt;
    const uiOutput = suppressor.process(rawOutput);

    // FIXED Logic in ProcessManager:
    const promptPrefix = prompt.trim();
    let finalOutput;
    // Check if the output already ends with the prompt (considering possible trailing whitespace/newlines)
    const cleanOutputEnding = uiOutput.trim();
    if (cleanOutputEnding.endsWith(promptPrefix)) {
      finalOutput = uiOutput; // Don't add if it's already there!
    } else {
      finalOutput = uiOutput + "\n\n" + promptPrefix;
    }

    console.log("Fixed UI Output:", JSON.stringify(finalOutput));

    assert.ok(
      finalOutput.split(promptPrefix).length === 3,
      "FIXED: Should have exactly 2 prompts (one before, one after command)",
    );
    assert.ok(
      !finalOutput.endsWith(promptPrefix + "\n\n" + promptPrefix),
      "FIXED: No doubled prompt at end",
    );
  });
});
