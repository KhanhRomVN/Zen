const fs = require("fs");
const path = require("path");

const targetDir = path.resolve(__dirname, "src/webview-ui/src");
const excludes = [
  path.join(targetDir, "types/css.d.ts"),
  path.join(targetDir, "types/window.d.ts"),
  path.join(targetDir, "types/storage.d.ts"),
].map((p) => path.normalize(p));

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(fullPath);
    } else if (entry.isFile()) {
      const normalizedPath = path.normalize(fullPath);
      if (excludes.includes(normalizedPath)) {
        continue;
      }
      if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.ts.map")) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error(`Failed to delete ${fullPath}:`, err.message);
        }
      }
    }
  }
}

// Support running in watch mode if arguments contains 'watch'
if (process.argv.includes("watch")) {
  console.log("Watching for .d.ts and .d.ts.map changes (polling every 2s)...");
  setInterval(() => {
    cleanDir(targetDir);
  }, 2000);
} else {
  console.log("Cleaning .d.ts and .d.ts.map files...");
  cleanDir(targetDir);
  console.log("Clean complete.");
}
