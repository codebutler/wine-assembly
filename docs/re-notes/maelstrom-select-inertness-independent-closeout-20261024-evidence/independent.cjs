'use strict';
const assert = require('assert/strict');
const fs = require('fs');
// Refuse real WebAssembly entry points even if a later edit tries to use them.
global.WebAssembly = new Proxy({}, { get() { throw Error('real wasm forbidden'); } });
const o = require(process.argv[2]);
const poison = () => { throw Error('unexpected access'); };
const opaque = Proxy.revocable({}, {}); opaque.revoke();
let cases = 0;
for (const flag of [false, undefined]) {
  // Inherited accessors and method extraction exercise different object shapes.
  const options = Object.create(new Proxy({ enabled: flag }, {
    get(t, k) { assert.equal(k, 'enabled'); return t[k]; },
    ownKeys: poison, getOwnPropertyDescriptor: poison,
  }));
  assert.equal(o.transform(opaque.proxy, options), opaque.proxy);
  const observer = o.createObserver(opaque.proxy, options);
  const { wrapInstance, setBatch, finish, stats } = observer;
  for (const b of [36164, Number.MAX_SAFE_INTEGER, NaN, -1, null]) {
    setBatch(b); assert.equal(wrapInstance(opaque.proxy, opaque.proxy), opaque.proxy);
    finish(); assert.deepEqual(stats(), { calls: 0, capped: false, records: 0, bytes: 0, failure: null });
  }
  cases++;
}
// Pin reads are explicit: enabled transform must ignore unrelated own accessors.
const runner = fs.readFileSync(process.argv[3], 'utf8');
const pins = { enabled: true, exportsSource: fs.readFileSync(process.argv[4], 'utf8'),
  schedulerSource: fs.readFileSync(process.argv[5], 'utf8') };
const reads = [];
const configured = new Proxy(pins, { get(t, k) {
  assert(['enabled', 'lifecycle', 'exportsSource', 'schedulerSource'].includes(k));
  reads.push(k); return t[k];
}, ownKeys: poison });
const transformed = o.transform(runner, configured);
assert(transformed.includes('maelstromSelect.wrapInstance'));
assert.deepEqual(reads, ['enabled', 'lifecycle', 'exportsSource', 'schedulerSource']); cases++;
// Invalid enabled options reject before pins/source can be accessed.
assert.throws(() => o.transform(opaque.proxy, { enabled: true, lifecycle: { endBatch: -1 },
  get exportsSource() { poison(); }, get schedulerSource() { poison(); } }), /invalid configuration/);
cases++;
// Wrapping forwards this/args and exact thrown primitives; after finish it must
// continue forwarding runs while never sampling exports or memory again.
for (const value of [undefined, null, 0, Symbol('thrown')]) {
  let gets = 0, runs = 0, done = false;
  const receiver = {}, arg = {};
  const e = { run(a) { runs++; assert.equal(this, receiver); assert.equal(a, arg); throw value; } };
  for (const k of ['eip', 'esp', 'eax', 'yield_reason', 'last_run_halt', 'tick_count', 'thunk_base', 'thunk_end'])
    e['get_' + k] = () => { assert.equal(done, false); gets++; return 0; };
  const lines = [], ob = o.createObserver(s => lines.push(s), { enabled: true });
  const wrapped = ob.wrapInstance({ exports: Object.freeze(e) }, opaque.proxy);
  ob.setBatch(36164);
  const call = () => { let caught = false; try { wrapped.exports.run.call(receiver, arg); }
    catch (v) { caught = true; assert.equal(v, value); } assert(caught); };
  call(); ob.finish(); const n = gets; done = true;
  call(); ob.finish(); assert.equal(gets, n); assert.equal(runs, 2); assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0].slice(lines[0].indexOf('{')));
  assert.equal(row.witnessedReturns, 0); assert.equal(row.apiResult, 'unavailable'); cases++;
}
// A callback-shaped departure permanently closes this call even when exactly the
// same stack/thunk tuple appears later. A later retry must not revive it.
{
  const state = { eip: 0x75040f8, esp: 0x13000, eax: 0x53000001,
    yield_reason: 8, last_run_halt: 3, tick_count: 0xffffffff };
  const memory = { buffer: new ArrayBuffer(0x14000) };
  const stack = [0x7a3362, 1, 0x13100, 0, 0, 0x13200];
  stack.forEach((x, i) => new DataView(memory.buffer).setUint32(0x13000 + i * 4, x, true));
  let next = () => {}, runs = 0;
  const e = { get_image_base: () => 0x12000, get_thunk_base: () => 0x7500000,
    get_thunk_end: () => 0x7505000, thunk_word: (_, i) => [0x80000012, 934][i],
    run() { runs++; next(); } };
  for (const k of Object.keys(state)) e['get_' + k] = () => state[k];
  const lines = [], ob = o.createObserver(s => lines.push(s), { enabled: true });
  const wrapped = ob.wrapInstance({ exports: Object.freeze(e) }, memory);
  ob.setBatch(36164); wrapped.exports.run();
  state.yield_reason = 0; next = () => { state.eip = 0x123456; };
  wrapped.exports.run();
  state.eip = 0x75040f8; state.yield_reason = 0; state.tick_count = 0;
  next = () => { state.yield_reason = 8; }; wrapped.exports.run();
  ob.finish();
  const row = JSON.parse(lines[0].slice(lines[0].indexOf('{')));
  assert.equal(runs, 3); assert.equal(row.observedRetryPairs, 0);
  assert.equal(row.unknownTransitions, 1); assert.equal(row.witnessedReturns, 0);
  assert.equal(row.apiResult, 'unavailable'); cases++;
}
console.log(JSON.stringify({ verdict: 'PASS', independentCases: cases, realWasm: 0,
  controls: ['inherited disabled options', 'revoked opaque arguments', 'detached methods',
    'explicit enabled pin reads', 'invalid config before pins', 'primitive exception identity',
    'no reads after finish', 'closed identity never revives'] }));
