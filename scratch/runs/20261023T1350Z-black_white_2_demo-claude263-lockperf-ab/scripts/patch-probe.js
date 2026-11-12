#!/usr/bin/env node
'use strict';
// tl;dr: boat-only diagnostic. Let PROBE_NODE_ARGS put node flags (e.g.
// --cpu-prof) in front of test/run.js in the probe's child spawn, since
// --cpu-prof is refused in NODE_OPTIONS. Usage: patch-probe.js TREE...
const fs = require('fs');
for (const tree of process.argv.slice(2)) {
  const f = `${tree}/tools/black-white-software-probe.js`;
  const s = fs.readFileSync(f, 'utf8');
  const from = "spawn(process.execPath,['test/run.js',...flags]";
  const to = "spawn(process.execPath,[...(process.env.PROBE_NODE_ARGS||'').split(' ').filter(Boolean),'test/run.js',...flags]";
  if (s.includes(to)) { console.log('already', f); continue; }
  if (!s.includes(from)) throw Error('spawn line not found in ' + f);
  fs.writeFileSync(f, s.replace(from, to));
  console.log('patched', f);
}
