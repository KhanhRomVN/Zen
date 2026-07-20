/**
 * Simple Parser Test
 * 
 * Chạy: bash tests/run-tests.sh
 */

const { readFileSync } = require('fs');
const { join } = require('path');

// Load test response from text file
const testResponse = readFileSync(join(__dirname, 'test-response.txt'), 'utf-8');

// Mock browser globals for Node.js environment
global.window = {
  localStorage: {
    getItem: () => null,
  },
};
global.document = {
  createElement: (tag) => {
    if (tag === 'textarea') {
      return {
        innerHTML: '',
        value: '',
      };
    }
    return {};
  },
};

// Import parser
let parseAIResponse;

try {
  const parser = require('../out/src/webview-ui/src/services/ResponseParser');
  parseAIResponse = parser.parseAIResponse;
  console.log('✅ Loaded parser successfully\n');
} catch (error) {
  console.error('❌ Cannot load parser:', error.message);
  process.exit(1);
}

// Chạy test
console.log('═'.repeat(80));
console.log('TESTING AI RESPONSE PARSER');
console.log('═'.repeat(80));

console.log('\n📝 Input Response:');
console.log('─'.repeat(80));
console.log(testResponse.trim());
console.log('─'.repeat(80));

try {
  const result = parseAIResponse(testResponse);
  
  console.log('\n📊 Parsed Result:');
  console.log('─'.repeat(80));
  
  console.log(`\nTotal Actions: ${result.actions.length}`);
  console.log(`Content Blocks: ${result.contentBlocks.length}`);
  
  if (result.actions.length > 0) {
    console.log('\n🔧 Actions:');
    result.actions.forEach((action, idx) => {
      const status = action.isError ? '❌' : '✅';
      console.log(`\n  ${idx + 1}. ${status} ${action.type}`);
      
      // Print params
      Object.entries(action.params).forEach(([key, value]) => {
        const preview = typeof value === 'string' && value.length > 100
          ? value.substring(0, 100) + '...'
          : value;
        console.log(`     ${key}: ${JSON.stringify(preview)}`);
      });
      
      // Print error if exists
      if (action.isError) {
        console.log(`     ⚠️  Error Code: ${action.errorCode}`);
        console.log(`     ⚠️  Message: ${action.errorMessage}`);
      }
    });
  }
  
  console.log('\n' + '═'.repeat(80));
  
  // Summary
  const errorActions = result.actions.filter((a) => a.isError);
  const validActions = result.actions.filter((a) => !a.isError);
  
  console.log('\n📈 Summary:');
  console.log(`   Valid Actions: ${validActions.length}`);
  console.log(`   Error Actions: ${errorActions.length}`);
  
  if (errorActions.length > 0) {
    console.log('\n❌ Errors Found:');
    errorActions.forEach((action, idx) => {
      console.log(`   ${idx + 1}. [${action.errorCode}] ${action.type}`);
      console.log(`      ${action.errorMessage}`);
    });
    console.log('\n⚠️  Test completed with errors.');
    process.exit(1);
  } else {
    console.log('\n✅ All actions parsed successfully!');
    process.exit(0);
  }
  
} catch (error) {
  console.error('\n❌ Parser Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
