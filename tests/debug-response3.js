const content = `<thinking>Pass 1 (Plan):
- User wants to test \`<thinking>\` tag with backticks
- We need to handle: \`single\`, \`\`double\`\`, and \`\`\`triple\`\`\` backticks
- Also test with code blocks:
\`\`\`typescript
function example() {
  const tag = "<thinking>nested tag</thinking>";
  return tag;
}
\`\`\`
- Test inline code with tags: \`<markdown>\`, \`</code>\`, \`<file>\`
- Test escaped sequences: \\n, \\t, \\\`
- Test special chars: <>&"'
- Test Unicode: 你好, مرحبا, здравствуй, 🎉

Pass 2 (Verify):
- All backtick types preserved
- Code blocks intact
- No false tag detection
- Unicode handled correctly</thinking>

<markdown>**Test Result**: Parser correctly handles:
- Single backticks: \`code\`
- Code blocks:
\`\`\`javascript
const x = "<thinking>not a real tag</thinking>";
\`\`\`
- Mixed content with \`inline code\` and **bold** text
- Special characters: <div>, &amp;, "quotes"
- Emoji: 🚀 ✨ 💡</markdown>`;

// Find first </thinking> that's not in backticks
let scanPos = '<thinking>'.length;
const backtickStack = [];
let foundAt = -1;

while (scanPos < content.length) {
  // Skip escaped backticks (\`)
  if (scanPos > 0 && content[scanPos - 1] === '\\' && content[scanPos] === '`') {
    scanPos++;
    continue;
  }
  
  if (content[scanPos] === '`') {
    let btCount = 0;
    let btPos = scanPos;
    while (btPos < content.length && content[btPos] === '`') {
      btCount++;
      btPos++;
    }
    
    let found = false;
    for (let si = backtickStack.length - 1; si >= 0; si--) {
      if (backtickStack[si] === btCount) {
        backtickStack.splice(si, 1);
        found = true;
        break;
      }
    }
    
    if (!found) {
      backtickStack.push(btCount);
    }
    
    scanPos = btPos;
    continue;
  }
  
  if (backtickStack.length === 0 && content.substring(scanPos, scanPos + 11) === '</thinking>') {
    foundAt = scanPos;
    console.log('Found </thinking> at position:', scanPos);
    console.log('Context:', content.substring(Math.max(0, scanPos - 40), scanPos + 20));
    break;
  }
  
  scanPos++;
}

console.log('Scan completed. Position:', scanPos);
console.log('Content length:', content.length);
console.log('Final stack:', backtickStack);

if (foundAt === -1) {
  console.log('\n❌ ERROR: No </thinking> found outside backticks!');
  
  // Manual search for all </thinking>
  let idx = 0;
  console.log('\nAll </thinking> occurrences:');
  while ((idx = content.indexOf('</thinking>', idx)) !== -1) {
    console.log(`  Position ${idx}: ${content.substring(idx - 20, idx + 15)}`);
    idx++;
  }
} else {
  console.log('\n✅ SUCCESS! Detected correct </thinking> tag');
  console.log('Expected position: 575 (based on earlier analysis)');
  console.log('Actual position:', foundAt);
  console.log('Match:', foundAt === 575 ? '✅' : '❌');
}
