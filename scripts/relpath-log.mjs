#!/usr/bin/env node

/**
 * relpath-log.mjs
 * Đọc log từ stdin và chuyển đư���ng dẫn tuyệt đối của project
 * thành đường dẫn tương đối để dễ đọc.
 */

import readline from "node:readline";

const PROJECT_ROOT = process.cwd();
const PROJECT_ROOT_ESCAPED = PROJECT_ROOT.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  const relativeLine = line.replace(new RegExp(PROJECT_ROOT_ESCAPED, "g"), ".");
  process.stdout.write(relativeLine + "\n");
});

rl.on("close", () => {
  process.exit(0);
});
