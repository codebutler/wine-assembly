#!/usr/bin/env node
'use strict';
// Independent deterministic dispatch-boundary test. Real provider/lifetime
// operations; runSlice is deliberately an action adapter, not scheduler proof.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Module = require('module');
const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'lib/thread-manager.js');
const mode = process.argv[2] || 'repair';
assert(['repair', 'original', 'baseline', 'remove-postcheck'].includes(mode));
const revisions = {
  original: '8213294c2ab39b1b925c45da3bf25355c17a4c55',
  baseline: 'c9e03eb6e40481f6bb570a89f96b856a9a1d5e83'
};
let source = revisions[mode] ? cp.execFileSync('git', ['-C', root,
  'show', revisions[mode] + ':lib/thread-manager.js'], {encoding:'utf8'}) :
  fs.readFileSync(file, 'utf8');
if (mode === 'remove-postcheck') {
  const needle = '        if (!eventStillLive()) return 0xFFFFFFFF;\n        result = this.waitSingle(handle, 0, threadId);';
  assert.strictEqual(source.split(needle).length, 2);
  source = source.replace(needle, '        result = this.waitSingle(handle, 0, threadId);');
}
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(source, file);
const {ThreadManager} = mod.exports;
const results = [];
for (const manual of [0, 1]) {
  for (const action of ['close', 'reuse-unsignaled', 'reuse-signaled',
    'signal-close', 'partial-close-signal', 'signal-partial-close', 'signal']) {
    const memory = new WebAssembly.Memory({initial:2, maximum:2, shared:true});
    const tm = new ThreadManager({}, memory, {exports:{get_sync_table:()=>0}}, ()=>({host:{}}));
    tm._log = ()=>{};
    const handle = tm.createEvent(manual, 0, 'independent');
    const slot = tm._getSyncIdx(handle);
    const partial = action.includes('partial');
    if (partial) assert.strictEqual(tm.openEvent('independent'), handle);
    let dispatches = 0, replacement = 0;
    tm.hasActiveThreads = ()=>true;
    tm.runSlice = ()=> {
      assert.strictEqual(++dispatches, 1, 'one boundary action');
      if (action.startsWith('signal')) assert.strictEqual(tm.setEvent(handle), 1);
      if (action !== 'signal') assert.strictEqual(tm.closeEvent(handle), 1);
      if (action === 'partial-close-signal') assert.strictEqual(tm.setEvent(handle), 1);
      if (action.startsWith('reuse')) {
        // Recycle twice: do not merely test the immediately following handle.
        const intermediate = tm.createEvent(manual, 0, 'intermediate');
        assert.strictEqual(tm._getSyncIdx(intermediate), slot);
        assert.strictEqual(tm.closeEvent(intermediate), 1);
        replacement = tm.createEvent(manual, +(action === 'reuse-signaled'), 'replacement');
        assert.notStrictEqual(replacement, handle);
        assert.strictEqual(tm._getSyncIdx(replacement), slot);
      }
      return {steps:1, blocks:0};
    };
    const actual = tm.waitSingleCooperative(handle, -1) >>> 0;
    const expected = mode === 'baseline' || (!partial && action !== 'signal') ? 0xffffffff : 0;
    if (replacement) {
      assert.strictEqual(tm.waitSingle(replacement, 0), action === 'reuse-signaled' ? 0 : 0x102,
        'original wait must not consume replacement signal');
      assert.strictEqual(tm.waitSingle(replacement, 0), action === 'reuse-signaled' && manual ? 0 : 0x102);
    }
    if (partial && mode !== 'baseline') {
      assert.strictEqual(tm._getSyncIdx(handle), slot);
      assert.strictEqual(tm.waitSingle(handle, 0), manual ? 0 : 0x102);
    }
    assert.strictEqual(dispatches, mode === 'baseline' ? 0 : 1);
    results.push({manual, action, actual, expected, dispatches, replacement, pass:actual===expected});
  }
}
console.log(JSON.stringify({mode, results}, null, 2));
// Aggregate only after observing every case: original/control must independently
// expose closure AND both unsignaled/signaled replacement false acquisition.
assert(results.every(r=>r.pass), 'nested lifetime acceptance failed: ' +
  results.filter(r=>!r.pass).map(r=>`${r.action}/${r.manual}=${r.actual}`).join(', '));
