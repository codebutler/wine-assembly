'use strict';
// Static adversarial tests. No WebAssembly APIs or native constructor calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const q=require('./qualify.cjs'),[contract,outdir]=process.argv.slice(2);
fs.mkdirSync(outdir,{recursive:true});
const original=fs.readFileSync(contract),c=JSON.parse(original),results=[];
let serial=0;
function save(name,value){const p=path.join(outdir,name);fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');return {path:p,sha256:q.sha(fs.readFileSync(p))};}
function rejected(name,edit){
 const changed=structuredClone(c);edit(changed);
 const p=save('contract-'+(++serial)+'.json',changed).path;
 // Observe the boundary: no contract-selected input may be read first.
 const read=fs.readFileSync,reads=[];
 fs.readFileSync=function(file,...args){reads.push(String(file));return read.call(this,file,...args);};
 try{assert.throws(()=>q.load(p),/independent contract authority/,name);}finally{fs.readFileSync=read;}
 assert.deepEqual(reads,[p],name+': reject before input reads or constructor');
 results.push({name,rejected:true,onlyContractRead:true});
}
const receipt=JSON.parse(fs.readFileSync(c.sourceBinding.path));
rejected('plausible nonzero source receipt with coordinated self-hash',x=>{
 const b={...receipt,sourceFilesVerified:141,closureSHA256:'a'.repeat(64),compilerSHA256:'b'.repeat(64),compilerPath:'/other/compiler'};
 x.sourceBinding=save('plausible-source.json',b);
});
rejected('different revision in both contract and source receipt',x=>{
 x.candidate='123456789abcdef0123456789abcdef0123456789';
 x.sourceBinding=save('different-revision.json',{...receipt,candidate:x.candidate});
});
rejected('same genuine receipt at attacker-controlled path',x=>{x.sourceBinding=save('relocated-source.json',receipt);});
rejected('source receipt claims success with incomplete inventory',x=>{
 x.sourceBinding=save('incomplete-source.json',{...receipt,sourceFilesVerified:139,passed:true});
});
rejected('coordinated ABI counts layout and source receipt',x=>{
 const expected=JSON.parse(fs.readFileSync(x.inputs['expected-abi-layout.json'].path));
 expected.imports.pop();delete expected.exports.get_eax;
 expected.regions.pop();expected.serialization='attacker layout';expected.layout=q.sha(Buffer.from(expected.serialization)).slice(0,16);
 x.inputs['expected-abi-layout.json']=save('forged-expected.json',expected);
 x.sourceBinding=save('matching-counts.json',{...receipt,sourceDerivedImports:expected.imports.length,sourceDerivedFunctionExports:Object.keys(expected.exports).length,layout:{hash:expected.layout,entries:expected.regions.length,reusedIndependentInventory:true}});
});
rejected('coordinated source compiler and closure identities',x=>{
 const m=JSON.parse(fs.readFileSync(x.inputs['closure.json'].path));
 m.files.pop();m.closureSHA256=q.sha(Buffer.from(m.files.map(r=>`${r.path} ${r.sha256}`).sort().join('\n')+'\n'));
 m.compilerFullSHA256='c'.repeat(64);m.compilerPath='/different/compiler';
 x.inputs['closure.json']=save('forged-closure.json',m);
 x.sourceBinding=save('matching-closure.json',{...receipt,sourceFilesVerified:m.files.length,closureSHA256:m.closureSHA256,compilerSHA256:m.compilerFullSHA256,compilerPath:m.compilerPath});
});
for(const name of ['helper','guard','qualifierHistorical'])rejected('replace '+name+' and hash',x=>{x[name]=save(name+'.json',{substitute:name});});
rejected('change binary path hash and size together',x=>{x.allowed[0]={path:'/other/module.wasm',sha256:'d'.repeat(64),bytes:1234};});
rejected('remove a complete input identity',x=>{delete x.inputs['build.cjs'];});
rejected('supplied authority override',x=>{x.contractSHA256=q.sha(original);x.trustAnchor={source:c.candidate,sha256:q.sha(original)};});
// Exact bytes may live at another contract filename; authority is not its name.
const copy=path.join(outdir,'exact-contract.json');fs.writeFileSync(copy,original);
const accepted=q.load(copy);assert.deepEqual(accepted.c,c);
results.push({name:'legitimate exact contract at another filename',passed:true});
fs.writeFileSync(path.join(outdir,'results.json'),JSON.stringify({state:'TRUST_ANCHOR_CONTROLS_PASS',results,WebAssemblyAPIsUsed:false},null,2)+'\n');
console.log(JSON.stringify({state:'TRUST_ANCHOR_CONTROLS_PASS',rejections:results.filter(x=>x.rejected).length,legitimateExactContract:true}));
