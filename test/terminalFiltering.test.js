"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const terminalUtils_1 = require("../src/utils/terminalUtils");
describe("Terminal Filtering Tests", () => {
    describe("EchoSuppressor", () => {
        let suppressor;
        beforeEach(() => {
            suppressor = new terminalUtils_1.EchoSuppressor();
        });
        it("should suppress simple echo", () => {
            const wrapped = 'echo "ZEN_CMD_START: 1"; ls; echo "ZEN_CMD_END: 1"\n';
            const clean = "ls\n";
            suppressor.add(wrapped, clean);
            const output = suppressor.process(wrapped + "file1.txt\n");
            assert.strictEqual(output, clean + "file1.txt\n");
        });
        it("should handle partial chunks", () => {
            const wrapped = 'echo "ZEN_CMD_START: 2"; pwd; echo "ZEN_CMD_END: 2"\n';
            const clean = "pwd\n";
            suppressor.add(wrapped, clean);
            const chunk1 = wrapped.substring(0, 10);
            const chunk2 = wrapped.substring(10);
            assert.strictEqual(suppressor.process(chunk1), "");
            assert.strictEqual(suppressor.process(chunk2), clean);
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
        it("should substitute multiple commands in queue", () => {
            suppressor.add("first\n", "1st\n");
            suppressor.add("second\n", "2nd\n");
            assert.strictEqual(suppressor.process("first\nsecond\nthird\n"), "1st\n2nd\nthird\n");
        });
    });
    describe("stripMarkers", () => {
        const actionId = "test-action-123";
        it("should strip plain markers", () => {
            const input = `\nZEN_CMD_START: ${actionId}\noutput text\nZEN_CMD_END: ${actionId}\n`;
            const expected = `\noutput text\n`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(input, actionId), expected);
        });
        it("should strip colored markers", () => {
            const input = `\n\x1b[32mZEN_CMD_START: ${actionId}\x1b[0m\noutput text\n\x1b[31mZEN_CMD_END: ${actionId}\x1b[0m\n`;
            const expected = `\noutput text\n`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(input, actionId), expected);
        });
        it("should handle markers at chunk start/end", () => {
            const inputStart = `ZEN_CMD_START: ${actionId}\nactual output`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(inputStart, actionId), "actual output");
            const inputEnd = `actual output\nZEN_CMD_END: ${actionId}`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(inputEnd, actionId), "actual output");
        });
        it("should NOT strip markers embedded in other text", () => {
            const input = `echo "ZEN_CMD_START: ${actionId}"`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(input, actionId), input);
        });
        it("should handle markers with \r\n", () => {
            const input = `\r\nZEN_CMD_START: ${actionId}\r\noutput\r\nZEN_CMD_END: ${actionId}\r\n`;
            const expected = `\r\noutput\r\n`;
            assert.strictEqual((0, terminalUtils_1.stripMarkers)(input, actionId), expected);
        });
    });
});
//# sourceMappingURL=terminalFiltering.test.js.map