'use strict';
// Canonical, uninstrumented qualification. Only main() may construct a Module.
// Run with the pinned --require byte guard; never instantiate or execute guests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const CONTRACT_SHA256='4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b';
const SOURCE_REVISION='a3fe340b962da3f31df249881074afe41d6c69a2';
const SOURCE_CLOSURE_SHA256='e9c212ccd85445de89271af25660b331b548f8cb2d40ffa5271b312c6c0e699d';
const COMPILER_SHA256='d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33';
function pinned(row){const b=fs.readFileSync(row.path);assert.equal(sha(b),row.sha256,`pinned hash: ${row.path}`);if(row.bytes!==undefined)assert.equal(b.length,row.bytes);return b;}
function load(contractPath){
 // This authority is part of the reviewed qualifier, never supplied by the
 // contract it authenticates. Exact bytes include every input identity/path.
 // Provenance: candidate 806117a11f1b347340b5cc44fb52b79d0ac200e5,
 // independently sealed source receipt and complete canonical build inventory.
 const contractBytes=fs.readFileSync(contractPath);
 assert.equal(sha(contractBytes),CONTRACT_SHA256,'independent contract authority');
 const c=JSON.parse(contractBytes);assert.equal(c.version,1);
 for(const p of Object.values(c.inputs))pinned(p);
 pinned(c.helper);pinned(c.guard);pinned(c.qualifierHistorical);
 const binding=JSON.parse(pinned(c.sourceBinding));assert.equal(binding.passed,true);assert.equal(binding.candidate,c.candidate);
 const expected=JSON.parse(pinned(c.inputs['expected-abi-layout.json']));
 const statics=JSON.parse(pinned(c.inputs['static-abi.json']));
 const closure=JSON.parse(pinned(c.inputs['closure.json']));
 assert.equal(c.candidate,SOURCE_REVISION,'source revision');
 assert.equal(closure.candidate,SOURCE_REVISION,'closure source revision');
 assert.equal(binding.candidate,SOURCE_REVISION,'receipt source revision');
 assert.equal(closure.closureSHA256,SOURCE_CLOSURE_SHA256,'source closure identity');
 const closureRows=closure.files.map(r=>`${r.path} ${r.sha256}`).sort();
 assert.equal(new Set(closure.files.map(r=>r.path)).size,closure.files.length,'unique source inventory');
 assert.equal(sha(Buffer.from(closureRows.join('\n')+'\n')),SOURCE_CLOSURE_SHA256,'complete source inventory');
 assert.equal(binding.closureSHA256,SOURCE_CLOSURE_SHA256,'receipt closure identity');
 assert.equal(binding.sourceFilesVerified,closure.files.length,'receipt verified source inventory');
 assert.equal(binding.combinedSHA256,closure.combinedSHA256,'receipt expanded source identity');
 assert.equal(closure.compilerFullSHA256,COMPILER_SHA256,'closure compiler identity');
 assert.equal(binding.compilerSHA256,COMPILER_SHA256,'receipt compiler identity');
 assert.equal(binding.compilerPath,closure.compilerPath,'receipt compiler path');
 pinned({path:binding.compilerPath,sha256:COMPILER_SHA256});
 pinned(binding.historicalSourceEvidence);
 assert.deepEqual(binding.diagnosticExportsAbsent,['set_null_diag','null_diag_field','null_diag_token','null_diag_root'],'source diagnostic absence inventory');
 for(const name of binding.diagnosticExportsAbsent)assert(!Object.hasOwn(expected.exports,name),'uninstrumented source exports');
 assert.equal(binding.layout.entries,expected.regions.length,'receipt complete layout inventory');
 assert.equal(binding.layout.hash,expected.layout);assert.equal(binding.sourceDerivedImports,expected.imports.length);assert.equal(binding.sourceDerivedFunctionExports,Object.keys(expected.exports).length);
 assert.equal(sha(Buffer.from(expected.serialization)).slice(0,16),expected.layout);assert.equal(expected.regions.length,269);
 return {c,expected,statics};
}
function select(c,file,expected){
 assert.equal(path.resolve(file),file,'explicit absolute path required');assert.equal(fs.realpathSync(file),file,'no symlink adaptation');
 const row=c.allowed.find(r=>r.path===file);assert(row,'path not allowed');assert.equal(expected,row.sha256,'expected hash not allowed');return row;
}
const VT={127:'i32',126:'i64',125:'f32',124:'f64',123:'v128',112:'funcref',111:'externref'};
class Reader{
 constructor(b){this.b=b;this.p=0;}
 byte(){assert(this.p<this.b.length,'truncated');return this.b[this.p++];}
 leb(){let n=0,m=1;for(let i=0;i<5;i++){const c=this.byte();if(i===4)assert(c<16,'u32 overflow');n+=(c&127)*m;if(!(c&128))return n;m*=128;}throw Error('LEB overflow');}
 take(n){assert(n<=this.b.length-this.p,'section overrun');const b=this.b.subarray(this.p,this.p+n);this.p+=n;return b;}
 name(){const b=this.take(this.leb()),s=b.toString('utf8');assert(Buffer.from(s).equals(b),'invalid utf8');return s;}
 vec(fn){const n=this.leb();assert(n<=this.b.length,'unbounded vector');return Array.from({length:n},fn);}
 end(){assert.equal(this.p,this.b.length,'section trailing bytes');}
}
function limits(r){const flags=r.leb();assert([0,1,3].includes(flags),'limits flags');return {flags,min:r.leb(),max:flags&1?r.leb():null,shared:!!(flags&2)};}
function parse(b){
 assert(b.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0])),'wasm header');
 const r=new Reader(b.subarray(8)),sections=new Map(),custom=[];
 while(r.p<r.b.length){const id=r.byte(),body=r.take(r.leb());assert.notEqual(id,8,'start section forbidden');
  if(id===0){const c=new Reader(body);custom.push({name:c.name(),payloadHex:c.b.subarray(c.p).toString('hex'),bytes:c.b.length-c.p});}
  else {assert(!sections.has(id),'duplicate section');sections.set(id,body);}}
 const rd=id=>{assert(sections.has(id),`section ${id} missing`);return new Reader(sections.get(id));};
 let t=rd(1);const vt=()=>{const v=VT[t.byte()];assert(v,'unknown value type');return v;};
 const types=t.vec(()=>{assert.equal(t.byte(),96,'function type');return {params:t.vec(vt),results:t.vec(vt)};});t.end();
 const signature=i=>{assert(i<types.length,'type index');return types[i];};
 t=rd(2);const funcs=[],memories=[],imports=t.vec(()=>{const module=t.name(),name=t.name(),kind=t.byte();
  if(kind===0){const s=signature(t.leb());funcs.push(s);return {module,name,kind,signature:s};}
  assert.equal(kind,2,'unexpected import kind');const l=limits(t);memories.push(l);return {module,name,kind,limits:l};});t.end();
 t=rd(3);funcs.push(...t.vec(()=>signature(t.leb())));t.end();
 if(sections.has(5)){t=rd(5);memories.push(...t.vec(()=>limits(t)));t.end();}
 t=rd(7);const names=new Set(),exports=t.vec(()=>{const name=t.name(),kind=t.byte(),index=t.leb();assert(!names.has(name),'duplicate export');names.add(name);
  if(kind===0){assert(index<funcs.length,'function index');return {name,kind,index,signature:funcs[index]};}
  assert.equal(kind,2,'unexpected export kind');assert(index<memories.length,'memory index');return {name,kind,index,limits:memories[index]};});t.end();
 return {types,imports,exports,memories,customSections:custom,noStart:true};
}
function metadata(actual,expected,prior){
 assert.equal(actual.noStart,true,'noStart');assert.deepEqual(actual.types,prior.types,'complete binary type inventory');
 assert.deepEqual(actual.imports,expected.imports,'complete imports and signatures');
 assert.deepEqual(actual.memories,[{flags:3,min:8192,max:32768,shared:true}],'exact shared imported memory');
 const names=new Set();for(const e of actual.exports){assert(!names.has(e.name),'duplicate export');names.add(e.name);}
 const functions=Object.fromEntries(actual.exports.filter(e=>e.kind===0).map(e=>[e.name,e.signature]));
 assert.deepEqual(functions,expected.exports,'complete source function exports and signatures');
 assert.deepEqual(actual.exports.filter(e=>e.kind!==0),[{name:'memory',kind:2,index:0,limits:{flags:3,min:8192,max:32768,shared:true}}],'exact memory export');
 assert.deepEqual(actual.customSections,[{name:'wine-region-layout',payloadHex:Buffer.from(expected.layout).toString('hex'),bytes:16}],'complete layout/custom contract');
}
function byteHash(b,row){assert.equal(b.length,row.bytes,'binary bytes');assert.equal(sha(b),row.sha256,'binary hash');}
function baseline(c,prior,file){
 // Re-execute the EXACT historical driver against retained parsed metadata.
 // This facade is static replay, never a native compile. The actual earlier
 // native-return/assertion-failure receipt is retained separately, unchanged.
 const vm=require('node:vm');let called=0;
 class StaticModule{constructor(b){assert(Buffer.isBuffer(b));called++;}static imports(){return prior.imports.map(({module,name,kind})=>({module,name,kind:kind===0?'function':'memory'}));}static exports(){return prior.exports.map(({name,kind})=>({name,kind:kind===0?'function':'memory'}));}static customSections(){return [Buffer.from('9a3bc9149d58209c')];}}
 const row=c.allowed.find(r=>r.path===file);assert(row);
 let error;try{vm.runInNewContext(pinned(c.qualifierHistorical).toString(),{require,process:{argv:['node',c.qualifierHistorical.path,file,row.sha256]},WebAssembly:{Module:StaticModule},console:{log(){throw Error('historical unexpectedly passed');}}},{timeout:1000});}catch(e){error=e;}
 assert.equal(called,1,'historical reached Module callsite');assert(error);assert.equal(error.code,'ERR_ASSERTION');assert.equal(error.message,'set_null_diag');
 return {staticReplay:true,driverSHA256:c.qualifierHistorical.sha256,moduleFacadeCalls:called,expectedFailure:error.message,nativeRecompiled:false};
}
function main(){
 const [contractPath,file,expectedHash]=process.argv.slice(2),{c,expected,statics}=load(contractPath);
 assert(require.cache[c.guard.path],'pinned guard must be preloaded');
 const row=select(c,file,expectedHash),b=fs.readFileSync(file);assert(Buffer.isBuffer(b));byteHash(b,row);
 const prior=statics.outputs.find(o=>o.file===file);assert(prior);assert.equal(prior.sha256,row.sha256);
 const actual=parse(b);metadata(actual,expected,prior);
 const mod=new WebAssembly.Module(b); // Exact accepted synchronous Buffer callsite; unchanged bytes, no options.
 const imports=WebAssembly.Module.imports(mod),exports=WebAssembly.Module.exports(mod);
 assert.deepEqual(imports,actual.imports.map(({module,name,kind})=>({module,name,kind:kind===0?'function':'memory'})));
 assert.deepEqual(exports,actual.exports.map(({name,kind})=>({name,kind:kind===0?'function':'memory'})));
 const layout=WebAssembly.Module.customSections(mod,'wine-region-layout');assert.equal(layout.length,1);assert.equal(Buffer.from(layout[0]).toString(),expected.layout);
 console.log(JSON.stringify({state:'MODULE_QUALIFICATION_PASS',file,sha256:row.sha256,bytes:b.length,source:c.candidate,sourceContractSHA256:c.sourceBinding.sha256,guardSHA256:c.guard.sha256,qualifierSHA256:sha(fs.readFileSync(__filename)),imports:imports.length,functionExports:Object.keys(expected.exports).length,typeCount:actual.types.length,layout:expected.layout,noStart:true,nativeModuleReturned:true,Memory:false,Instance:false,guest:false}));
}
module.exports={sha,pinned,load,select,parse,metadata,byteHash,baseline};
if(require.main===module)main();
