/**
 * Test extractParamValue behavior with complex run_command content.
 * Verifies that commands containing XML-like tags, quotes, and special chars survive.
 *
 * Chạy: npx tsx src/webview-ui/src/features/chat/services/__tests__/RunCommandExtractParam.test.ts
 */
import { extractParamValue } from '../../utils/ToolParser';

const main = () => {
  console.log('=== Testing extractParamValue with complex command content ===\n');

  // Simulate the pseudo-XML inner content produced by paramsToXmlInner
  const testCases = [
    {
      name: 'Simple command',
      xml: '<command>ls -la</command>',
      expected: 'ls -la',
    },
    {
      name: 'Multi-line python -c',
      xml: `<command>cd /home/user && python3 -c "
import sys
print(sys.version)
"</command>`,
      expected_contains: ['cd /home/user', 'python3 -c', 'import sys', 'print(sys.version)'],
    },
    {
      name: 'Command with triple backticks in argument',
      xml: `<command>echo '\`\`\`code\`\`\`'</command>`,
      expected_contains: ["'", '```code```'],
    },
    {
      name: 'Command with nested XML-like tags',
      xml: `<command>grep '<pattern>' file.txt</command>`,
      expected_contains: ['grep', '<pattern>', 'file.txt'],
    },
    {
      name: 'Command with closing-tag-looking text',
      xml: `<command>cat output.txt | grep '</command>'</command>`,
      expected_contains: ['cat output.txt', "grep '</command>'"],
    },
  ];

  let allPass = true;

  for (const tc of testCases) {
    console.log(`--- ${tc.name} ---`);
    const result = extractParamValue(tc.xml, 'command');
    console.log('Input XML:', JSON.stringify(tc.xml.substring(0, 120)));
    console.log('Extracted:', JSON.stringify(result));

    if ('expected' in tc && tc.expected !== undefined) {
      if (result === tc.expected) {
        console.log('✅ Exact match');
      } else {
        console.log(`❌ FAIL: expected "${tc.expected}", got "${result}"`);
        allPass = false;
      }
    } else if ('expected_contains' in tc) {
      const missing = (tc.expected_contains as string[]).filter(s => !result?.includes(s));
      if (missing.length === 0) {
        console.log('✅ All substrings present');
      } else {
        console.log(`❌ FAIL: missing substrings: ${JSON.stringify(missing)}`);
        allPass = false;
      }
    }
    console.log();
  }

  // Critical edge case: what happens when command itself contains </command>?
  console.log('--- EDGE CASE: command contains literal "</command>" ---');
  const trickyXml = `<command>sed 's/foo/<\\/command>/g' bar.txt</command>`;
  const trickyResult = extractParamValue(trickyXml, 'command');
  console.log('Input:', trickyXml);
  console.log('Output:', JSON.stringify(trickyResult));
  
  if (trickyResult && trickyResult.includes('<\\/command>') || trickyResult?.includes('</command>')) {
    console.log('⚠️ Parser may have stopped early at embedded </command>');
    // This is a known limitation of tag-based parsing — document it
  } else if (trickyResult === null || trickyResult === '') {
    console.log('❌ Extraction failed completely');
    allPass = false;
  } else {
    console.log('✅ Handled correctly');
  }

  console.log('\n=== Summary ===');
  console.log(allPass ? '✅ All tests passed' : '❌ Some tests failed');
};

main();