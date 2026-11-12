'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const hook=require(path.join(process.cwd(),'tools/maelstrom-native-errno-latch.cjs'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=Object.fromEntries(Object.keys(hook.PINS).map(p=>[p,fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
const binaries={net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)};
const options={enabled:true,binaries,crtLoadedBase:0x522000};
const key='src/07-decoder.wat',expected=hook.PINS[key];
const baseline=hook.transform(sources,options);
assert.equal(sha(baseline[key]),expected);
const changed=sources[key].replace('(then (call $te (i32.const 119) (global.get $d_pc))','(then (call $te (i32.const 120) (global.get $d_pc))');
assert.notEqual(changed,sources[key]);
// Plain altered input must, and does, reject. This isolates the getter gap.
assert.throws(()=>hook.transform({...sources,[key]:changed},options),/source pin/);
let reads=0;const varying={...sources};
Object.defineProperty(varying,key,{enumerable:true,get(){return ++reads<=2?sources[key]:changed;}});
let returned,threw;
try{returned=hook.transform(varying,options);}catch(e){threw=String(e);}
const actual=returned&&sha(returned[key]);
const receipt={candidate:'4542e115ac2b1e0cca6748bd00cdce2b4f781199',toolSHA256:sha(fs.readFileSync(path.join(process.cwd(),'tools/maelstrom-native-errno-latch.cjs'))),key,expected,baselineSHA256:sha(baseline[key]),plainAlteredRejected:true,getterReads:reads,getterReturned:!!returned,getterThrew:threw||null,actualSHA256:actual||null,changedSHA256:sha(changed),defect:!!returned&&actual!==expected,qualification:'Enabled JS transform only; no compilation or execution. CLI uses stable plain values and is not demonstrated affected.'};
fs.writeFileSync(path.join(__dirname,'pin-repro-results.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
// This independent acceptance invariant must fail for the candidate.
assert(!receipt.defect,'Enabled transform accepted unpinned decoder source via third getter read');
