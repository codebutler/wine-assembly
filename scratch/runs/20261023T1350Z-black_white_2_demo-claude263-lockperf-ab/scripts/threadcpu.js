#!/usr/bin/env node
'use strict';
// tl;dr: every N seconds, append one NDJSON line with per-thread user/sys CPU
// (clock ticks from /proc/PID/task/TID/stat) for every node process whose
// cmdline contains test/run.js under REPO. Exits when no such process is left
// after it has seen one. Usage: threadcpu.js REPO OUT.ndjson [interval_s]
const fs = require('fs');
const [repo, out, every = '30'] = process.argv.slice(2);
const hz = 100;
let seen = false;
function pids() {
  const r = [];
  for (const p of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(p)) continue;
    try {
      const cmd = fs.readFileSync(`/proc/${p}/cmdline`, 'utf8').split('\0');
      if (!cmd.includes('test/run.js')) continue;
      if (fs.readlinkSync(`/proc/${p}/cwd`) !== repo) continue;
      r.push(Number(p));
    } catch {}
  }
  return r;
}
function sample() {
  const list = pids();
  if (!list.length) { if (seen) process.exit(0); return; }
  seen = true;
  const t = Date.now() / 1000;
  for (const pid of list) {
    const threads = [];
    try {
      for (const tid of fs.readdirSync(`/proc/${pid}/task`)) {
        try {
          const s = fs.readFileSync(`/proc/${pid}/task/${tid}/stat`, 'utf8');
          const comm = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
          const f = s.slice(s.lastIndexOf(')') + 2).split(' ');
          threads.push({ tid: +tid, comm, utime: +f[11] / hz, stime: +f[12] / hz });
        } catch {}
      }
    } catch { continue; }
    fs.appendFileSync(out, JSON.stringify({ t, pid, threads }) + '\n');
  }
}
sample();
setInterval(sample, Number(every) * 1000);
