'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const h=require('../repo/tools/maelstrom-select-completion-hook.cjs');
const n=JSON.parse(fs.readFileSync(__dirname+'/native-result.json'));
let rejected=[];
function fixture(){let state={...n.snapshots[0].capture};const exports=Object.fromEntries(h.FIELDS.map(k=>['msc_'+k,()=>state[k]]));const owner={};return {owner,exports,set:s=>state={...s}};}
{const f=fixture(),o=h.createOracle(f.owner,f.exports);for(const row of n.snapshots){f.set(row.capture);assert.equal(o.accept(f.owner,h.snapshot(f.exports)).kind,row.accepted.kind);}}
for(const name of ['forged completion','stale authentic capture','wrong source','wrong owner','stale EAX mutation','reused completion']){
 const f=fixture(),o=h.createOracle(f.owner,f.exports);let s=h.snapshot(f.exports),owner=f.owner;
 if(name==='forged completion')s={...n.snapshots[2].capture};
 if(name==='stale authentic capture')h.snapshot(f.exports);
 if(name==='wrong source'){const other=fixture();s=h.snapshot(other.exports);}
 if(name==='wrong owner')owner={};
 if(name==='stale EAX mutation')s.result=0x5a170123;
 if(name==='reused completion'){assert.equal(o.accept(owner,s).kind,'park');f.set(n.snapshots[1].capture);assert.equal(o.accept(owner,h.snapshot(f.exports)).kind,'park');f.set(n.snapshots[2].capture);s=h.snapshot(f.exports);assert.equal(o.accept(owner,s).kind,'completion');}
 assert.equal(o.accept(owner,s).kind,'rejected',name);rejected.push(name);
}
const out={status:'PASS',rejected,qualification:'Synthetic trusted export replay of sealed native records; no native execution or cryptographic authentication of JSON claimed'};
fs.writeFileSync(__dirname+'/capture-controls.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
