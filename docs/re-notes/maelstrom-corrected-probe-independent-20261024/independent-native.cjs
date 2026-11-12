'use strict';
// One retained-native invocation, with an independent contradiction control.
// Candidate stays byte unchanged. A unique insertion records live observations
// before its original 972-entry test; all original assertions still execute.
const fs = require('fs'), path = require('path'), Module = require('module');
const assert = require('assert/strict'), crypto = require('crypto');
const file = path.resolve(__dirname, '../repo/tools/maelstrom-retained-breakpoint-probe.cjs');
const original = fs.readFileSync(file, 'utf8');
const hash = crypto.createHash('sha256').update(original).digest('hex');
assert.equal(hash, '33454b44192dfe39952f364b1fa94ee6af7b36aa511efa5e08e8ec9fe9e920f9');
const anchor = '  // Exact original SDL_net prefix, qualified separately against its pinned';
assert.equal(original.split(anchor).length, 2);
const control = `
  // Use addresses disjoint from every candidate counter fixture. clear_counts
  // disables addresses but does not erase stored counts on same-address rearm.
  const controlHead = head + 0x800, controlTarget = controlHead + 4;
  put(controlHead, [0x40, 0x90, 0x90, 0x90, 0x41, 0xeb, 0xf9]);
  e.set_count(0, controlHead); e.set_count(1, controlTarget);
  e.set_bp(controlTarget); e.set_eip(controlTarget); e.set_yield_state(1, 0);
  const controlStores = e.get_cache_stores(), controlEBP = e.get_ebp();
  const controlEAX = e.get_eax(), controlECX = e.get_ecx();
  const priority = observe('independent-breakpoint-before-yield', 1000);
  assert.equal(priority.halt, 5); assert.equal(priority.eip, controlTarget);
  assert.equal(priority.interiorCount, 0);
  let independentReads = 0;
  assert.equal(targetEvidence(e, controlTarget, () => ++independentReads), 1);
  const skipped = observe('independent-skip-consumed-without-execution', 1000);
  assert.equal(skipped.halt, 4); assert.equal(skipped.eip, controlTarget);
  assert.equal(skipped.interiorCount, 1);
  assert.equal(e.get_cache_stores(), controlStores); assert.equal(e.get_ebp(), controlEBP);
  assert.equal(e.get_eax(), controlEAX); assert.equal(e.get_ecx(), controlECX);
  assert.equal(targetEvidence(e, controlTarget, () => ++independentReads), null);
  assert.equal(independentReads, 1);
  const rearmed = observe('independent-rearm-after-blocked-skip', 1000);
  assert.equal(rearmed.halt, 5); assert.equal(rearmed.interiorCount, 1);
  assert.equal(targetEvidence(e, controlHead, () => ++independentReads), null);
  assert.equal(independentReads, 1);
  const lastSkip = observe('independent-consume-second-skip', 1000);
  assert.equal(lastSkip.halt, 4); assert.equal(lastSkip.interiorCount, 2);
  assert.equal(e.get_cache_stores(), controlStores);
  assert.equal(e.get_eax(), controlEAX); assert.equal(e.get_ecx(), controlECX);
  e.clear_bp(); e.clear_counts(); e.set_yield_state(0, 0);
`;
const instrumented = original.replace(anchor, control + anchor).replaceAll('rows.push(row);', 'rows.push(row); console.log(JSON.stringify({ liveRow: row }));');
const compiled = new Module(file, module);
compiled.filename = file; compiled.paths = Module._nodeModulePaths(path.dirname(file));
compiled._compile(instrumented, file);
compiled.exports.probe(process.argv[2]).then(result => {
  result.independentControl = { candidateSHA256: hash, insertionAnchor: anchor,
    controlSHA256: crypto.createHash('sha256').update(control).digest('hex'),
    observation: 'breakpoint precedes pending yield; skip consumed by blocked entry; next entry halts again' };
  console.log(JSON.stringify(result, null, 2));
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
