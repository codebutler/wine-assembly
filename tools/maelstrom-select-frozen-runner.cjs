'use strict';
// Checked, opt-in transform of ONE historical runner. Never executes it.
const { createHash } = require('node:crypto');
const PIN = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809';
const START = '  const instance = await WebAssembly.instantiate(wasmModule, imports);';
const MAIN = '      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);';
const PARALLEL = '          try { instance.exports.run(BATCH_SIZE); } catch (e) { /* reported below */ }';
const SERIAL = '          try { instance.exports.run(BATCH_SIZE); } catch (e) { break; }';
const setup = `
  // Historical completion is latched inside select; host state is later.
  let mscFrozenAdapter = null;
  const mscFrozenFile = getArg('maelstrom-select-frozen-record', null);
  if (mscFrozenFile) {
    try {
      const { createAdapter } = require('../tools/maelstrom-select-frozen-record.cjs');
      mscFrozenAdapter = createAdapter(instance, {
        enabled: true,
        persist: event => fs.appendFileSync(mscFrozenFile, JSON.stringify(event) + '\\n'),
        readLive: () => ({ eax: instance.exports.get_eax() >>> 0,
          esp: instance.exports.get_esp() >>> 0, eip: instance.exports.get_eip() >>> 0 }),
      });
      mscFrozenAdapter.start();
    } catch (e) {
      mscFrozenAdapter = null;
      console.error('[select-frozen-record] disabled after start failure', e);
    }
  }
  function mscFrozenObserve(batch) {
    if (!mscFrozenAdapter) return;
    try { mscFrozenAdapter.observe(batch); }
    catch (e) {
      mscFrozenAdapter = null;
      console.error('[select-frozen-record] rejected observation', e);
    }
  }
`;
const main = `      if (!mainExecutionSuspended()) {
        instance.exports.run(BATCH_SIZE);
        mscFrozenObserve(batch);
      }`;
// Observe outside the guest catch: diagnostic failures must never enter its
// catch/break path. A thrown guest call has no normal-return observation.
function interleaved(anchor) {
  const suffix = anchor.slice(anchor.indexOf(' catch'));
  return '          let mscFrozenReturned = false;\n' +
    '          try { instance.exports.run(BATCH_SIZE); mscFrozenReturned = true; }' + suffix +
    '\n          if (mscFrozenReturned) mscFrozenObserve(batch);';
}
const edits = Object.freeze([[START, START + setup], [MAIN, main],
  [PARALLEL, interleaved(PARALLEL)], [SERIAL, interleaved(SERIAL)]]);
function transform(source, options = {}) {
  if (options.enabled !== true) return source;
  if (typeof source !== 'string') throw Error('historical runner source required');
  // Check anchors as well as full identity; never partially return a transform.
  for (const [a] of edits) if (source.split(a).length !== 2) throw Error('unsupported runner anchor');
  if (createHash('sha256').update(source).digest('hex') !== PIN) throw Error('historical runner pin');
  let output = source;
  for (const [a, b] of edits) output = output.replace(a, b);
  return output;
}
function restore(source) {
  // For review/tests: recover the exact full runner, including catch bodies.
  for (const [a, b] of edits) {
    if (source.split(b).length !== 2) throw Error('transformed runner anchor');
    source = source.replace(b, a);
  }
  return source;
}
module.exports = { transform, restore, PIN };
if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('usage: INPUT_RUNNER NEW_OUTPUT');
  const result = transform(fs.readFileSync(input, 'utf8'), { enabled: true });
  fs.writeFileSync(output, result, { flag: 'wx' });
}
