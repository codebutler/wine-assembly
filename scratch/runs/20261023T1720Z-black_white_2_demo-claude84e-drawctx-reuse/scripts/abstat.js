#!/usr/bin/env node
'use strict';
// tl;dr: per window of probe seconds, report draws (completed[5]), presents
// (completed[12]) and per-thread CPU deltas for one arm run folder.
// Probe samples come from the Artifacts dir named in probe.out; thread CPU
// from threadcpu.ndjson, aligned on wall time (started-at + probe seconds).
// Usage: abstat.js RUN_DIR [w0,w1,w2,...]   (default 600,900,1200,1500,1800)
const fs = require('fs'), path = require('path');
const [run, edgesArg = '600,900,1200,1500,1800'] = process.argv.slice(2);
const edges = edgesArg.split(',').map(Number);
const out = fs.readFileSync(path.join(run, 'probe.out'), 'utf8').split('\n');
const art = /Artifacts: (\S+)/.exec(out[0])[1];
let lines = [];
const samplesFile = fs.existsSync(path.join(art, 'samples.ndjson')) ? path.join(art, 'samples.ndjson') : null;
for (const l of (samplesFile ? fs.readFileSync(samplesFile, 'utf8') : out.slice(1).join('\n')).split('\n')) {
  if (!l.startsWith('{"seconds"')) continue;
  try { lines.push(JSON.parse(l)); } catch {}
}
const t0 = Date.parse(fs.readFileSync(path.join(run, 'started-at.txt'), 'utf8').trim()) / 1000;
// Two arms in one tree share a cwd, so the sampler logs both; cli.pid names ours.
const cliPid = fs.existsSync(path.join(run, 'cli.pid')) ? Number(fs.readFileSync(path.join(run, 'cli.pid'), 'utf8')) : null;
const cpu = fs.readFileSync(path.join(run, 'threadcpu.ndjson'), 'utf8').trim().split('\n').map(l => JSON.parse(l))
  .filter(x => cliPid == null || x.pid === cliPid);
// The probe starts the CLI a moment after started-at; wall offset is small vs 30 s sampling.
const at = s => {
  let best = null;
  for (const x of lines) if (x.seconds <= s) best = x;
  return best;
};
const cpuAt = wall => {
  let best = null;
  for (const x of cpu) if (x.t <= wall) best = x;
  return best;
};
const threadSum = (snap) => {
  const m = {};
  for (const th of snap.threads) m[th.tid] = { comm: th.comm, cpu: th.utime + th.stime, u: th.utime };
  return m;
};
const rows = [];
for (let i = 0; i + 1 < edges.length; i++) {
  const a = at(edges[i]), b = at(edges[i + 1]);
  if (!a || !b || b.seconds < edges[i + 1] - 10) { rows.push({ win: `${edges[i]}-${edges[i + 1]}`, note: 'no data' }); continue; }
  const ca = cpuAt(t0 + a.seconds), cb = cpuAt(t0 + b.seconds);
  const draws = (b.probe.completed[5] || 0) - (a.probe.completed[5] || 0);
  const pres = (b.probe.completed[12] || 0) - (a.probe.completed[12] || 0);
  const dt = b.seconds - a.seconds;
  const ta = threadSum(ca), tb = threadSum(cb);
  const per = Object.entries(tb).map(([tid, v]) => ({ tid, comm: v.comm, cpu: v.cpu - (ta[tid]?.cpu || 0) }))
    .sort((x, y) => y.cpu - x.cpu);
  const total = per.reduce((s, x) => s + x.cpu, 0);
  // Node 20 leaves every thread named "node": main is tid == pid, the render
  // worker is the busiest other thread.
  const main = per.find(x => +x.tid === cb.pid);
  const worker = per.find(x => +x.tid !== cb.pid);
  rows.push({
    win: `${edges[i]}-${edges[i + 1]}`, dt: +dt.toFixed(1), draws, presents: pres,
    drawsPerS: +(draws / dt).toFixed(2), fps: +(pres / dt).toFixed(4),
    workerCpuS: +worker.cpu.toFixed(1), workerComm: worker.comm, mainCpuS: +(main?.cpu || 0).toFixed(1), totalCpuS: +total.toFixed(1),
    workerMsPerDraw: +(1000 * worker.cpu / draws).toFixed(2), totalMsPerDraw: +(1000 * total / draws).toFixed(2),
    failed: b.probe.failed,
    top: per.slice(0, 4).map(x => `${x.tid}:${x.cpu.toFixed(1)}`).join(' '),
  });
}
console.log(JSON.stringify({ run, art, last: lines.at(-1)?.seconds, rows }, null, 1));
