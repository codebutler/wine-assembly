'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root='/tmp/maelstrom-select-hook-independent-closeout-oct24/repo';
const hook=require(root+'/tools/maelstrom-select-completion-hook.cjs');
const {Model}=require(root+'/test/maelstrom-select-hook-model.cjs');
const hist='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const sources=Object.fromEntries(Object.keys(hook.PINS).map(p=>[p,fs.readFileSync(path.join(hist,p),'utf8')]));
const w=hook.transform(sources,{enabled:true})['src/09d-winsock.wat'];
let controls=0,failures=0;
function check(name,f){try{f();controls++;console.log('PASS '+name)}catch(e){failures++;console.log('FAIL '+name+': '+e.message)}}
function state(ready=0){const m=new Model(w,ready,100);m.arm();m.select();return {m,s:hook.snapshot(m.exports)}}
check('ordinary park never completes',()=>{const {s}=state();const o={};assert.equal(hook.createOracle(o).accept(o,s).kind,'park')});
check('ordinary positive completion captures stored EAX',()=>{const {s}=state(7);const o={};const r=hook.createOracle(o).accept(o,s);assert.equal(r.kind,'completion');assert.equal(r.result,7)});
check('unused hostile getters remain inert with disabled transform',()=>{const s=new Proxy({},{get(){throw Error('source touched')}});const opts=new Proxy({enabled:false},{get(t,k){if(k==='enabled')return false;throw Error('unused option')}});assert.equal(hook.transform(s,opts),s)});
check('wrong instance rejects',()=>{const {s}=state(1);assert.equal(hook.createOracle({}).accept({},s).kind,'rejected')});
check('stable parked stale EAX mutation rejects',()=>{const {s}=state();const o={};assert.equal(hook.createOracle(o).accept(o,{...s,result:0x53000001}).kind,'rejected')});
check('duplicate park and lost attempt reject',()=>{const {s}=state();const o={};const a=hook.createOracle(o);assert.equal(a.accept(o,s).kind,'park');assert.equal(a.accept(o,s).kind,'rejected');assert.equal(hook.createOracle(o).accept(o,{...s,token:2,entries:2,parks:2}).kind,'rejected')});
check('returned identity copy independent of later plain snapshot mutation',()=>{const {s}=state(3);const o={};const r=hook.createOracle(o).accept(o,s);s.result=99;assert.equal(r.identity.result,3)});
check('wrong API and overflow reject',()=>{const {s}=state(1);for(const v of [{api:935},{token:4097,entries:4097},{pre:0xfffffff0}]){const o={};assert.equal(hook.createOracle(o).accept(o,{...s,...v}).kind,'rejected')}});
// All actual WAT/model state remains a park: no normal completion was executed.
const {m,s}=state();const owner={};let phaseReads=0,resultReads=0;
const hostile=new Proxy(s,{get(t,k){if(k==='phase')return ++phaseReads<=6?2:3;if(k==='result')return ++resultReads<=4?0:0x53000001;return t[k]}});
const actual=hook.createOracle(owner).accept(owner,hostile);
console.log(JSON.stringify({repro:'park-proxy-to-completion',sourceState:hook.snapshot(m.exports),actual,phaseReads,resultReads,expected:'park or rejected; never completion',realWasm:false}));
check('hostile proxy cannot manufacture completion from actual parked state',()=>assert.notEqual(actual.kind,'completion'));
// Getter exceptions must not leave reusable validation state.
check('throwing snapshot closes oracle',()=>{const {s}=state(2);const o={},oracle=hook.createOracle(o),sentinel={};try{oracle.accept(o,new Proxy(s,{get(){throw sentinel}}))}catch(e){assert.equal(e,sentinel)}assert.equal(oracle.accept(o,s).kind,'rejected')});
console.log(JSON.stringify({controls,failures}));process.exitCode=failures?1:0;
