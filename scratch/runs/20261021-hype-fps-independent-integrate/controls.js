'use strict';
const fs=require('fs'),assert=require('assert/strict');
const root='/home/user/wine-assembly/scratch/runs/20261021-hype-counter-owner-measure';
const read=n=>JSON.parse(fs.readFileSync(root+'/'+n));
const {validateHypeMeasurement:validate}=require(root+'/source/hype-glide-emission-observer.js');
const receipt=read('measurement.json'),probes=read('evidence/session1/owner-probes.json');
const owner=read('evidence/session1/authenticated-owner.json');
const results=[];
for(const slot of [0,2,3]) {
  const p=probes.find(p=>p.slot===slot);
  // Independent live-owner acceptance predicate, before the validator contract.
  assert.equal(p.end.count-p.initial.count,0);
  assert.notEqual(p.slot,owner.slot);
  const recorded=read(`wrong-owner-slot${slot}.json`),actual=validate(recorded.raw);
  assert.deepEqual(actual,recorded);assert(!actual.accepted&&actual.fps===null);
  results.push({name:`live wrong owner slot ${slot}`,rejected:true,reasons:actual.reasons});
}
for(const [name,mutation] of [
  ['disabled',r=>r.samples[1].enabled=false],
  ['reset-epoch',r=>r.samples[1].generation='independent-other'],
  ['count-reset',r=>r.samples[1].count=0],
  ['owner-change',r=>r.samples[1].owner.thread++],
  ['clock-domain',r=>r.samples[1].clockOrigin='independent-other'],
  ['missing-coverage',r=>r.coverage.continuous=false],
]) {
  const r=structuredClone(receipt);mutation(r);const actual=validate(r);
  assert(!actual.accepted&&actual.fps===null);
  assert.deepEqual(actual.reasons,read('controls.json').find(c=>c.name===name).reasons);
  results.push({name,rejected:true,reasons:actual.reasons});
}
const old=validate(read('rejected-prior/measurement.json'));
assert(!old.accepted&&old.fps===null&&old.raw.samples.length===106);
results.push({name:'prior 106 wrong-owner samples',rejected:true,reasons:old.reasons});
// Explicitly demonstrate the limit: owner authentication is not implemented by
// this validator. With a falsely asserted contract, wrong-owner zero is valid.
const fabricated=structuredClone(receipt),wrong=read('evidence/session1/logical-slot0.json');
fabricated.samples=wrong.samples;fabricated.clock.origin=String(wrong.origin);
fabricated.counter.emittingOwnerAuthenticated=false;
const acceptedZero=validate(fabricated);
assert(acceptedZero.accepted&&acceptedZero.fps===0);
const nonexistent=structuredClone(receipt);nonexistent.source='nonexistent-file';
assert(validate(nonexistent).accepted);
console.log(JSON.stringify({tenRejections:results,contractLimitControls:{falselyQualifiedWrongOwnerAcceptedAsZero:true,nonexistentEvidenceReferenceAccepted:true},conclusion:'Authentication relies on reviewed capture, binary/source and sealed lifecycle evidence; green validator alone is insufficient.'},null,2));
