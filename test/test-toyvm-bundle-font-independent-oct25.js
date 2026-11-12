'use strict';
// Load JS module registries only; never construct a Machine or Wasm object.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
for (const name of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[name] = () => { throw new Error('forbidden Wasm ' + name); };
}
const base = 'd9012a86a91c13dbe70dbcc4dceff2d7895c18a4';
let passes = 0, failures = 0;
for (const file of ['toyvm-bundle.js', 'toyvm-jit-bundle.js']) {
  const rel = 'docs/dos-corpus/live/' + file;
  const old = spawnSync('git', ['cat-file', 'blob', base + ':' + rel], {
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 10000,
  });
  assert.strictEqual(old.status, 0, 'baseline bundle must be readable');
  for (const [revision, js] of [['base', old.stdout], ['candidate',
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')]]) {
    const sandbox = {};
    new Function('self', 'atob', js)(sandbox, s => Buffer.from(s, 'base64').toString('binary'));
    try {
      const font = sandbox.ToyVM.require('tools/fnt-read.js');
      assert.strictEqual(typeof font.readStrikes, 'function');
      assert.strictEqual(typeof font.pickStrike, 'function');
      passes++; console.log('PASS ' + revision + ' ' + file + ' ROM font loader present');
    } catch (e) {
      failures++; console.log('FAIL ' + revision + ' ' + file + ': ' + e.message);
    }
  }
}
console.log(JSON.stringify({ passes, failures, scope: 'JS module registry only; no rendering/guest' }));
process.exitCode = failures ? 1 : 0;
