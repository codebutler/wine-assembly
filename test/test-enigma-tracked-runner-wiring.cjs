'use strict';
// Offline exact-source transformation guard. Supply the retained immutable runner.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {wireRunner,ATOMIC_BRANCH}=require('../tools/enigma-presented-menu-controller.cjs');
const bytes=fs.readFileSync(process.argv[2]),source=bytes.toString('utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(bytes.length,687226);
assert.equal(sha(bytes),'87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7');
assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex'),'4b8461338f4bcddde6b5d5504991523b28d3ac35');
const marker="    if (cmd.action === 'eval') return controlEval(cmd.code || '');";
const output=wireRunner(source),at=source.indexOf(marker);
assert(at>=0);assert.equal(source.indexOf(marker,at+1),-1);
assert.equal(output,source.slice(0,at)+ATOMIC_BRANCH+source.slice(at));
assert.equal(output.slice(0,at),source.slice(0,at));
assert.equal(output.slice(at+ATOMIC_BRANCH.length),source.slice(at));
assert.equal(wireRunner(source),output);
const rejects={
 'wrong-source':source+'\n',
 'malformed-source':source.slice(0,-1),
 'missing-insertion-hook':source.replace(marker,''),
 'duplicate-insertion-hook':source+marker,
 'missing-parser':source.replace('  const parseInputEntries = (entries) => {','  const otherParser = (entries) => {'),
 'missing-presentation-hook':source.replace('dxPresentHook =','otherHook ='),
 'already-wired':output
};
for(const [name,input] of Object.entries(rejects))assert.throws(()=>wireRunner(input),/runner source identity mismatch/,name);
assert.throws(()=>wireRunner(undefined));
console.log(JSON.stringify({checks:12,sourceSHA256:sha(bytes),derivativeSHA256:sha(output),insertionByte:Buffer.byteLength(source.slice(0,at)),sourceBytes:bytes.length,derivativeBytes:Buffer.byteLength(output),results:['exact-actual-tracked-runner-wires','byte-exact-single-insertion','deterministic',...Object.keys(rejects),'missing-source-rejects','immutable-source'],guestExecutions:0}));
