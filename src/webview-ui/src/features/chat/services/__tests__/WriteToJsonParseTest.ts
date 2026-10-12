import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import { parseAIResponse } from '../ResponseParser';

/**
 * Test tái hiện lỗi parse WriteToFile từ response mẫu.
 * Chạy: npx tsx src/webview-ui/src/features/chat/services/__tests__/WriteToJsonParseTest.ts
 */
const main = () => {
  // __dirname = <root>/src/webview-ui/src/features/chat/services/__tests__
  // tests/response.txt lives at <root>/tests/response.txt → go up 7 levels
  const responsePath = path.resolve(__dirname, '../../../../../../../tests/response.txt');
  
  if (!fs.existsSync(responsePath)) {
    console.error(`❌ Không tìm thấy file: ${responsePath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(responsePath, 'utf-8');
  console.log('📄 Loaded response.txt:', rawContent.length, 'chars');

  // Thử parse trực tiếp từng khối ```json ... ``` thủ công để cô lập vấn đề
  const jsonBlocks = [...rawContent.matchAll(/```json\s*\n?([\s\S]*?)```/g)];
  console.log(`\n🔍 Found ${jsonBlocks.length} fenced JSON blocks`);

  for (let i = 0; i < jsonBlocks.length; i++) {
    const block = jsonBlocks[i];
    const body = block[1].trim();
    
    console.log(`\n--- Block ${i + 1} ---`);
    console.log('Raw length:', body.length);
    
    try {
      const parsed = JSON.parse(body);
      console.log('✅ JSON.parse OK');
      console.log('Keys:', Object.keys(parsed));
      
      if (parsed.tool === 'write_to_file') {
        console.log('   file_path:', parsed.params.file_path?.substring(0, 50) + '...');
        console.log('   content length:', parsed.params.content?.length);
        
        // Kiểm tra content có chứa backtick không escaped gây hỏng JSON không?
        const hasUnescapedBacktick = /(?<!\\)`/.test(JSON.stringify(parsed.params.content));
        console.log('   Has unescaped backticks in stringify?', hasUnescapedBacktick);
      }
      
      if (parsed.type === 'markdown') {
        console.log('   Markdown content:', parsed.content.substring(0, 60) + '...');
      }
    } catch (err: any) {
      console.log('❌ JSON.parse FAILED:', err.message);
      // In ra vị trí lỗi
      const match = err.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1], 10);
        console.log('   Error near char', pos, ':', 
          JSON.stringify(body.substring(Math.max(0, pos - 30), pos + 30)));
      }
    }
  }

  // Bây giờ chạy qua parser chính thức với toolFormat='json'
  console.log('\n\n=== Running official parseAIResponse with toolFormat=json ===');
  try {
    const result = parseAIResponse(rawContent, 'json');
    console.log('Actions found:', result.actions.length);
    console.log('ContentBlocks found:', result.contentBlocks.length);
    
    for (const action of result.actions) {
      console.log(`  Action type=${action.type}, isError=${!!action.isError}`);
      if (action.type === 'write_to_file') {
        const p = action.params as any;
        console.log(`    file_path="${p.file_path}"`);
        console.log(`    content length=${p.content?.length ?? 'N/A'}`);
        if (p.errorMessage) {
          console.log(`    ERROR MSG: ${p.errorMessage}`);
        }
      }
    }
    
    for (const cb of result.contentBlocks) {
      console.log(`  Block type=${cb.type}`, 
        cb.type === 'code' ? `(language=${(cb as any).language})` : '',
        cb.type === 'markdown' ? `(len=${(cb as any).content?.length})` : '');
    }
    
    // Nếu write_to_file bị fallback thành code/markdown thì đây là bug
    const wtfAction = result.actions.find(a => a.type === 'write_to_file');
    const codeFallback = result.contentBlocks.filter(cb => cb.type === 'code');
    
    if (!wtfAction && codeFallback.length > 0) {
      console.log('\n🐛 BUG CONFIRMED: write_to_file fell back to code block!');
      console.log('   Code blocks received:', codeFallback.map(c => (c as any).content?.substring(0, 80)));
    } else if (wtfAction) {
      console.log('\n✅ write_to_file parsed successfully as tool action.');
    }
    
  } catch (err) {
    console.error('💥 Parser threw exception:', err);
  }
};

main();