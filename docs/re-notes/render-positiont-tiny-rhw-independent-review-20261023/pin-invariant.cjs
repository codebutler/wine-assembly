'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),target='src/09ah-d3d-software.wat',pin='test/support/positiont-com-source-pins.json';
const base=JSON.parse(cp.execFileSync('git',['show','301b568d2c9359a5fe8c8336002412c2c5d9f5e3:'+pin],{cwd:root,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}}));
const next=JSON.parse(fs.readFileSync(path.join(root,pin))),bytes=fs.readFileSync(path.join(root,target));
function validate(p,b){
 assert.equal(Object.keys(base).length,286);assert.deepEqual(Object.keys(p),Object.keys(base),'pin membership/order');
 assert.equal(base[target],'40c91282b9ba9d10bc26e75b6383b6005362d23c');
 assert.deepEqual(Object.keys(base).filter(k=>base[k]!==p[k]),[target],'exactly one authorized pin delta');
 const blob=crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
 assert.equal(blob,'538290c4241f9112ff5e16f5cd71735ab38edea9','reviewed blob');assert.equal(p[target],blob,'stale pin');
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'43ec7d8685cc4942dbdb30b8c9efacf28ec1add81fed4f55f008b7dbe9c4b0c3','reviewed SHA256');
}
validate(next,bytes);
const unrelated=Object.keys(base).find(k=>k!==target),second={...next,[unrelated]:'0'.repeat(40)};
assert.throws(()=>validate(second,bytes),/exactly one authorized pin delta/);
assert.throws(()=>validate({...next,[target]:base[target]},bytes),/exactly one authorized pin delta/);
assert.throws(()=>validate(next,Buffer.concat([bytes,Buffer.from(' ')])),/reviewed blob/);
const fixture=fs.readFileSync(root+'/test/test-d3d9-positiont-com-qualification.js');
assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'),'5ed316197793ade492b01bc3e510a24a5040497c8e1b5c969d766701b94c4663');
console.log(JSON.stringify({result:'PASS',pins:286,unchanged:285,delta:{path:target,old:base[target],new:next[target]},secondPinRejected:true,stalePinRejected:true,staleSourceRejected:true,fixtureOracleControlsUnchanged:true,sourcePinsSha256:crypto.createHash('sha256').update(JSON.stringify(next)).digest('hex')}));
