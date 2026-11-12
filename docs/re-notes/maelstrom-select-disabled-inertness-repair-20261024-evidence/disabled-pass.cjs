'use strict';
// Semantics-preserving acceptance wrapper for the three calls in the unchanged
// independent disabled-repro.cjs. That historical script asserts three failures
// and unconditionally exits 1, so its reporter cannot accept a repaired module.
const assert = require('assert/strict');
const observer = require(process.argv[2]);
const sentinel = new Error('unused disabled argument was accessed');
let accesses = 0;
const unused = () => { accesses++; throw sentinel; };
const source = 'unchanged source';
const cases = [
  ['disabled-transform-pin', () => observer.transform(source, {
    enabled: false, get exportsSource() { return unused(); }
  }), result => assert.equal(result, source)],
  ['disabled-transform-lifecycle', () => observer.transform(source, {
    enabled: false, get lifecycle() { return unused(); }
  }), result => assert.equal(result, source)],
  ['disabled-observer-limit', () => observer.createObserver(() => {
    throw Error('disabled sink');
  }, { enabled: false, get maxInvocations() { return unused(); } }), result => {
    const opaque = new Proxy({}, { get() { throw Error('guest access'); } });
    assert.equal(result.wrapInstance(opaque, opaque), opaque);
    result.setBatch(36164); result.finish();
    assert.equal(result.stats().records, 0);
  }],
];
for (const [name, call, check] of cases) {
  check(call());
  assert.equal(accesses, 0, name);
  console.log(JSON.stringify({ name, verdict: 'PASS', unusedGetterAccesses: accesses }));
}
console.log(JSON.stringify({ verdict: 'PASS_DISABLED_INERTNESS', cases: cases.length,
  unusedGetterAccesses: accesses, nativeAPIs: 0 }));
