#!/usr/bin/env node
'use strict';
// Real producer AST mutations against the checked-in lock. Source gate only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSource } = require('./watx');
const { scanWat, check } = require('./callback-ownership-census');
const census = require('./callback-ownership-census.json');
const render = n => Array.isArray(n) ? `(${n.slice(1).map(render).join(' ')})` : n;
let negatives = 0;
for (const [file, name] of [
  ['src/09c3-wndprocs5-edit.wat', '$edit_stream_call'],
  ['src/09c9-winhelp-ui.wat', '$help_macro_call_routine'],
]) {
  const fn = parseSource(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file)
    .find(n => n[1] === 'func' && n[2] === name);
  assert(fn);
  const lock = { version: 1, entries: census.entries.filter(e => e.file === file && e.name === name) };
  assert.equal(lock.entries.length, 1);
  assert.equal(lock.entries[0].ownership, 'pending');
  const scan = tree => scanWat(render(tree), file);
  assert.deepEqual(check(scan(fn), lock), []);
  const body = tree => name === '$edit_stream_call' ? tree :
    tree.find(n => n[1] === 'if' && n[2][1] === 'local.get' && n[2][2] === '$ok')[3];
  const mutate = (label, edit, sameCalls = true) => {
    const tree = structuredClone(fn);
    edit(body(tree));
    const actual = scan(tree);
    if (sameCalls) assert.deepEqual(actual[0].boundaryCalls, lock.entries[0].boundaryCalls,
      `${label}: same-call mutation must exercise whole-body hash`);
    assert(check(actual, lock).includes(`changed producer ${file}:${name} (sha256); review its lifetime`), label);
    negatives++;
  };
  for (const field of ['$expected_child', '$expected_root', '$expected_depth']) {
    mutate(`remove ${field} guard`, b => {
      const i = b.findIndex(n => n[1] === 'if' && render(n).includes(field));
      assert(i >= 0); b.splice(i, 1);
    }, field !== '$expected_child');
  }
  mutate('acquire after guest writes', b => {
    const i = b.findIndex(n => n[1] === 'call' && n[2] === '$sync_depth_enter');
    assert(i >= 0);
    const [enter] = b.splice(i, 1);
    const loop = b.findIndex(n => n[1] === 'block' && render(n).includes('$run'));
    assert(loop >= 0); b.splice(loop, 0, enter);
  }, false);
  mutate('omit ESP restoration', b => {
    const i = b.findIndex(n => n[1] === 'i32.store' && render(n).includes('$old_esp'));
    assert(i >= 0); b.splice(i, 1);
  });
  // Hash refresh alone must not approve a stale boundary list.
  const staleCalls = structuredClone(lock);
  staleCalls.entries[0].boundaryCalls = ['$sync_depth_enter', '$run', '$sync_depth_leave'];
  assert.deepEqual(check(scan(fn), staleCalls),
    [`changed producer ${file}:${name} (boundaryCalls); review its lifetime`]);
  negatives++;
  // Source pinning cannot be relabeled as runtime lifetime acceptance.
  const approved = structuredClone(lock);
  approved.entries[0].ownership = 'covered';
  assert(check(scan(fn), approved).includes(`unsupported ownership assertion ${file}:${name}`));
  negatives++;
}
console.log(`callback census reconciliation PASS: 2 production producers, ${negatives} rejection controls; ownership pending`);
