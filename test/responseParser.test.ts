import * as assert from "assert";
import { parseAIResponse } from "../src/webview-ui/src/services/ResponseParser";

const WRITE_TO_FILE_RESPONSE = `\`\`\`
<thinking>
Pass 1 (Plan):
- Import đã đúng: \`import { ConfirmSwitchDrawer } from './components/Sidebar/Target/ConfirmSwitchDrawer';\`
- Vấn đề nằm ở file \`ConfirmSwitchDrawer.tsx\` bị lỗi cú pháp (diagnostics báo "const declarations must be initialized")
- Cần sửa lại file ConfirmSwitchDrawer.tsx để đảm bảo cú pháp đúng

Pass 2 (Verify):
- Đọc lại nội dung file hiện tại
</thinking>

<write_to_file>
<file_path>src/renderer/src/features/Tool/components/Sidebar/Target/ConfirmSwitchDrawer.tsx</file_path>
<content>import React from 'react';
import { X, AlertTriangle, Square } from 'lucide-react';

interface ConfirmSwitchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentAppName: string;
  newAppName: string;
}

export const ConfirmSwitchDrawer: React.FC<ConfirmSwitchDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentAppName,
  newAppName,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <div className="absolute inset-0 bg-black/40 z-40" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 z-50 bg-dialog-background border-t border-divider rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ maxHeight: '80%' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-divider flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-9 h-10 rounded-lg bg-red-500/15 border border-red-500/25 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary">Switch Target</h3>
            <p className="text-xs text-text-secondary mt-0.5">Confirm session change</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-secondary text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-text-primary mb-2">
                A session is currently active with:
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-semibold text-emerald-400">{currentAppName}</span>
              </div>
              <p className="text-sm text-text-primary mb-3">
                Switching to <span className="font-bold text-primary">{newAppName}</span> will:
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <Square className="w-3.5 h-3.5 text-red-400" />
                  Stop the current tracking session
                </li>
                <li className="flex items-center gap-2">
                  <Square className="w-3.5 h-3.5 text-red-400" />
                  Clear all captured requests
                </li>
                <li className="flex items-center gap-2">
                  <Square className="w-3.5 h-3.5 text-red-400" />
                  Close any associated browser/application
                </li>
              </ul>
            </div>
            <p className="text-xs text-text-secondary text-center">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-divider flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-sidebar-itemHover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all flex items-center gap-2"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop & Switch
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmSwitchDrawer;
</content>
</write_to_file>
\`\`\``;

describe("ResponseParser - write_to_file with thinking block", () => {
  it("should parse thinking block and write_to_file action from code-fenced response", () => {
    const parsed = parseAIResponse(WRITE_TO_FILE_RESPONSE);

    // Should have a write_to_file action
    const writeAction = parsed.actions.find((a) => a.type === "write_to_file");
    assert.ok(writeAction, "Should have a write_to_file action");
    assert.strictEqual(
      writeAction!.params.file_path,
      "src/renderer/src/features/Tool/components/Sidebar/Target/ConfirmSwitchDrawer.tsx"
    );
    assert.ok(
      writeAction!.params.content && writeAction!.params.content.length > 0,
      "content should not be empty"
    );
    assert.ok(
      writeAction!.params.content.includes("ConfirmSwitchDrawer"),
      "content should include component code"
    );
  });

  it("should parse thinking block as a thinking content block", () => {
    const parsed = parseAIResponse(WRITE_TO_FILE_RESPONSE);

    const thinkingBlock = parsed.contentBlocks.find((b) => b.type === "thinking");
    assert.ok(thinkingBlock, "Should have a thinking content block");
    assert.ok(
      (thinkingBlock as any).content.includes("Pass 1"),
      "thinking content should include planning text"
    );
  });
});

describe("ResponseParser - Malformed XML Tool Calls", () => {
  it("should handle malformed XML tag where the closing tag is missing the opening angle bracket", () => {
    const malformedResponse = `Tôi sẽ scan codebase để phân tích các phương án cải thiện cho coding tasks.

<list_files>
<folder_path>src</folder_path>
</list_files>
<search_files>
<folder_path>src</folder_path>
<regex>class.*Provider|interface.*Provider</regex>
</search_files>
<search_files>
<folder_path>src/folder_path>
<regex>completion|suggestion|autocomplete</regex>
</search_files>
<search_files>
<folder_path>src</folder_path>
<regex>refactor|code.*action|quick.*fix</regex>
</search_files>`;

    const parsed = parseAIResponse(malformedResponse);

    // Verify all actions are parsed
    assert.strictEqual(parsed.actions.length, 4);

    // First action: list_files
    assert.strictEqual(parsed.actions[0].type, "list_files");
    assert.strictEqual(parsed.actions[0].params.folder_path, "src");

    // Second action: search_files (correct)
    assert.strictEqual(parsed.actions[1].type, "search_files");
    assert.strictEqual(parsed.actions[1].params.folder_path, "src");

    // Third action: search_files (with malformed folder_path closing tag: src/folder_path>)
    assert.strictEqual(parsed.actions[2].type, "search_files");
    // We expect the parser to correctly strip the malformed closing tag and trim it
    assert.strictEqual(parsed.actions[2].params.folder_path, "src");
    assert.strictEqual(parsed.actions[2].params.regex, "completion|suggestion|autocomplete");

    // Fourth action: search_files (correct)
    assert.strictEqual(parsed.actions[3].type, "search_files");
    assert.strictEqual(parsed.actions[3].params.folder_path, "src");
  });
});
