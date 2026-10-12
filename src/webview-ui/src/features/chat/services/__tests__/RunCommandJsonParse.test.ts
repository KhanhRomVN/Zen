/**
 * Test run_command parsing through JSON fence path after the balanced-fence fix.
 * Verifies that multi-line commands with special chars are preserved intact.
 *
 * Chạy: npx tsx src/webview-ui/src/features/chat/services/__tests__/RunCommandJsonParse.test.ts
 */
import { parseAIResponse } from '../ResponseParser';

const main = () => {
  // Simulate a realistic AI response containing a run_command tool call
  // with a multi-line python -c script that includes quotes, newlines, and backticks
  const sampleResponse = [
    'Tôi sẽ chạy lệnh phân tích file.',
    '',
    '```json',
    '{"tool":"run_command","params":{"command":"cd /home/user/project && python3 -c \\"\\nimport re, sys\\n\\nwith open(\\\'tests/response.txt\\\', \\\'r\\\') as f:\\n    content = f.read()\\n\\npositions = [m.start() for m in re.finditer(r\\\'\\\\\\\\`\\\\\\\\`\\\\\\\\`\\\', content)]\\nprint(f\\\'Total triple-backtick occurrences: {len(positions)}\\\')\\n\\""}}',
    '```',
    '',
    'Đây là kết quả:',
  ].join('\n');

  console.log('=== Sample response length:', sampleResponse.length, 'chars ===\n');

  const result = parseAIResponse(sampleResponse, 'json');

  console.log('Actions found:', result.actions.length);
  console.log('ContentBlocks found:', result.contentBlocks.length);

  for (const action of result.actions) {
    console.log(`\nAction type=${action.type}, isError=${!!action.isError}`);
    if (action.type === 'run_command') {
      const cmd = (action.params as any).command;
      console.log('Command length:', cmd?.length);
      console.log('Command preview (first 200 chars):');
      console.log(cmd?.substring(0, 200));
      console.log('...');
      console.log('Command tail (last 100 chars):');
      console.log(cmd?.slice(-100));

      // Verify key substrings survived
      const checks = [
        ['contains cd', cmd.includes('cd /home/user/project')],
        ['contains python3 -c', cmd.includes('python3 -c')],
        ['contains import re', cmd.includes('import re, sys')],
        ['contains triple-backtick regex', cmd.includes('\\\\`\\\\`\\\\`') || cmd.includes('\\`\\`\\`')],
        ['contains print statement', cmd.includes('print(f')],
        ['no truncation at start', !cmd.startsWith('\n') && !cmd.startsWith(' ')],
      ];

      console.log('\nIntegrity checks:');
      let allPass = true;
      for (const [name, pass] of checks) {
        console.log(`  ${pass ? '✅' : '❌'} ${name}`);
        if (!pass) allPass = false;
      }

      if (!allPass) {
        console.log('\n🐛 BUG: run_command was truncated or corrupted during JSON parse!');
        process.exit(1);
      } else {
        console.log('\n✅ run_command parsed correctly through JSON fence path.');
      }
    }
  }

  // Also verify no unexpected code-block fallback happened
  const codeBlocks = result.contentBlocks.filter(b => b.type === 'code');
  if (codeBlocks.length > 0) {
    console.log('\n⚠️ Unexpected code blocks found:', codeBlocks.map(c => (c as any).content?.substring(0, 80)));
  }
};

main();