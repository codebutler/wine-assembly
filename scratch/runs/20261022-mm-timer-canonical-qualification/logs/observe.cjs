'use strict';
// Evidence only: observe unmodified full-tree compiler output and real instantiation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const root=process.cwd(),tag=path.basename(process.argv[1],'.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record={test:process.argv[1],argv:process.argv,node:process.version,nodeSha256:sha(fs.readFileSync(process.execPath)),assertions:{attempted:0,passed:0},compiles:[],instantiations:[]};
const nativeLoad=Module._load,originalAssert=require('assert');
const wrap=fn=>function(...args){record.assertions.attempted++;const out=Reflect.apply(fn,this,args);record.assertions.passed++;return out;};
const methods=new Map();const observedAssert=new Proxy(originalAssert,{apply(t,self,args){return wrap(t).apply(self,args)},get(t,p){const v=t[p];if(typeof v!=='function'||p==='AssertionError')return v;if(!methods.has(p))methods.set(p,wrap(v));return methods.get(p);}});
Module._load=function(request,parent,isMain){return request==='assert'||request==='node:assert'?observedAssert:nativeLoad.apply(this,arguments)};
const closureTools=require(path.join(root,'tools/watx-closure'));
const baseline=closureTools.watxSourceClosure(),compile=closureTools.compileClosure;
closureTools.compileClosure=function(closure,options){
 const changed=[];
 for(const [k,v] of closure.vfs){if(k.includes('/'))continue;const before=baseline.vfs.get(k);if(v!==before){if(k!=='13-exports.wat'||!v.startsWith(before))throw new Error('unexpected production source replacement: '+k);changed.push({file:k,originalSha256:sha(before),transformedSha256:sha(v),appendedBytes:Buffer.byteLength(v.slice(before.length))});}}
 if(closure.source!==baseline.source)throw new Error('entry source changed');
 const r=compile.apply(this,arguments);
 if(r?.wasmBinary){const b=Buffer.from(r.wasmBinary),h=sha(b);fs.writeFileSync(path.join(root,'evidence',tag+'.wasm'),b);record.compiles.push({entry:closure.entry,options,baselineFiles:[...baseline.vfs.keys()].filter(k=>!k.includes('/')).length,changed,bytes:b.length,sha256:h});}
 return r;
};
const instantiate=WebAssembly.instantiate;
WebAssembly.instantiate=async function(bytes,imports){if(bytes instanceof WebAssembly.Module)throw new Error('unobservable precompiled module');const b=Buffer.from(bytes);record.instantiations.push({sha256:sha(b),bytes:b.length,hostImports:Object.keys(imports.host||{}).length,realWebAssembly:true});return instantiate.apply(this,arguments)};
process.on('exit',code=>{record.exitCode=code;fs.writeFileSync(path.join(root,'evidence',tag+'.identity.json'),JSON.stringify(record,null,2));console.log('QUALIFICATION_IDENTITY '+JSON.stringify(record));});
