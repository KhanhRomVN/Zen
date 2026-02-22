const fs = require('fs');
const os = require('os');

function checkBusy(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const lastParenIdx = stat.lastIndexOf(')');
    const remaining = stat.substring(lastParenIdx + 2).split(' ');
    
    const state = remaining[0];
    const pgrp = parseInt(remaining[2]);
    const tpgid = parseInt(remaining[5]);
    
    console.log(`PID: ${pid}, State: ${state}, PGRP: ${pgrp}, TPGID: ${tpgid}, Busy: ${tpgid !== -1 && tpgid !== pgrp}`);
    return tpgid !== -1 && tpgid !== pgrp;
  } catch (e) {
    console.error(e);
  }
}

const pid = process.argv[2];
if (!pid) {
  console.log("Usage: node debug_busy.js <pid>");
  process.exit(1);
}

setInterval(() => checkBusy(pid), 500);
