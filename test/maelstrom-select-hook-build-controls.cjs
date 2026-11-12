'use strict';
// Focused emitted-source ordering controls; no compiler or native execution.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const hook=require('../tools/maelstrom-select-completion-hook.cjs');
const root='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const H=path.resolve(__dirname,'../../ops');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=Object.fromEntries(Object.keys(hook.PINS).map(p=>[p,fs.readFileSync(root+'/'+p,'utf8')]));
const transformed=hook.transform(input,{enabled:true});
const seals=JSON.parse(fs.readFileSync(H+'/build-inputs.json')).overlays;
for(const r of seals)assert.equal(sha(transformed[r.path]),r.transformedSHA256);
const s=transformed['src/09d-winsock.wat'];
const completion='(call $msc_end (local.get $msc_token) (i32.const 3))';
const park='(call $msc_end (local.get $msc_token) (i32.const 2))';
const store='(i32.store offset=0 (global.get $reg_base) (local.get $total))';
const body=s.slice(s.indexOf('  (func $handle_select '),s.indexOf('\n  ;; __WSAFDIsSet'));
function verify(b){
 assert.equal(b.split(completion).length-1,1);
 assert.equal(b.split(park).length-1,2);
 assert(b.includes(store+'\n    '+completion+')'));
 assert.equal(b.split('(call $vsock_block (i32.const 24))\n            '+park+' (return)').length-1,2);
}
verify(body);
const mutations=[
 ['completion before actual EAX store',body.replace(store+'\n    '+completion,completion+'\n    '+store)],
 ['park as completion',body.replace(park,completion)],
 ['missing result store',body.replace(store,'')],
 ['erased completion',body.replace(completion,'')]
];
for(const [name,b]of mutations)assert.throws(()=>verify(b),undefined,name);
const native=JSON.parse(fs.readFileSync(H+'/native-result.json'));
assert.equal(native.status,'PASS');
const [p1,p2,c]=native.snapshots.map(r=>r.capture);
function checkPark(p){assert.equal(p.phase,2);assert.equal(p.result,0);assert.equal(p.completions,0);assert.equal(p.post,p.pre);}
function checkCompletion(p){assert.equal(p.phase,3);assert.equal(p.result,1);assert.equal(p.post,p.pre+24);assert.equal(p.completions,1);}
[p1,p2].forEach(checkPark);checkCompletion(c);
assert.throws(()=>checkPark({...p1,phase:3,result:0x5a170123,completions:1}));
assert.throws(()=>checkCompletion({...c,result:0x5a170123}));
const out={status:'PASS',transformedInputsSealed:true,sourceControlsRejected:mutations.map(x=>x[0]),
 runtimeEvidenceControlsRejected:['park with stale EAX completion','completion retaining pre-store stale EAX'],
 scope:'Source/evidence mutations only; actual accepted source and actual binary unchanged. No mutant native execution.',
 moduleSHA256:native.moduleSHA256};
fs.writeFileSync(H+'/focused-controls.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
