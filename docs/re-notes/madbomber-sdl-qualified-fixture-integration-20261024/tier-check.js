'use strict';
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const P = __dirname;
const entries = JSON.parse(fs.readFileSync(path.join(P, 'exact-test-entries.json')));
const originalReadDir = fs.readdirSync;
// Use the actual final Git tree's complete top-level test entry inventory.
// Only readdir is adapted because this is an explicitly focused checkout.
fs.readdirSync = function (p, opts) {
  if (path.resolve(p) === path.join(P, 'test')) {
    assert(opts.withFileTypes);
    return entries.map(e => ({ name: e.name, isFile: () => e.type === 'blob' }));
  }
  return originalReadDir.apply(this, arguments);
};
const tiers = require('./test-tiers.js');
const result = tiers.validateTiers(P);
assert.deepEqual(result.errors, []);
assert.equal(tiers.classifyTest('test/test-madbomber-system-thunk-identity.js'), 'unit');
assert.equal(tiers.classifyTest('test/test-madbomber-sdl-error-consumer-candidate.js'), 'e2e');
assert.equal(tiers.classifyTest('test/system-thunk-identity.js'), null);
console.log(JSON.stringify({ verdict: 'PASS', inventory: 'exact final Git tree test directory', files: result.actual.length,
  tierCounts: Object.fromEntries(Object.entries(result.tiers).map(([k,v])=>[k,v.length])),
  helper: 'unit', nativeCandidate: 'e2e', metadataChangeRequired: false }));
