#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const GENERATED = '09b2-dispatch-table.generated.wat';
const table = JSON.parse(fs.readFileSync(path.join(SRC, 'api_table.json'), 'utf8'));
const generated = fs.readFileSync(path.join(SRC, GENERATED), 'utf8');

function functionEnd(source, start) {
  let depth = 0;
  let quoted = false;
  let lineComment = false;
  let blockComment = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '(' && next === ';') { blockComment++; i++; }
      else if (ch === ';' && next === ')') { blockComment--; i++; }
      continue;
    }
    if (quoted) {
      if (ch === '\\') i++;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === ';' && next === ';') { lineComment = true; i++; continue; }
    if (ch === '(' && next === ';') { blockComment = 1; i++; continue; }
    if (ch === '"') { quoted = true; continue; }
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0) return i + 1;
  }
  throw new Error(`unterminated function at byte ${start}`);
}

function functionsBy(source, pattern) {
  const result = new Map();
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1];
    assert(!result.has(name), `duplicate function/export ${name}`);
    result.set(name, source.slice(match.index, functionEnd(source, match.index)));
  }
  return result;
}

function normalize(source) {
  return source.replace(/;;.*$/gm, '').replace(/\s+/g, ' ').trim();
}

function watI32(value) {
  return value > 0x7fffffff ? `0x${value.toString(16)}` : String(value);
}

function expectedStub(api) {
  return `
    (func $handle_${api.name}
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
      (global.set $eax (i32.const ${watI32(api.stub.ret)}))
      (global.set $esp
        (i32.add (global.get $esp) (i32.const ${api.stub.pop}))))`;
}

function expectedTestCall(api) {
  const params = Array.from({ length: api.nargs }, (_, i) =>
    ` (param $arg${i} i32)`).join('');
  const args = Array.from({ length: 5 }, (_, i) =>
    i < api.nargs ? `(local.get $arg${i})` : '(i32.const 0)');
  args.push('(i32.const 0)');
  return `
    (func (export "test_call_${api.name}")${params} (result i32)
      (local $saved_esp i32)
      (local.set $saved_esp (global.get $esp))
      (call $handle_${api.handler || api.name}
        ${args.slice(0, 3).join(' ')}
        ${args.slice(3).join(' ')})
      (global.set $esp (local.get $saved_esp))
      (global.get $eax))`;
}

const metadataStubs = table.filter(api => api.stub !== undefined);
const metadataTestCalls = table.filter(api => api.test_call === true);
const generatedHandlers = functionsBy(generated, /\(func\s+\$(handle_[^\s()]+)/g);
const generatedTestCalls = functionsBy(
  generated, /\(func\s+\(export\s+"test_call_([^"]+)"\)/g);

assert.strictEqual(generatedHandlers.size, metadataStubs.length,
  'generated handler population must be exactly the api_table metadata-stub population');
assert.strictEqual(generatedTestCalls.size, metadataTestCalls.length,
  'generated test-call population must be exactly the api_table opt-in population');

for (const api of metadataStubs) {
  assert.strictEqual(api.handler, undefined,
    `${api.name}: stub metadata cannot coexist with a handler alias`);
  assert.deepStrictEqual(Object.keys(api.stub).sort(), ['pop', 'ret'],
    `${api.name}: stub metadata has an unknown field`);
  assert(Number.isInteger(api.stub.pop) && api.stub.pop >= 0 && api.stub.pop % 4 === 0,
    `${api.name}: stub pop must be a nonnegative aligned integer`);
  assert(Number.isInteger(api.stub.ret) && api.stub.ret >= -0x80000000 && api.stub.ret <= 0xffffffff,
    `${api.name}: stub return must fit in an i32`);
  if (api.convention === 'stdcall' && Number.isInteger(api.nargs)) {
    assert.strictEqual(api.stub.pop, 4 * (api.nargs + 1),
      `${api.name}: stub pop disagrees with stdcall nargs`);
  }
  const actual = generatedHandlers.get(`handle_${api.name}`);
  assert(actual, `${api.name}: metadata stub has no generated handler`);
  assert.strictEqual(normalize(actual), normalize(expectedStub(api)),
    `${api.name}: generated constant handler does not match its metadata`);
}

for (const api of table) {
  assert(api.test_call === undefined || api.test_call === true,
    `${api.name}: test_call must be true when present`);
}
for (const api of metadataTestCalls) {
  assert(Number.isInteger(api.nargs) && api.nargs >= 0 && api.nargs <= 5,
    `${api.name}: generated test call requires nargs in range 0..5`);
  const actual = generatedTestCalls.get(api.name);
  assert(actual, `${api.name}: test_call metadata has no generated export`);
  assert.strictEqual(normalize(actual), normalize(expectedTestCall(api)),
    `${api.name}: generated test-call wrapper does not match its metadata`);
}

const handwritten = new Map();
for (const file of fs.readdirSync(SRC).filter(name => name.endsWith('.wat') && name !== GENERATED)) {
  const source = fs.readFileSync(path.join(SRC, file), 'utf8');
  const exports = functionsBy(source, /\(func\s+\(export\s+"test_call_([^"]+)"\)/g);
  for (const [name] of exports) {
    assert(!handwritten.has(name),
      `handwritten test_call_${name} is duplicated in ${handwritten.get(name)} and ${file}`);
    handwritten.set(name, file);
  }
}
for (const name of generatedTestCalls.keys()) {
  assert(!handwritten.has(name),
    `generated test_call_${name} collides with handwritten export in ${handwritten.get(name)}`);
}

console.log(`PASS  API metadata generation: ${metadataStubs.length} constant handlers, ` +
  `${metadataTestCalls.length} test_call wrappers; ${handwritten.size} test_call wrappers remain handwritten`);
