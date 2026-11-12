'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../repo');
const {parse}=require(root+'/test/maelstrom-select-hook-model.cjs');
const old=require(root+'/tools/independent-baseline.cjs');
const repaired=require(root+'/tools/maelstrom-native-errno-latch.cjs');
const a={selectRet:0x7a3362,successor:0x7a3366,frame:0x124,crtEntryRva:0xc430,crtTailRva:0xc435,crtRetRva:0xc438};
const diagnostic=n=>Array.isArray(n)&&n[0]==='global.set'&&n[1].startsWith('$mne_reject');
const set5=n=>JSON.stringify(n)==='["global.set","$mne_status",["i32.const","5"]]';
const atoms=n=>n[0]==='i32.or'?n.slice(1).flatMap(atoms):
  JSON.stringify(n)==='["i32.const","0"]'?[]:[n];
let normalizedGuards=0;
function norm(n){
  if(!Array.isArray(n))return n;
  let out=n.filter(x=>!diagnostic(x)).map(norm);
  // Explicit return after rejection in a terminal then block is equivalent to
  // falling off the end of mne_uop_switch, which has no subsequent instruction.
  if(out[0]==='then'&&set5(out[1])&&out.length<=3&&
     (out.length===2||JSON.stringify(out[2])==='["return"]'))return ['reject'];
  const seq=[];
  for(const x of out){
    if(Array.isArray(x)&&x[0]==='if'&&x.length===3&&x[2][0]==='reject'){
      for(const atom of atoms(x[1])){seq.push(['reject-if',atom]);normalizedGuards++;}
    }else seq.push(x);
  }
  return seq;
}
const result=[];
for(const uop of [false,true]){
  const x=norm(parse(old.storage(a,0x522000,uop))),y=norm(parse(repaired.storage(a,0x522000,uop)));
  assert.deepEqual(y,x,'Only diagnostic writes and terminal return may differ: uop='+uop);
  result.push({uop,exactNormalizedAST:true});
}
// Everything outside storage (PE/native/source pins, all anchors, eligibility,
// mapper and transform insertion/normalization sites) is byte identical.
const fs=require('node:fs');
const oldSource=fs.readFileSync(root+'/tools/independent-baseline.cjs','utf8');
const newSource=fs.readFileSync(root+'/tools/maelstrom-native-errno-latch.cjs','utf8');
assert.equal(oldSource.slice(oldSource.indexOf('function transform('),oldSource.indexOf('module.exports')),
  newSource.slice(newSource.indexOf('function transform('),newSource.indexOf('module.exports')));
for(const key of ['PINS','UOP_PINS','BINARY_PINS','FIELDS','DIAGNOSTIC_FIELDS','REJECTION_REASONS','NET_ANCHORS','NET_LAYOUT','SELECT_RETURN'])
  assert.deepEqual(repaired[key],old[key],key);
console.log(JSON.stringify({schema:'ordered-predicate-equivalence/v1',result,normalizedGuards,
  transformByteIdentical:true,pinAndAcceptedCodeMapsIdentical:true,
  qualification:'source AST normalization only; no compiler/native/runtime proof'}));
