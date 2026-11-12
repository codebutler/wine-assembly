#!/usr/bin/env node
'use strict';
// tl;dr: summarize one .cpuprofile over a time window (seconds from profile
// start): total sampled time, top self-time functions, and inclusive time of
// every function whose name matches a pattern (a sample counts once if any
// frame on its stack matches). Usage:
//   profsum.js FILE [from_s] [to_s] [pattern] [topN]
const fs = require('fs');
const [file, from = '0', to = '1e9', pat = 'lock_|w2g|virtual_|heap_', topN = '25'] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(), parent = new Map();
for (const n of p.nodes) { byId.set(n.id, n); for (const c of n.children || []) parent.set(c, n.id); }
const name = n => n.callFrame.functionName || `(anon ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber})`;
const re = new RegExp(pat);
// STACKS=regex: also aggregate 6-frame leaf-upward chains of samples whose leaf matches.
const stackRe = process.env.STACKS ? new RegExp(process.env.STACKS) : null;
const chains = new Map();
const self = new Map(), incl = new Map();
let t = p.startTime, total = 0;
const lo = p.startTime + Number(from) * 1e6, hi = p.startTime + Number(to) * 1e6;
for (let i = 0; i < p.samples.length; i++) {
  t += p.timeDeltas[i];
  if (t < lo || t > hi) continue;
  const dt = (p.timeDeltas[i + 1] ?? 0);
  const n = byId.get(p.samples[i]);
  const nm = name(n);
  if (nm === '(idle)' || nm === '(program)' && false) {}
  total += dt;
  self.set(nm, (self.get(nm) || 0) + dt);
  if (stackRe && stackRe.test(nm)) {
    const c = [];
    for (let id = n.id; id != null && c.length < 6; id = parent.get(id)) c.push(name(byId.get(id)));
    const k = c.join(' < ');
    chains.set(k, (chains.get(k) || 0) + dt);
  }
  const seen = new Set();
  for (let id = n.id; id != null; id = parent.get(id)) {
    const s = name(byId.get(id));
    if (re.test(s) && !seen.has(s)) { seen.add(s); incl.set(s, (incl.get(s) || 0) + dt); }
  }
}
const fmt = us => `${(us / 1e6).toFixed(2)}s ${(100 * us / total).toFixed(2)}%`;
console.log(`${file}\nwindow ${from}-${to}s  sampled ${(total / 1e6).toFixed(1)}s  duration ${((p.endTime - p.startTime) / 1e6).toFixed(0)}s`);
console.log('-- top self');
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(topN))) console.log(fmt(v).padEnd(18), k);
console.log(`-- inclusive /${pat}/`);
for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, Number(topN))) console.log(fmt(v).padEnd(18), k);
if (stackRe) {
  console.log(`-- leaf chains /${process.env.STACKS}/`);
  for (const [k, v] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, Number(topN))) console.log(fmt(v).padEnd(18), k);
}
