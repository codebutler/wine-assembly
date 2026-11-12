'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const path=require('node:path');
const R=path.resolve(__dirname,'../../repo');
const select=require(R+'/tools/maelstrom-select-completion-hook.cjs');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const ROOT='/home/user/wine-assembly';
const supplied=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(0)).toString('utf8'));
const input=supplied.current;
for(const [p,h]of Object.entries(select.PINS))assert.equal(sha(input[p]),h,p);
const original={...input};
assert.equal(select.transform(input,{enabled:false}),input);
const output=select.transform(input,{enabled:true});
assert.deepEqual(input,original,'input remains unchanged');
const changed=Object.keys(input).filter(p=>input[p]!==output[p]);
assert.deepEqual(changed.sort(),['src/09b-dispatch.wat','src/09d-winsock.wat']);
assert(output['src/09b-dispatch.wat'].includes('(local.get $msc_thread) (local.get $msc_regs)'));
assert(!output['src/09b-dispatch.wat'].includes('$null_diag_event'));
assert.equal(output['src/13-exports.wat'],input['src/13-exports.wat']);
let rejects=0;
for(const p of Object.keys(input)){
 assert.throws(()=>select.transform({...input,[p]:input[p]+'\n;changed'},{enabled:true}),/historical source pin/);rejects++;
}
// The two migrated pins must reject their exact historical fragments too.
for(const p of ['src/09b-dispatch.wat','src/13-exports.wat']){
 const old=supplied.historical[p];
 assert.notEqual(sha(old),select.PINS[p]);
 assert.throws(()=>select.transform({...input,[p]:old},{enabled:true}),/historical source pin/);rejects++;
}
// The parser configuration remains mount-free; test the exact canonical parser.
const runner=fs.readFileSync(ROOT+'/test/run.js','utf8');
const parser=runner.slice(runner.indexOf('const getArg ='),runner.indexOf('// Was `--name=...`'));
assert.equal(sha(parser),'aa2d16119b2edc62abc08862fc7c3ea28a98bdc7fb4d28161937a1f705e4621e');
const parsed=Function('args',parser+';return {tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}')([]);
assert.deepEqual(parsed,{tree:[],mount:[]});
console.log(JSON.stringify({status:'PASS',scope:'pin-migration and canonical empty-mount parser only; no compiler/runtime',rejects,changed,transformedHashes:Object.fromEntries(changed.map(p=>[p,sha(output[p])])),sourcePins:select.PINS,actualMountArgv:[],intendedFiles:[],parserSHA256:sha(parser)}));
