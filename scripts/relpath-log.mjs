import readline from "node:readline";
import path from "node:path";

const workspaceRoot = process.cwd();
const workspaceRootNormalized = workspaceRoot.replaceAll("\\", "/");

const extraPrefixes = process.argv
  .slice(2)
  .map((p) => path.resolve(workspaceRoot, p).replaceAll("\\", "/"));

function relativize(line) {
  let out = line;

  // Replace the workspace root path first.
  out = out.split(workspaceRootNormalized + "/").join("");
  out = out.split(workspaceRootNormalized).join(".");

  // Replace any extra prefixes (e.g. src/webview-ui) if provided.
  for (const prefix of extraPrefixes) {
    out = out.split(prefix + "/").join("");
    out = out.split(prefix).join(".");
  }

  return out;
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  process.stdout.write(relativize(line) + "\n");
});

