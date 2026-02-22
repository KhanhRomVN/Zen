import * as assert from "assert";
import { EchoSuppressor, stripMarkers } from "../src/utils/terminalUtils";

describe("Terminal Filtering Tests", () => {
  describe("EchoSuppressor", () => {
    let suppressor: EchoSuppressor;

    beforeEach(() => {
      suppressor = new EchoSuppressor();
    });

    it("should suppress simple echo", () => {
      const wrapped = 'echo "ZEN_CMD_START: 1"; ls; echo "ZEN_CMD_END: 1"\n';
      const clean = "ls\n";
      suppressor.add(wrapped, clean);

      const output = suppressor.process(wrapped);
      assert.strictEqual(output, clean);
    });

    it("should handle prompt before wrapped command", () => {
      const wrapped =
        'echo "ZEN_CMD_START: 123"; ls; echo "ZEN_CMD_END: 123"\n';
      const clean = "ls\n";
      suppressor.add(wrapped, clean);

      const promptAndWrapped = "(base) user@host:~$ " + wrapped;
      const output = suppressor.process(promptAndWrapped);

      // Should keep the prompt but replace the wrapped command part
      assert.strictEqual(output, "(base) user@host:~$ " + clean);
    });

    it("should skip ANSI escape sequences during matching", () => {
      const wrapped = 'echo "START"; cmd; echo "END"\n';
      const clean = "cmd\n";
      suppressor.add(wrapped, clean);

      // Shell might add color to the echo'd command
      const colorWrapped = '\x1b[32mecho "START"; cmd; echo "END"\x1b[0m\n';
      const output = suppressor.process(colorWrapped);
      assert.strictEqual(output, clean);
    });

    it("should handle complex ANSI like bracketed paste", () => {
      const wrapped = "mycommand\n";
      const clean = "mycommand\n";
      suppressor.add(wrapped, clean);

      // \x1b[200~ is bracketed paste start
      const pasteWrapped = "\x1b[200~mycommand\x1b[201~\n";
      const output = suppressor.process(pasteWrapped);
      assert.strictEqual(output, clean);
    });

    it("should handle prompt with ANSI before wrapped command", () => {
      const wrapped = "ls\n";
      const clean = "ls\n";
      suppressor.add(wrapped, clean);

      const coloredPrompt = "\x1b[32muser@host\x1b[0m:~$ ";
      const output = suppressor.process(coloredPrompt + wrapped);

      assert.strictEqual(output, coloredPrompt + clean);
    });

    it("should substitute multiple commands in queue", () => {
      suppressor.add("first\n", "1st\n");
      suppressor.add("second\n", "2nd\n");

      assert.strictEqual(
        suppressor.process("first\nsecond\nthird\n"),
        "1st\n2nd\nthird\n",
      );
    });
  });

  describe("stripMarkers", () => {
    const actionId = "test-action-123";

    it("should strip plain markers", () => {
      const input = `\nZEN_CMD_START: ${actionId}\noutput text\nZEN_CMD_END: ${actionId}\n`;
      const expected = `\noutput text\n`;
      assert.strictEqual(stripMarkers(input, actionId), expected);
    });

    it("should strip colored markers", () => {
      const input = `\n\x1b[32mZEN_CMD_START: ${actionId}\x1b[0m\noutput text\n\x1b[31mZEN_CMD_END: ${actionId}\x1b[0m\n`;
      const expected = `\noutput text\n`;
      assert.strictEqual(stripMarkers(input, actionId), expected);
    });

    it("should handle markers at chunk start/end", () => {
      const inputStart = `ZEN_CMD_START: ${actionId}\nactual output`;
      assert.strictEqual(stripMarkers(inputStart, actionId), "actual output");

      const inputEnd = `actual output\nZEN_CMD_END: ${actionId}`;
      assert.strictEqual(stripMarkers(inputEnd, actionId), "actual output");
    });

    it("should NOT strip markers embedded in other text", () => {
      const input = `echo "ZEN_CMD_START: ${actionId}"`;
      assert.strictEqual(stripMarkers(input, actionId), input);
    });

    it("should handle markers with \r\n", () => {
      const input = `\r\nZEN_CMD_START: ${actionId}\r\noutput\r\nZEN_CMD_END: ${actionId}\r\n`;
      const expected = `\r\noutput\r\n`;
      assert.strictEqual(stripMarkers(input, actionId), expected);
    });
  });
});
