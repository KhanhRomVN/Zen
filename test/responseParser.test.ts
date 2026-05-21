import * as assert from "assert";
import { parseAIResponse } from "../src/webview-ui/src/services/ResponseParser";

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
