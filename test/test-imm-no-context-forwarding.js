#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { watxSourceClosure, compileClosure } = require('../tools/watx-closure');
// Read the authoritative include closure, not a fixed handler filename: the
// structural-owner lane may move these functions without changing behavior.
const closure = watxSourceClosure();
const functions = new Map();
for (const [file, source] of closure.vfs) {
  if (file.includes('/')) continue;
  const clean = source.replace(/\(;[\s\S]*?;\)/g, '').replace(/;;[^\n]*/g, '');
  const re = /\(func\s+(\$[^\s()]+)/g;
  let match;
  while ((match = re.exec(clean))) {
    let depth = 1, end = re.lastIndex;
    for (; end < clean.length && depth; end++) {
      if (clean[end] === '(') depth++;
      else if (clean[end] === ')') depth--;
    }
    assert.strictEqual(depth, 0, `unbalanced ${match[1]}`);
    functions.set(match[1], clean.slice(match.index, end));
    re.lastIndex = end;
  }
}
const cases = [
  ['ImmGetOpenStatus', 8], ['ImmSetOpenStatus', 12],
  ['ImmGetConversionStatus', 16], ['ImmSetConversionStatus', 16],
  ['ImmGetCandidateListA', 20],
];
const needed = new Map();
function collect(name) {
  if (needed.has(name)) return;
  const body = functions.get(name); assert(body, `missing actual source function ${name}`);
  needed.set(name, body);
  for (const match of body.matchAll(/\((?:call|return_call)\s+(\$[^\s()]+)/g)) collect(match[1]);
}
for (const [name] of cases) collect('$handle_' + name);
const source = `
 (memory 1)
 (export "memory" (memory 0))
 (global $eax (mut i32) (i32.const 0))
 (global $esp (mut i32) (i32.const 0))
 (global $last_error (mut i32) (i32.const 0))
 (func (export "seed")
   (global.set $eax (i32.const 0x12345678))
   (global.set $esp (i32.const 4096))
   (global.set $last_error (i32.const 0x13572468)))
 (func (export "eax") (result i32) (global.get $eax))
 (func (export "esp") (result i32) (global.get $esp))
 (func (export "last_error") (result i32) (global.get $last_error))
 ${[...needed.values()].join('\n')}
 ${cases.map(([name]) => `(export "${name}" (func $handle_${name}))`).join('\n')}
`;
const compiled = compileClosure({ source, vfs: new Map() }, { tailCalls: true });
assert(compiled.success && compiled.wasmBinary, compiled.error || 'canonical WATX compilation failed');
const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const memory = new Uint8Array(e.memory.buffer);
for (const [name, cleanup] of cases) {
  for (const context of [0, 0x12345678, -1]) {
    memory.fill(0xa5); const before = memory.slice();
    e.seed();
    // Output pointers refer to initialized canaries; full-memory comparison
    // checks both buffers and unrelated bytes. No imports can hide side effects.
    e[name](context, 8192, 8208, 16, 0x1234, 0);
    assert.strictEqual(e.eax(), 0, name + ' must fail on a no-context machine');
    assert.strictEqual(e.esp(), 4096 + cleanup, name + ' exact stdcall cleanup');
    assert.strictEqual(e.last_error(), 0x13572468, name + ' preserves last error');
    assert.deepStrictEqual(memory, before, name + ' leaves output buffers and all memory untouched');
  }
  console.log(`PASS ${name}: NULL/fabricated contexts, cleanup ${cleanup}, preserved error/output`);
}
console.log('PASS 15 actual-source IMM no-context forwarding cases');
