'use strict';
// Offline review of existing evidence; never launches a browser or rewrites it.
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),path=require('path');
const root=process.argv[2]||'/home/user/wine-assembly';
const r=path.join(root,'scratch/runs/20261021-madbomber-browser-fps');
const read=n=>JSON.parse(fs.readFileSync(path.join(r,n)));
const {validate}=require(path.join(r,'validate.js'));
const candidate='30f86aa7f2ebd36a99418412edeeb7da5fd943a9';
const names=cp.execFileSync('git',['diff','--name-only','f09e09c6643997986bbafad69c37adae4906df90',candidate],{cwd:root}).toString().trim().split('\n');
let matched=0;
for(const n of names.filter(n=>n.startsWith('scratch/runs/'))){
 const b=fs.readFileSync(path.join(root,n));
 assert(b.equals(cp.execFileSync('git',['show',candidate+':'+n],{cwd:root,maxBuffer:16*1024*1024})),n);matched++;
}
const s=read('evidence/session1/measurement-raw.json').samples;
assert.equal(s.length,46);
for(const x of s){assert.deepEqual(x.rows.map(y=>[y.owner,y.thread]),[['main',1],['cooperative-921600',2]]);assert.equal(x.rows[1].count,0);assert.equal(x.ownerCount,2);assert.equal(x.rows[0].count-x.gameFrame,26);assert(x.rows.every(y=>y.pairReadMs>=0&&y.pairReadMs<=0.016));}
assert.equal(s[0].gameFrame,27);assert.equal(s.at(-1).gameFrame,121);
assert.equal(s[0].rows[0].count,53);assert.equal(s.at(-1).rows[0].count,147);
const ms=s.at(-1).rows[0].hostMs-s[0].rows[0].hostMs;
assert(Math.abs(ms-4438.655)<1e-6);
const controls=[];
for(const [name,edit] of [
 ['duplicate timestamp',x=>x[1].rows[0].hostMs=x[0].rows[0].hostMs],
 ['reversed timestamp',x=>x[1].rows[0].hostMs=x[0].rows[0].hostMs-1],
 ['nonfinite timestamp',x=>x[1].rows[0].hostMs=NaN],
 ['fractional counter',x=>x[1].rows[0].count+=0.5],
 ['pace enabled',x=>x[1].rows[0].pace=1],
 ['paced event',x=>x[1].rows[0].paced=1],
 ['instance replacement',x=>x[1].rows[0].sameInstance=false],
 ['code changed',x=>x[1].codeMatches=false],
 ['owner added',x=>x[1].ownerCount++],
 ['stopped game',x=>x[1].running=false],
 ['owner missing',x=>x[1].rows.shift()]]){
 const x=structuredClone(s);edit(x);const v=validate(x,'main');assert(!v.accepted&&v.fps===null,name);controls.push(name);
}
// Explicit limits: these require independent inventory/harness evidence.
let x=structuredClone(s);x.forEach(y=>y.rows[0].thread=99);assert(validate(x,'main').accepted);
x=structuredClone(s);x.forEach((y,i)=>y.rows[1].count=i);assert(validate(x,'main').accepted);
const provenance=['host.js','lib/apps.js','lib/renderer.js','lib/thread-manager.js','src/07-decoder.wat','src/07e-uop-compiler.wat','src/09a8-handlers-directx.wat','src/13-exports.wat'];
for(const p of provenance)assert(fs.readFileSync(r+'/provenance/'+p).equals(cp.execFileSync('git',['show','f09e09c6643997986bbafad69c37adae4906df90:'+p],{cwd:root,maxBuffer:4*1024*1024})),p);
const source=cp.execFileSync('git',['grep','-n','(global.set $logical_frame_count','f09e09c6643997986bbafad69c37adae4906df90','--','src'],{cwd:root}).toString().trim().split('\n');assert.equal(source.length,1);
const net=read('evidence/session1/network.json'),mod=read('evidence/session1/module-responses.json')[0];assert(net.some(n=>n.url===mod.url&&n.status===200));
const inputs=read('evidence/session1/inputs.json');assert(inputs.filter(i=>Date.parse(i.at)>=Date.parse(s[0].utc)&&Date.parse(i.at)<=Date.parse(s.at(-1).utc)).every(i=>i.kind==='mouse'));
console.log(JSON.stringify({accepted:true,candidateBlobMatches:matched,sourceCopies:provenance.length,counterWriters:source.length,additionalRejectionControls:controls,validatorLimits:['uniform unauthenticated thread ID accepted','second emitting owner not rejected internally'],samples:s.length,logicalFrames:94,durationMs:ms,fps:94000/ms,networkRecords:net.length,httpErrors:net.filter(n=>n.status>=400),requestFailures:net.filter(n=>n.failure)},null,2));
