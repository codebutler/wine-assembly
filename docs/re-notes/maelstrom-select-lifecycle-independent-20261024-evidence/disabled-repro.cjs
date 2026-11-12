'use strict';
const assert = require('assert/strict');
const observer = require(process.argv[2] || '../repo/tools/maelstrom-select-lifecycle-observer.cjs');
const sentinel = new Error('unused disabled argument was accessed');
const cases = [
  ['disabled-transform-pin', () => observer.transform('unchanged source', {
    enabled: false, get exportsSource() { throw sentinel; }
  })],
  ['disabled-transform-lifecycle', () => observer.transform('unchanged source', {
    enabled: false, get lifecycle() { throw sentinel; }
  })],
  ['disabled-observer-limit', () => observer.createObserver(() => {
    throw Error('disabled sink');
  }, { enabled: false, get maxInvocations() { throw sentinel; } })],
];
let failures = 0;
for (const [name, call] of cases) {
  let actual;
  try { actual = call(); }
  catch (error) {
    assert.equal(error, sentinel);
    failures++;
    console.log(JSON.stringify({ name, desired: 'no access to unused disabled option',
      actual: 'getter invoked; exact sentinel exception escaped', verdict: 'FAIL' }));
  }
}
assert.equal(failures, 3, 'reproduction must retain all three observed failures');
console.log(JSON.stringify({ candidate: '0e1b2df6e3adff9ad43424966a389c2ea6af227e',
  unchanged: true, nativeAPIs: 0, regressionFailures: failures, verdict: 'FAIL_DISABLED_INERTNESS' }));
process.exitCode = 1;
