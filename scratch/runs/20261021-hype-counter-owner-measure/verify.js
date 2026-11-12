'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=__dirname,read=n=>JSON.parse(fs.readFileSync(path.join(root,n))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const seals=read('SHA256SUMS.json');
for(const f of seals.files){assert(!path.isAbsolute(f.path)&&!f.path.split('/').includes('..'));const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(sha(b),f.sha256,f.path);}
const remote=read('recovery-manifest.json');for(const f of remote.files){const b=fs.readFileSync(path.join(root,'evidence',f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(sha(b),f.sha256,f.path);}
assert.equal(sha(fs.readFileSync(path.join(root,'source/hype-glide-emission-observer.js'))),read('source-receipt.json').validatorSha256);
const {validateHypeMeasurement}=require('./source/hype-glide-emission-observer.js');
assert.deepEqual(validateHypeMeasurement(read('measurement.json')),read('validation.json'));
assert(read('validation.json').accepted);assert.equal(read('validation.json').logicalFrames,188);
const old=validateHypeMeasurement(read('rejected-prior/measurement.json'));assert(!old.accepted);assert.equal(old.fps,null);assert.equal(old.raw.samples.length,106);
for(const slot of [0,2,3]){const x=read('wrong-owner-slot'+slot+'.json');assert.deepEqual(validateHypeMeasurement(x.raw),x);assert(!x.accepted&&x.fps===null);}
assert(read('controls.json').every(c=>c.rejected));
for(const phase of ['preflight','postflight']){const p=read('evidence/'+phase+'.json');assert.equal(p.sourceFiles,6731);assert.equal(p.assets,59);assert.equal(p.head,read('source-receipt.json').source);assert.equal(p.moduleHash,read('measurement.json').moduleSha256);}
assert.equal(read('session1-status.json').exitCode,0);assert.deepEqual(read('evidence/session1/errors.json'),[]);
console.log(JSON.stringify({ok:true,localSeals:seals.files.length,remoteSeals:remote.files.length,logicalFrames:188,fps:read('validation.json').fps,rejectedControls:read('controls.json').length}));
