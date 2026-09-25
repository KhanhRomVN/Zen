#!/usr/bin/env node
/**
 * pack.mjs — Tạo file zip toàn bộ project (AIWeb2API + Zen).
 *
 * Logic exclude (4 lớp):
 *   1. Parse AIWeb2API/.gitignore + Zen/.gitignore
 *   2. Filter nâng cao: .git/, ts-reap/, *.zip, ...
 *   3. Exclude extension binary/media: *.vsix, *.exe, *.mp3, *.blend, ...
 *   4. Exclude file có size > MAX_FILE_SIZE_MB (mặc định 5MB)
 *
 * Cách dùng:
 *   node scripts/pack.mjs                   → AIWeb2API-Zen_<timestamp>.zip ở root
 *   node scripts/pack.mjs my-release.zip    → tên tuỳ chọn
 *   MAX_FILE_SIZE_MB=10 node scripts/pack.mjs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

// ── Đường dẫn ────────────────────────────────────────────────────────────────
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ZEN_DIR   = resolve(__dirname, '..');         // Zen/
const ROOT_DIR  = resolve(ZEN_DIR, '..');           // AIWeb2API & Zen/

// ── Config ───────────────────────────────────────────────────────────────────
const timestamp      = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');
const outputName     = process.argv[2] || `AIWeb2API-Zen_${timestamp}.zip`;
const outputPath     = join(ROOT_DIR, outputName);
const maxFileSizeMB  = Number(process.env.MAX_FILE_SIZE_MB ?? 5);
const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

// ── Lớp 1: Parse .gitignore → danh sách patterns ────────────────────────────
function parseGitignore(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('!'))
    .map(l => l.replace(/\/$/, '')); // bỏ trailing slash
}

const gitignorePatterns = [
  ...parseGitignore(join(ROOT_DIR, 'AIWeb2API', '.gitignore')),
  ...parseGitignore(join(ZEN_DIR, '.gitignore')),
];

// ── Lớp 3: Extension binary/media ────────────────────────────────────────────
const BINARY_EXTENSIONS = new Set([
  // VS Code
  '.vsix',
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.bin', '.out',
  // Archives
  '.tar', '.gz', '.tgz', '.bz2', '.rar', '.7z', '.zip',
  // Design/3D
  '.psd', '.ai', '.sketch', '.fig', '.blend', '.blend1',
  '.fbx', '.obj', '.gltf', '.glb', '.unity', '.unitypackage',
  // Video
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  // Audio
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
  // DB
  '.db', '.sqlite', '.sqlite3',
  // Native
  '.node', '.jar', '.class', '.war', '.pyc', '.pyo', '.pyd',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

// ── Lớp 2: Thư mục/file hardcode cần bỏ luôn ────────────────────────────────
const ALWAYS_EXCLUDE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', '.tsup', 'dist-bin',
  'ts-reap', '.git_disabled', 'chatgpt2api', 'temp', 'tmp',
  'coverage', '.nyc_output', '.cache', 'src/scratch',
  'test-results', 'playwright-report',
  join('src', 'webview-ui', 'public', 'vs'),
]);

const ALWAYS_EXCLUDE_NAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  '.env', '.env.local', '.DS_Store', 'Thumbs.db',
  'bypass_test.log',
]);

// ── Kiểm tra 1 path có bị exclude không ─────────────────────────────────────
function shouldExclude(absPath) {
  const rel = relative(ROOT_DIR, absPath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const name  = parts[parts.length - 1];

  // Self (file zip output)
  if (absPath === outputPath) return true;

  // Tên file/folder hardcode
  if (ALWAYS_EXCLUDE_NAMES.has(name)) return true;

  // Thư mục hardcode (kiểm tra mọi segment và sub-path)
  for (const part of parts) {
    if (ALWAYS_EXCLUDE_DIRS.has(part)) return true;
  }
  // Sub-path style vd: "src/scratch"
  for (const excl of ALWAYS_EXCLUDE_DIRS) {
    if (rel === excl || rel.startsWith(excl + '/')) return true;
  }

  // Extension binary
  const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
  if (BINARY_EXTENSIONS.has(ext)) return true;

  // .gitignore patterns (đơn giản: so sánh tên / path segment)
  for (const pattern of gitignorePatterns) {
    // Pattern dạng glob đơn giản: chỉ xử lý *.ext và tên cố định
    if (pattern.startsWith('*.')) {
      if (name.endsWith(pattern.slice(1))) return true;
    } else if (pattern.includes('/')) {
      if (rel === pattern || rel.startsWith(pattern + '/')) return true;
    } else {
      if (name === pattern || parts.includes(pattern)) return true;
    }
  }

  return false;
}

// ── Lớp 4: Collect tất cả file cần đưa vào zip ───────────────────────────────
const filesToInclude = [];
const largeFilesSkipped = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const absPath = join(dir, entry.name);

    if (shouldExclude(absPath)) continue;

    if (entry.isDirectory()) {
      walk(absPath);
    } else if (entry.isFile()) {
      try {
        const size = statSync(absPath).size;
        if (size > maxFileSizeBytes) {
          const mb = (size / 1024 / 1024).toFixed(1);
          largeFilesSkipped.push(`  ⚠️  ${relative(ROOT_DIR, absPath)} (${mb}MB)`);
        } else {
          filesToInclude.push(relative(ROOT_DIR, absPath));
        }
      } catch {
        filesToInclude.push(relative(ROOT_DIR, absPath));
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`🔍 Scanning for files > ${maxFileSizeMB}MB...`);
walk(ROOT_DIR);

if (largeFilesSkipped.length > 0) {
  console.log('   Excluding large files:');
  largeFilesSkipped.forEach(f => console.log(f));
} else {
  console.log('   None found.');
}

console.log(`\n📦 Packing project...`);
console.log(`   Root  : ${ROOT_DIR}`);
console.log(`   Output: ${outputPath}`);
console.log(`   Files : ${filesToInclude.length}`);
console.log('');

// Ghi danh sách file vào stdin của zip qua -@ (tránh "too many arguments")
const fileList = filesToInclude.join('\n');
try {
  execSync(`zip "${outputPath}" -@`, {
    cwd: ROOT_DIR,
    input: fileList,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (err) {
  console.error('❌ zip failed:', err.stderr?.toString() || err.message);
  process.exit(1);
}

if (existsSync(outputPath)) {
  const sizeMB = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`✅ Done: ${outputName} (${sizeMB}MB)`);
} else {
  console.error('❌ Output file not found after zip.');
  process.exit(1);
}
