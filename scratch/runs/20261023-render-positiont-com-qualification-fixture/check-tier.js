'use strict';
// Validate the actual candidate Git filename inventory plus the two new tests.
// Metadata-only adapter because this task intentionally has a focused checkout.
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const names=JSON.parse(fs.readFileSync(path.join(__dirname,'candidate-test-names.json'),'utf8'))
 .filter(p=>/^test\/[^/]+$/.test(p)).map(p=>p.slice(5));
names.push('test-d3d9-positiont-com-qualification.js','test-d3d9-positiont-com-qualification-guard.js');
const {validateTiers}=require(path.join(root,'tools/test-tiers'));
const original=fs.readdirSync;
fs.readdirSync=function(p,options){
 if(path.resolve(p)===path.join(root,'test')&&options?.withFileTypes)
  return [...new Set(names)].map(name=>({name,isFile:()=>true}));
 return original.apply(this,arguments);
};
let result;
try{result=validateTiers(root);}finally{fs.readdirSync=original;}
assert.deepStrictEqual(result.errors,[]);
console.log(JSON.stringify({result:'PASS',basis:'exact candidate Git filenames plus two fixture tests; metadata only',
 total:result.actual.length,tiers:Object.fromEntries(Object.entries(result.tiers).map(([k,v])=>[k,v.length]))}));
