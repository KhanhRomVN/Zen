import * as assert from "assert";
import { EchoSuppressor, stripMarkers } from "../src/utils/terminalUtils";

describe("Consolidated Terminal Filtering Tests", () => {
  describe("EchoSuppressor", () => {
    let suppressor: EchoSuppressor;

    beforeEach(() => {
      suppressor = new EchoSuppressor();
    });

    it("should suppress simple echo", () => {
      const wrapped = 'echo "ZEN_CMD_START: 1"; ls; echo "ZEN_CMD_END: 1"\n';
      const clean = "ls\n";
      suppressor.add(wrapped, clean);
      assert.strictEqual(suppressor.process(wrapped), clean);
    });

    it("should handle prompt before wrapped command", () => {
      const wrapped =
        'echo "ZEN_CMD_START: 123"; ls; echo "ZEN_CMD_END: 123"\n';
      const clean = "ls\n";
      const prompt = "(base) user@host:~$ ";
      suppressor.add(wrapped, clean);
      assert.strictEqual(suppressor.process(prompt + wrapped), prompt + clean);
    });

    it("should skip ANSI escape sequences during matching", () => {
      const wrapped = 'echo "START"; cmd; echo "END"\n';
      const clean = "cmd\n";
      suppressor.add(wrapped, clean);
      const colorWrapped = '\x1b[32mecho "START"; cmd; echo "END"\x1b[0m\n';
      assert.strictEqual(suppressor.process(colorWrapped), clean);
    });

    it("should handle complex ANSI like bracketed paste", () => {
      const wrapped = "mycommand\n";
      const clean = "mycommand\n";
      suppressor.add(wrapped, clean);
      const pasteWrapped = "\x1b[200~mycommand\x1b[201~\n";
      assert.strictEqual(suppressor.process(pasteWrapped), clean);
    });

    it("should handle multi-command sequence (Double Echo)", () => {
      const actionId = "msg-123";
      const cleanCmd = 'echo "Hello world!"';
      const wrappedCmd = `stty -echo; echo "ZEN_CMD_START: ${actionId}"; ${cleanCmd}; echo "ZEN_CMD_END: ${actionId}"; stty echo\n`;
      const expectedClean = cleanCmd + "\n";
      const prompt = "(base) user@host:~$ ";

      suppressor.add(wrappedCmd, expectedClean); // First echo
      suppressor.add(wrappedCmd, expectedClean); // Second echo (with prompt)

      assert.strictEqual(suppressor.process(wrappedCmd), expectedClean);
      assert.strictEqual(
        suppressor.process(prompt + wrappedCmd),
        prompt + expectedClean,
      );
    });

    it("should handle multiple items in queue with intervening output", () => {
      suppressor.add("first\n", "1st\n");
      suppressor.add("second\n", "2nd\n");

      // The loop should handle finding both if they appear in one chunk
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

    it("should handle markers mashed with prompts and control characters", () => {
      // \x1b[?2004l is bracketed paste mode reset, often sent by shell before prompt
      const mashedInput = `\x1b[?2004l\rZEN_CMD_START: ${actionId}\n`;
      assert.strictEqual(stripMarkers(mashedInput, actionId), "");
    });

    it("should handle markers prefixed by OSC sequences (e.g. title updates)", () => {
      const oscPrefix = `\x1b]0;user@host: ~\x07`;
      const input = `${oscPrefix}ZEN_CMD_START: ${actionId}\n`;
      // We expect the whole marker line to be gone, potentially leaving OSC if it was a separate "unit"
      // but usually OSC+Marker is one shell output unit.
      assert.strictEqual(stripMarkers(input, actionId), "");
    });

    it("should handle markers at chunk start/end", () => {
      assert.strictEqual(
        stripMarkers(`ZEN_CMD_START: ${actionId}\nactual output`, actionId),
        "actual output",
      );
      assert.strictEqual(
        stripMarkers(`actual output\nZEN_CMD_END: ${actionId}`, actionId),
        "actual output",
      );
    });

    it("should NOT strip markers embedded in other text", () => {
      const input = `echo "ZEN_CMD_START: ${actionId}"`;
      assert.strictEqual(stripMarkers(input, actionId), input);
    });

    it("should handle markers with \r\n and whitespace preservation", () => {
      const input = `\r\nZEN_CMD_START: ${actionId}\r\noutput\r\nZEN_CMD_END: ${actionId}\r\n`;
      const expected = `\r\noutput\r\n`;
      assert.strictEqual(stripMarkers(input, actionId), expected);
    });

    it("should handle fragmented markers (Echo separated from Marker)", () => {
      const chunk1 = `echo "ZEN_CMD_START: ${actionId}"; `;
      const chunk2 = `ls\nZEN_CMD_START: ${actionId}\n`;

      // Ideally chunk1 stripped should remove the echo residue
      // but since it doesn't have the marker yet, it might remain.
      // However, if we know the actionId, we can look for "echo ... actionId"
      assert.strictEqual(stripMarkers(chunk1, actionId), "");
      assert.strictEqual(stripMarkers(chunk2, actionId), "ls\n");
    });
  });
});
