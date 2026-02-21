const fs = require('fs');
const ansiPattern = [
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><;]))",
].join("|");
const regex = new RegExp(ansiPattern, "g");

function stripAnsi(str) {
  let cleaned = str.replace(regex, "");
  cleaned = cleaned.replace(/\x1b\[\?2004[hl]/g, "");
  cleaned = cleaned.replace(/\x1b\]0;.*?\x07/g, "");
  cleaned = cleaned.replace(/\x1b\]0;.*?\x1b\\/g, "");
  
  const lines = cleaned.split("\n");
  const processedLines = lines.map((line) => {
    let processed = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!processed.includes("\r")) return processed;
    const parts = processed.split("\r");
    let lineResult = "";
    for (const part of parts) {
      lineResult = part + lineResult.slice(part.length);
    }
    return lineResult;
  });
  return processedLines.join("\n");
}

console.log(stripAnsi('\x1b]0;khanhromvn@UbuntuLTS: ~/Downloads/voice-chat\x07\x1b[?2004h(base) khanhromvn@UbuntuLTS:~/Downloads/voice-chat$ sleep 5 && echo "Hello world!"\r\n\x1b[?2004l\r\nHello world!\r\n\x1b]0;khanhromvn@UbuntuLTS: ~/Downloads/voice-chat\x07\x1b[?2004h(base) khanhromvn@UbuntuLTS:~/Downloads/voice-chat$ '));
