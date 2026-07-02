// Debug backtick stack logic

const content = `<thinking>Test:
\`\`\`typescript
code with "</thinking>" inside
\`\`\`
Real end here</thinking>

<markdown>After thinking</markdown>`;

console.log('Content:');
console.log(content);
console.log('\n---\n');

// Simulate the logic
let i = 0;
const thinkingOpenTag = '<thinking>';
if (content.substring(i, i + thinkingOpenTag.length) === thinkingOpenTag) {
  let scanPos = i + thinkingOpenTag.length;
  const backtickStack = [];
  
  console.log('Starting scan from position:', scanPos);
  console.log('');
  
  while (scanPos < content.length) {
    if (content[scanPos] === '`') {
      let btCount = 0;
      let btPos = scanPos;
      while (btPos < content.length && content[btPos] === '`') {
        btCount++;
        btPos++;
      }
      
      console.log(`Found ${btCount} backticks at pos ${scanPos}`);
      
      // Try to close existing
      let found = false;
      for (let si = backtickStack.length - 1; si >= 0; si--) {
        if (backtickStack[si] === btCount) {
          console.log(`  -> Closing backtick context (count=${btCount})`);
          backtickStack.splice(si, 1);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`  -> Opening new backtick context (count=${btCount})`);
        backtickStack.push(btCount);
      }
      
      console.log(`  Stack after: [${backtickStack.join(', ')}]`);
      console.log('');
      
      scanPos = btPos;
      continue;
    }
    
    // Check for </thinking>
    if (backtickStack.length === 0 && content.substring(scanPos, scanPos + 12) === '</thinking>') {
      console.log(`Found </thinking> at pos ${scanPos} (stack empty - VALID)`);
      console.log('Thinking content:');
      console.log(content.substring(i + thinkingOpenTag.length, scanPos));
      break;
    }
    
    scanPos++;
  }
}
