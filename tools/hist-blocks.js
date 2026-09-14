// Shared block attribution for browser handler-histogram JSON.
//
// A page probe can read the hot-block counters but cannot say which DLL block
// 0x00a983a5 is in -- `wine.moduleBases` gives the load bases and the PE's own
// preferred base, and turning one into `jgl.dll+0x100153a5` is this file.
// tools/browser-handler-hist.js and tools/hot-loop-census.js both need it, so
// it lives here rather than being written twice and drifting.

'use strict';

// `wine.moduleBases` stores each DLL under both its bare name and its .dll
// name; one entry per distinct base, or every row is printed twice.
function moduleList(hist, exeBase) {
  const mods = [];
  const seen = new Set();
  for (const [name, pair] of Object.entries(hist.mods || {})) {
    const [base, origBase] = pair;
    if (!base || seen.has(base)) continue;
    seen.add(base);
    mods.push({ name: name.includes('.') ? name : name + '.dll', base, origBase });
  }
  mods.push({ name: 'exe', base: exeBase, origBase: exeBase });
  mods.sort((a, b) => a.base - b.base);
  return mods;
}

// Highest base at or below the address wins, which is why the list is sorted.
function makeAttributor(hist, exeBase) {
  const mods = moduleList(hist, exeBase);
  return (addr) => {
    let hit = null;
    for (const m of mods) { if (addr >= m.base) hit = m; else break; }
    if (!hit) return { name: '?', va: addr };
    return { name: hit.name, va: (addr - hit.base + hit.origBase) >>> 0 };
  };
}

// [{ addr, hits, mod, va }] for every block the probe returned.
function attributeBlocks(hist, exeBase) {
  const attribute = makeAttributor(hist, exeBase);
  return (hist.blocks || []).map(([hex, hits]) => {
    const addr = parseInt(hex, 16) >>> 0;
    const a = attribute(addr);
    return { addr, hits, mod: a.name, va: a.va };
  });
}

// profile-web-frames.js prints the probe's JSON as one `report-eval: {...}`
// line inside its own log, so the natural thing to do -- redirect the whole
// run to a file -- produces something that is not JSON. Accept both, rather
// than making every caller remember to filter the log first.
function readHist(file) {
  const text = require('fs').readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (err) {
    const line = text.split('\n').find(l => l.startsWith('report-eval: '));
    if (!line) {
      throw new Error(`${file} is neither probe JSON nor a profile-web-frames ` +
        `log carrying a "report-eval:" line (${err.message})`);
    }
    return JSON.parse(line.slice('report-eval: '.length));
  }
}

// Handler names come from the `(elem ...)` list in src/02-thread-table.wat, so
// they cannot drift from a renumber. Lived in browser-handler-hist.js until
// tools/ctl-hist-series.js needed the same mapping; this file is the one that
// exists so block/handler attribution is not written twice.
function handlerNames() {
  const fs = require('fs');
  const path = require('path');
  const names = [];
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', '02-thread-table.wat'), 'utf8');
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*(\$[^\s()]+).*;;\s*(\d+)(?::\s*(.*))?$/);
    if (!m) continue;
    const id = parseInt(m[2], 10);
    if (!Number.isFinite(id)) continue;
    names[id] = m[3] ? `${m[1]}: ${m[3].trim()}` : m[1];
  }
  return names;
}

module.exports = { moduleList, makeAttributor, attributeBlocks, readHist, handlerNames };
