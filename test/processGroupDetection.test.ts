/**
 * Test: Process Group Detection Algorithm
 *
 * Verifies the grouping logic from ChatBody/index.tsx that identifies
 * "process groups" — sequences of:
 *   assistant(tools) → user(uiHidden) → assistant(tools) → ... → assistant(markdown only)
 */

import * as assert from "assert";

// ── Replicate the grouping algorithm from ChatBody/index.tsx ──────────────────

interface MockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  uiHidden?: boolean;
}

interface MockParsed {
  id: string;
  parsed: { actions: any[] };
}

type RenderItem =
  | { kind: "single"; message: MockMessage; index: number }
  | { kind: "group"; messages: MockMessage[] };

function detectProcessGroups(
  visibleMessages: MockMessage[],
  parsedMessages: MockParsed[],
): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;

  while (i < visibleMessages.length) {
    const msg = visibleMessages[i];

    if (msg.role === "assistant") {
      const parsed = parsedMessages.find((pm) => pm.id === msg.id)?.parsed;
      const hasTools = (parsed?.actions?.length || 0) > 0;

      if (hasTools) {
        const groupMsgs: MockMessage[] = [msg];
        let j = i + 1;

        while (j < visibleMessages.length) {
          const next = visibleMessages[j];
          if (next.role === "user" && next.uiHidden) {
            groupMsgs.push(next);
            j++;
            continue;
          }
          if (next.role === "assistant") {
            const nextParsed = parsedMessages.find((pm) => pm.id === next.id)?.parsed;
            const nextHasTools = (nextParsed?.actions?.length || 0) > 0;
            groupMsgs.push(next);
            j++;
            if (!nextHasTools) break;
            continue;
          }
          break;
        }

        const assistantCount = groupMsgs.filter((m) => m.role === "assistant").length;
        if (assistantCount > 1) {
          items.push({ kind: "group", messages: groupMsgs });
          i = j;
          continue;
        }
      }
    }

    items.push({ kind: "single", message: msg, index: i });
    i++;
  }

  return items;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function msg(id: string, role: "user" | "assistant", hasTools: boolean, uiHidden = false): MockMessage {
  return { id, role, content: hasTools ? "<tool/>" : "markdown response", uiHidden };
}

function parsed(messages: MockMessage[]): MockParsed[] {
  return messages.map((m) => ({
    id: m.id,
    parsed: { actions: m.content.includes("<tool/>") ? [{}] : [] },
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Process Group Detection", () => {
  it("single assistant with tools — no group (no chain)", () => {
    const msgs = [msg("u1", "user", false), msg("a1", "assistant", true)];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].kind, "single");
    assert.strictEqual(result[1].kind, "single");
  });

  it("a(tools) → u(hidden) → a(markdown) — forms a group", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", true),
      msg("u2", "user", false, true), // uiHidden
      msg("a2", "assistant", false),  // markdown only
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].kind, "single");
    assert.strictEqual((result[0] as any).message.id, "u1");
    assert.strictEqual(result[1].kind, "group");
    assert.deepStrictEqual(
      (result[1] as any).messages.map((m: any) => m.id),
      ["a1", "u2", "a2"],
    );
  });

  it("3-step chain: a(tools)→u(hidden)→a(tools)→u(hidden)→a(markdown) — one group", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", true),
      msg("u2", "user", false, true),
      msg("a2", "assistant", true),
      msg("u3", "user", false, true),
      msg("a3", "assistant", false),
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].kind, "group");
    const groupMsgs = (result[1] as any).messages;
    assert.strictEqual(groupMsgs.length, 5); // a1, u2, a2, u3, a3
    assert.strictEqual(groupMsgs.filter((m: any) => m.role === "assistant").length, 3);
  });

  it("non-hidden user between assistants — no group", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", true),
      msg("u2", "user", false, false), // NOT hidden — manual user message
      msg("a2", "assistant", false),
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 4);
    result.forEach((r) => assert.strictEqual(r.kind, "single"));
  });

  it("two separate process groups in one conversation", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", true),
      msg("u2", "user", false, true),
      msg("a2", "assistant", false),   // end of group 1
      msg("u3", "user", false),
      msg("a3", "assistant", true),
      msg("u4", "user", false, true),
      msg("a4", "assistant", false),   // end of group 2
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 4); // u1, group1, u3, group2
    assert.strictEqual(result[0].kind, "single");
    assert.strictEqual(result[1].kind, "group");
    assert.strictEqual(result[2].kind, "single");
    assert.strictEqual(result[3].kind, "group");
  });

  it("chain ending with tools (task unfinished) — group still forms with tool-ending assistant", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", true),
      msg("u2", "user", false, true),
      msg("a2", "assistant", true), // still has tools, no markdown end
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    const group = result.find((r) => r.kind === "group");
    assert.ok(group, "Group should form (2 assistants)");
    const last = (group as any).messages[(group as any).messages.length - 1];
    assert.strictEqual(last.id, "a2");
  });

  it("user message followed by assistant with no tools — stays single", () => {
    const msgs = [
      msg("u1", "user", false),
      msg("a1", "assistant", false), // pure markdown, no tools
    ];
    const result = detectProcessGroups(msgs, parsed(msgs));

    assert.strictEqual(result.length, 2);
    result.forEach((r) => assert.strictEqual(r.kind, "single"));
  });
});
