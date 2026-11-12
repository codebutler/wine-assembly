'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),Module=require('module');
const tool=path.join(process.cwd(),'tools/maelstrom-native-errno-latch.cjs');
let hook=require(tool);
if(process.argv.includes('--repeat-read')) {
  const text=fs.readFileSync(tool,'utf8');
  assert.equal(text.split('input[p] = source;').length,2);
  const m=new Module(tool,module);m.filename=tool;m.paths=module.paths;
  m._compile(text.replace('input[p] = source;','input[p] = sources[p];'),tool);hook=m.exports;
}
const src=Object.fromEntries(Object.keys(hook.PINS).map(p=>[p,fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
const opt={enabled:true,crtLoadedBase:0x522000,binaries:{net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)}};
const old=require('/tmp/maelstrom-native-errno-successor-latch-oct25/repo/tools/maelstrom-native-errno-latch.cjs');
const expected=old.transform(src,opt), keys=Object.keys(src);let groups=0;
function test(name,f){f();groups++;console.log('PASS '+name);}
test('stable emitted fragments identical to original reviewed semantic tree',()=>assert.deepEqual(hook.transform(src,opt),expected));
test('all inherited nonenumerable accessors are captured once with no fallback read',()=>{
  const proto={},reads={};for(const p of keys)Object.defineProperty(proto,p,{get(){assert.equal(reads[p],undefined,'second read '+p);reads[p]=1;return src[p];}});
  assert.deepEqual(hook.transform(Object.create(proto),opt),expected);assert.deepEqual(Object.keys(reads),keys);
});
test('proxy sees only one get per pinned path without descriptors/enumeration',()=>{
  const reads={};const proxy=new Proxy(Object.create(null),{get(t,p){assert(keys.includes(p));assert.equal(reads[p],undefined);reads[p]=1;return src[p];},ownKeys(){throw Error('enumeration');},getOwnPropertyDescriptor(){throw Error('descriptor');},has(){throw Error('has');}});
  assert.deepEqual(hook.transform(proxy,opt),expected);assert.equal(Object.keys(reads).length,keys.length);
});
test('bad first value at every path rejects once before alternate authentic value',()=>{
  for(const p of keys){let reads=0;const input={...src};Object.defineProperty(input,p,{get(){reads++;return reads===1?src[p]+'\n;; invalid':src[p];}});assert.throws(()=>hook.transform(input,opt),/source pin/);assert.equal(reads,1);}
});
test('throwing first getter propagates same error without retry for every path',()=>{
  for(const p of keys){let reads=0;const marker=new Error(p),input={...src};Object.defineProperty(input,p,{get(){reads++;throw marker;}});assert.throws(()=>hook.transform(input,opt),e=>e===marker);assert.equal(reads,1);}
});
test('later getters cannot redirect earlier captured fragments',()=>{
  const input={},reads={};keys.forEach((p,i)=>Object.defineProperty(input,p,{configurable:true,get(){reads[p]=(reads[p]||0)+1;if(i)Object.defineProperty(input,keys[i-1],{get(){throw Error('earlier source reread');}});return src[p];}}));
  assert.deepEqual(hook.transform(input,opt),expected);assert(keys.every(p=>reads[p]===1));
});
test('boxed or coercible source rejected without invoking coercion',()=>{
  const p=keys[0];assert.throws(()=>hook.transform({...src,[p]:{toString(){throw Error('coercion invoked');}}},opt),/source pin/);
});
test('disabled source and unused options have zero reads and preserve object identity',()=>{
  let touches=0;const trap=()=>{touches++;throw Error('disabled touch');};const input=new Proxy({}, {get:trap,ownKeys:trap,getOwnPropertyDescriptor:trap,has:trap});
  for(const enabled of [false,undefined,0,null,'true',1]){let reads=0;const options=new Proxy({enabled},{get(t,p){assert.equal(p,'enabled');reads++;return t[p];},ownKeys:trap});assert.equal(hook.transform(input,options),input);assert.equal(reads,1);}assert.equal(touches,0);
});
console.log(JSON.stringify({groups,pass:true,outputHashes:Object.fromEntries(Object.entries(expected).map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]))}));
