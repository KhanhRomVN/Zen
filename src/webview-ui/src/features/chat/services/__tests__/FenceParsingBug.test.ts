/**
 * Test tái hiện bug: fenced JSON parser bị break khi content chứa triple-backtick.
 * 
 * Chạy: npx tsx src/webview-ui/src/features/chat/services/__tests__/FenceParsingBug.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Simulate the buggy fence regex ──────────────────────────────────────
const BUGGY_FENCE_REGEX = /```json\s*\n?([\s\S]*?)```/g;

// ─── Proposed fix: balanced-fence-aware scanner ──────────────────────────
/**
 * Scan for ```json ... ``` blocks while respecting that triple-backticks
 * INSIDE a JSON string are escaped or part of content and should NOT close
 * the fence. Strategy: after finding an opening ```json, track whether we're
 * inside a JSON string (between unescaped quotes), and only treat ``` as a
 * closing delimiter when we're OUTSIDE any string context.
 */
function findJsonFences(content: string): Array<{ start: number; end: number; body: string }> {
  const results: Array<{ start: number; end: number; body: string }> = [];
  let pos = 0;

  while (pos < content.length) {
    // Find next ```json
    const openIdx = content.indexOf('```json', pos);
    if (openIdx === -1) break;

    // Content starts after the newline following ```json
    const nlAfterOpen = content.indexOf('\n', openIdx);
    const bodyStart = nlAfterOpen !== -1 ? nlAfterOpen + 1 : openIdx + 7;

    // Now scan forward character-by-character tracking JSON string state
    let inString = false;
    let escape = false;
    let i = bodyStart;

    while (i < content.length) {
      const ch = content[i];

      if (escape) {
        escape = false;
        i++;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        i++;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        i++;
        continue;
      }

      // Only look for closing ``` when NOT inside a JSON string
      if (!inString && ch === '`' && content.slice(i, i + 3) === '```') {
        const bodyEnd = i;
        const fenceEnd = i + 3;
        results.push({
          start: openIdx,
          end: fenceEnd,
          body: content.slice(bodyStart, bodyEnd),
        });
        pos = fenceEnd;
        break;
      }

      i++;
    }

    // If we ran off the end without finding a valid closer, skip past this opener
    if (i >= content.length) {
      pos = openIdx + 7;
    }
  }

  return results;
}

// ─── Run tests ───────────────────────────────────────────────────────────
const main = () => {
  const rootDir = path.resolve(__dirname, '../../../../../../..');
  const responsePath = path.join(rootDir, 'tests/response.txt');

  if (!fs.existsSync(responsePath)) {
    console.error(`❌ File not found: ${responsePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(responsePath, 'utf-8');
  console.log(`📄 Loaded ${raw.length} chars\n`);

  // ── Test 1: Buggy regex ──
  console.log('═══ TEST 1: Current (buggy) fence regex ═══');
  const buggyMatches = [...raw.matchAll(BUGGY_FENCE_REGEX)];
  console.log(`Found ${buggyMatches.length} matches:`);
  for (let i = 0; i < buggyMatches.length; i++) {
    const m = buggyMatches[i];
    const body = m[1].trim();
    console.log(`\n  Match #${i + 1}: body length=${body.length}`);
    try {
      const parsed = JSON.parse(body);
      console.log(`    ✅ JSON.parse OK — keys: ${Object.keys(parsed).join(', ')}`);
      if (parsed.tool === 'write_to_file') {
        console.log(`    ⚠️ This IS write_to_file but truncated!`);
        console.log(`    content ends at char ~${body.length} of expected ~12k+`);
      }
    } catch (e: any) {
      console.log(`    ❌ JSON.parse FAILED: ${e.message}`);
    }
  }

  // ── Test 2: Fixed scanner ──
  console.log('\n\n═══ TEST 2: Fixed balanced-fence scanner ═══');
  const fixedResults = findJsonFences(raw);
  console.log(`Found ${fixedResults.length} fences:`);
  for (let i = 0; i < fixedResults.length; i++) {
    const r = fixedResults[i];
    const body = r.body.trim();
    console.log(`\n  Fence #${i + 1}: range=[${r.start}..${r.end}], body length=${body.length}`);
    try {
      const parsed = JSON.parse(body);
      console.log(`    ✅ JSON.parse OK — keys: ${Object.keys(parsed).join(', ')}`);
      if (parsed.tool === 'write_to_file') {
        console.log(`    file_path: ${parsed.params.file_path}`);
        console.log(`    content length: ${parsed.params.content?.length} chars`);
        console.log(`    content ends with: ...${parsed.params.content?.slice(-40)}`);
        
        // Verify the content actually contains the triple-backtick sequences
        const tick3 = String.fromCharCode(96, 96, 96);
        const needle = "'" + tick3 + "'";
        const hasTripleTick = parsed.params.content?.includes(needle);
        console.log('    Contains triple-backtick literal in source:', hasTripleTick);
      }
      if (parsed.type === 'markdown') {
        console.log(`    Markdown: "${parsed.content.substring(0, 60)}..."`);
      }
    } catch (e: any) {
      console.log(`    ❌ JSON.parse FAILED: ${e.message}`);
    }
  }

  // ── Summary ──
  console.log('\n\n═══ SUMMARY ═══');
  const buggyWtfOk = buggyMatches.some(m => {
    try { return JSON.parse(m[1].trim())?.tool === 'write_to_file'; } catch { return false; }
  });
  const fixedWtfOk = fixedResults.some(r => {
    try { return JSON.parse(r.body.trim())?.tool === 'write_to_file'; } catch { return false; }
  });
  
  console.log(`Buggy regex parses write_to_file correctly: ${buggyWtfOk ? '✅' : '❌ NO — falls back to code block'}`);
  console.log(`Fixed scanner parses write_to_file correctly: ${fixedWtfOk ? '✅ YES' : '❌ NO'}`);
};

main();