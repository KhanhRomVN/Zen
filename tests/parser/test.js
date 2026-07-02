/**
 * Direct test of findClosingTagPosition logic
 * This replicates the EXACT algorithm from TagClosingFinder.ts
 */

function findClosingTagPosition(content, startPos, closingTag) {
  let scanPos = startPos;
  
  const backtickStack = [];
  
  let inLineComment = false;
  let inBlockComment = false;
  let inHtmlComment = false;
  let inSingleQuoteString = false;
  let inDoubleQuoteString = false;
  
  while (scanPos < content.length) {
    const char = content[scanPos];
    const prevChar = scanPos > 0 ? content[scanPos - 1] : '';
    const nextChar = scanPos < content.length - 1 ? content[scanPos + 1] : '';
    
    const isEscaped = prevChar === '\\';
    
    // Handle line comment end (newline)
    if (inLineComment && char === '\n') {
      inLineComment = false;
      scanPos++;
      continue;
    }
    
    // Handle block comment end
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      scanPos += 2;
      continue;
    }
    
    // Handle HTML comment end
    if (inHtmlComment && char === '-' && content.substring(scanPos, scanPos + 3) === '-->') {
      inHtmlComment = false;
      scanPos += 3;
      continue;
    }
    
    // If we're in any comment, skip everything
    if (inLineComment || inBlockComment || inHtmlComment) {
      scanPos++;
      continue;
    }
    
    // Handle string contexts (only when not in comment)
    if (inSingleQuoteString) {
      if (char === "'" && !isEscaped) {
        inSingleQuoteString = false;
      }
      scanPos++;
      continue;
    }
    
    if (inDoubleQuoteString) {
      if (char === '"' && !isEscaped) {
        inDoubleQuoteString = false;
      }
      scanPos++;
      continue;
    }
    
    // Check for comment starts (only when not in string or backtick)
    if (backtickStack.length === 0) {
      // Line comment
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        scanPos += 2;
        continue;
      }
      
      // Block comment
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        scanPos += 2;
        continue;
      }
      
      // HTML comment
      if (char === '<' && content.substring(scanPos, scanPos + 4) === '<!--') {
        inHtmlComment = true;
        scanPos += 4;
        continue;
      }
      
      // String start
      if (char === "'" && !isEscaped) {
        inSingleQuoteString = true;
        scanPos++;
        continue;
      }
      
      if (char === '"' && !isEscaped) {
        inDoubleQuoteString = true;
        scanPos++;
        continue;
      }
    }
    
    // Skip escaped backticks
    if (isEscaped && char === '`') {
      scanPos++;
      continue;
    }
    
    // Check for backtick sequences
    if (char === '`') {
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
    
    // Only check for closing tag when NOT in any special context
    if (
      backtickStack.length === 0 &&
      !inLineComment &&
      !inBlockComment &&
      !inHtmlComment &&
      !inSingleQuoteString &&
      !inDoubleQuoteString
    ) {
      if (content.substring(scanPos, scanPos + closingTag.length).toLowerCase() === closingTag.toLowerCase()) {
        return scanPos;
      }
    }
    
    scanPos++;
  }
  
  return -1;
}

console.log('🧪 Testing findClosingTagPosition\n');
console.log('='.repeat(80));

// Test 1: Simple case
const test1 = '<write_to_file><content>Hello</content></write_to_file>';
const result1 = findClosingTagPosition(test1, test1.indexOf('<content>') + 9, '</write_to_file>');
console.log('\n✅ Test 1: Simple case');
console.log(`   Expected: Find real tag at end`);
console.log(`   Result: ${result1 !== -1 ? 'PASS' : 'FAIL'} (found at ${result1})`);

// Test 2: Fake in line comment
const test2 = `<write_to_file><content>
// Fake: </write_to_file>
real code
</content></write_to_file>`;
const start2 = test2.indexOf('<content>') + 9;
const result2 = findClosingTagPosition(test2, start2, '</write_to_file>');
const expected2 = test2.lastIndexOf('</write_to_file>');
console.log('\n✅ Test 2: Fake in line comment');
console.log(`   Fake at: ${test2.indexOf('</write_to_file>', start2)}`);
console.log(`   Real at: ${expected2}`);
console.log(`   Result: ${result2 === expected2 ? 'PASS ✅' : 'FAIL ❌'} (found at ${result2})`);

// Test 3: Fake in block comment
const test3 = `<write_to_file><content>
/* Fake: </write_to_file> */
real code
</content></write_to_file>`;
const start3 = test3.indexOf('<content>') + 9;
const result3 = findClosingTagPosition(test3, start3, '</write_to_file>');
const expected3 = test3.lastIndexOf('</write_to_file>');
console.log('\n✅ Test 3: Fake in block comment');
console.log(`   Fake at: ${test3.indexOf('</write_to_file>', start3)}`);
console.log(`   Real at: ${expected3}`);
console.log(`   Result: ${result3 === expected3 ? 'PASS ✅' : 'FAIL ❌'} (found at ${result3})`);

// Test 4: Fake in template literal
const test4 = `<write_to_file><content>
const x = \`Fake: </write_to_file>\`;
real code
</content></write_to_file>`;
const start4 = test4.indexOf('<content>') + 9;
const result4 = findClosingTagPosition(test4, start4, '</write_to_file>');
const expected4 = test4.lastIndexOf('</write_to_file>');
console.log('\n✅ Test 4: Fake in template literal');
console.log(`   Fake at: ${test4.indexOf('</write_to_file>', start4)}`);
console.log(`   Real at: ${expected4}`);
console.log(`   Result: ${result4 === expected4 ? 'PASS ✅' : 'FAIL ❌'} (found at ${result4})`);

// Test 5: Fake in string
const test5 = `<write_to_file><content>
const x = '</write_to_file>';
real code
</content></write_to_file>`;
const start5 = test5.indexOf('<content>') + 9;
const result5 = findClosingTagPosition(test5, start5, '</write_to_file>');
const expected5 = test5.lastIndexOf('</write_to_file>');
console.log('\n✅ Test 5: Fake in single quote string');
console.log(`   Fake at: ${test5.indexOf('</write_to_file>', start5)}`);
console.log(`   Real at: ${expected5}`);
console.log(`   Result: ${result5 === expected5 ? 'PASS ✅' : 'FAIL ❌'} (found at ${result5})`);

// Test 6: Multiple fakes
const test6 = `<write_to_file><content>
// Fake 1: </write_to_file>
/* Fake 2: </write_to_file> */
const x = \`Fake 3: </write_to_file>\`;
const y = '</write_to_file>';
real code
</content></write_to_file>`;
const start6 = test6.indexOf('<content>') + 9;
const result6 = findClosingTagPosition(test6, start6, '</write_to_file>');
const expected6 = test6.lastIndexOf('</write_to_file>');
const fakeCount = (test6.match(/<\/write_to_file>/g) || []).length - 1;
console.log('\n✅ Test 6: Multiple fakes (4 fake + 1 real)');
console.log(`   Real at: ${expected6}`);
console.log(`   Result: ${result6 === expected6 ? 'PASS ✅' : 'FAIL ❌'} (found at ${result6})`);
console.log(`   Skipped: ${fakeCount} fake tags`);

console.log('\n' + '='.repeat(80));
const allPass = result1 !== -1 && result2 === expected2 && result3 === expected3 && 
                result4 === expected4 && result5 === expected5 && result6 === expected6;
if (allPass) {
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('\n✅ findClosingTagPosition correctly:');
  console.log('   - Ignores fake tags in line comments');
  console.log('   - Ignores fake tags in block comments');
  console.log('   - Ignores fake tags in template literals');
  console.log('   - Ignores fake tags in strings');
  console.log('   - Finds only the REAL closing tag');
} else {
  console.log('\n❌ SOME TESTS FAILED');
}
console.log('='.repeat(80));
