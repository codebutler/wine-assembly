 'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),cp=require('child_process');
const repo=path.resolve(__dirname,'../../..'),results=[];
const actual=['test/render-helper.js','test/render-artifact.js','test/compile-src.js','tools/watx-closure.js','tools/watx.js','lib/wat-manifest.js','test/test-d3d-software-compaction.js','test/test-d3d-software-ctx-arena-reuse.js'];
const extra='EXTRA-\ud800';let dir;
function put(f,b){f=path.join(dir,f);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b);}
function stage(n){return `function compile(s,v,o){
 if(s!=='(module (include "./13-exports.wat"))')throw Error('entry semantics');
 const b=v.get('13-exports.wat');
 if(b!==v.get('./13-exports.wat')||b!==v.get('src/13-exports.wat'))throw Error('three aliases');
 if(b!=='é\\n'+${JSON.stringify(extra)}+'\\n'&&b!=='é')throw Error('decode/transform exact UTF16');
 if(o.mode!=='production'||o.standardWat!==true||o.runtimeBuiltins!==false||o.strictDeclarations!==true)throw Error('canonical options');
 return {success:true,wasmBinary:Uint8Array.from([0,97,115,109,1,0,0,0,0,3,1,120,${n}+(o.tailCalls?0:30)])};}`;}
function setup(rev){
 dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'independent-'));
 for(const f of actual){let b=fs.readFileSync(path.join(repo,f));
  if(rev==='original'&&['test/render-helper.js','test/render-artifact.js'].includes(f))b=cp.execFileSync('git',['show','fd5e3fc9329711d3190bbd5c7046976c21d0b9a1:'+f],{cwd:repo,maxBuffer:32768});put(f,b);}
 put('src/main.watx','(module (include "./13-exports.wat"))');put('src/13-exports.wat','é');
 put('tools/watx-src/compiler-parser.js','function watxSourceTextFromBytes(b){if(!(b instanceof Uint8Array))throw Error("not bytes");return new TextDecoder().decode(b)}');
 put('tools/watx-src/compiler-stages.js','// tiny stage');put('tools/watx-src/compiler-codegen.js','// tiny stage');put('tools/watx-src/compiler.js',stage(4));
 put('lib/canvas-compat.js','exports.createCanvas=()=>({});');put('lib/host-imports.js','exports.createHostImports=()=>({host:{},gdi:{}});');put('lib/renderer.js','exports.Win98Renderer=class{};');
}
const prelude=`const fs=require('fs'),assert=require('assert'),Module=require('module');
let hosts=0;global.WebAssembly={Module:class{},Memory:class{constructor(){throw Error('native memory forbidden')}},instantiate:async b=>{hosts++;return {instance:{exports:{marker:b[b.length-1]}},module:{}}}};
const p=require('./test/render-artifact'),boot=require('./test/render-helper').bootRenderHarness;
const file=require('path').resolve('out.wasm'),extra=${JSON.stringify(extra)},opts={fonts:'none',memory:{buffer:new ArrayBuffer(8)},extraWat:extra};
const read=f=>fs.readFileSync(f,'utf8'),put=(f,b)=>fs.writeFileSync(f,b),marker=async n=>assert.equal((await boot(opts)).exports.marker,n);
(async()=>{`;
function run(label,body,{rev,env={},expectFailure}={}){setup(rev);try{
 const r=cp.spawnSync(process.execPath,['--max-old-space-size=256','-e',prelude+body+'})().catch(e=>{console.error(e);process.exitCode=1})'],{cwd:dir,env:{...process.env,...env},stdio:'inherit',timeout:10000});
 assert(!r.error,String(r.error));assert.equal(r.status,expectFailure?1:0,label);results.push({label,status:r.status,expectedFailure:!!expectFailure});console.log('PASS independent '+label);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
const adapterRepro=`require('./test/compile-src');assert.equal(require.cache[require.resolve('./tools/watx.js')],undefined);put('./test/compile-src.js','throw Error("INDEPENDENT_ADAPTER")');assert.throws(()=>p.prepareArtifact(file,{extraWat:extra,tailCalls:true}),/INDEPENDENT_ADAPTER/);assert.equal(hosts,0);`;
const loaderRepro=`await marker(4);put('./tools/watx.js','throw Error("INDEPENDENT_LOADER")');await assert.rejects(boot(opts),/INDEPENDENT_LOADER/);assert.equal(hosts,1);`;
run('original adapter fails repaired oracle',adapterRepro,{rev:'original',expectFailure:true});run('original loader fails repaired oracle',loaderRepro,{rev:'original',expectFailure:true});
run('repair rejects exact adapter sentinel',adapterRepro);run('repair rejects exact loader sentinel',loaderRepro);
run('valid adapter and loader execute through held boot; shared exports untouched',`
 const held=require('./test/compile-src'),closure=require('./tools/watx-closure'),trans=(f,s)=>f==='13-exports.wat'?s+'\\n'+extra+'\\n':s;
 assert.equal(held.compileSrcWasm(trans).at(-1),4);const loader=require('./tools/watx');await marker(4);
 const adapter=read('./test/compile-src.js');put('./test/compile-src.js',adapter+'\\nconst old=module.exports.compileSrcWasm;module.exports.compileSrcWasm=(...a)=>{const b=old(...a);b[b.length-1]=19;return b};');await marker(19);assert.equal(held.compileSrcWasm(trans).at(-1),4);
 put('./test/compile-src.js',adapter);put('./tools/watx.js',read('./tools/watx.js')+'\\nconst old=module.exports.compile;module.exports.compile=(...a)=>{const r=old(...a);r.wasmBinary[r.wasmBinary.length-1]=11;return r};');
 await marker(11);p.prepareArtifact(file,{extraWat:extra,tailCalls:true});assert.equal(p.consumeArtifact(file,{extraWat:extra,tailCalls:true}).at(-1),11);
 assert.strictEqual(require('./tools/watx'),loader);assert.strictEqual(require('./tools/watx-closure'),closure);assert.equal(held.compileSrcWasm(trans).at(-1),4);`);
run('stage/closure changes, non-tail options, retained helper/artifact reload and bounded children',`
 const held=require('./test/compile-src'),trans=(f,s)=>f==='13-exports.wat'?s+'\\n'+extra+'\\n':s;assert.equal(held.compileSrcWasm(trans).at(-1),4);await marker(4);
 put('./tools/watx-src/compiler.js',${JSON.stringify(stage(8))});await marker(8);
 put('./tools/watx-closure.js',read('./tools/watx-closure.js')+'\\nconst old=module.exports.compileClosure;module.exports.compileClosure=(...a)=>{const r=old(...a);r.wasmBinary[r.wasmBinary.length-1]+=6;return r};');await marker(14);assert.equal((await boot({...opts,tailCalls:false})).exports.marker,44);
 const helper=read('./test/render-helper.js'),artifact=read('./test/render-artifact.js'),hm=require.cache[require.resolve('./test/render-helper')],am=require.cache[require.resolve('./test/render-artifact')],hc=hm.children.length,ac=am.children.length;
 for(let n=0;n<12;n++){put('./test/render-helper.js',helper+'\\nconst old=module.exports.bootRenderHarness;module.exports.bootRenderHarness=async(...a)=>({...await old(...a),revision:'+n+'});');put('./test/render-artifact.js',artifact+'\\nmodule.exports.extraWatTransform=()=>'+n+';');
 const h=await boot(opts);assert.equal(h.revision,n);assert.equal(h.exports.marker,14);assert.equal(p.extraWatTransform('x'),n);assert.equal(hm.children.length,hc);assert.equal(am.children.length,ac);}assert.equal(held.compileSrcWasm(trans).at(-1),4);`);
run('unsealed builtin/JS/read and missing vm stage fail closed',`
 const loader=read('./tools/watx.js');for(const [code,pattern] of [['require("crypto")',/unsealed dependency/],['require("../not-sealed")',/unsealed read/],['fs.readFileSync(require("path").join(__dirname,"../not-sealed"))',/unsealed read/]]){put('./tools/watx.js',loader+'\\n'+code);await assert.rejects(boot(opts),pattern);assert.equal(hosts,0);}
 put('./tools/watx.js',loader);fs.unlinkSync('./tools/watx-src/compiler-stages.js');await assert.rejects(boot(opts),/unsealed read/);assert.equal(hosts,0);`);
run('inventory mutation/addition/symlink; input changed during compile rejects',`
 p.prepareArtifact(file,{extraWat:extra,tailCalls:true});const stage=read('./tools/watx-src/compiler.js');put('./tools/watx-src/compiler.js',stage+'\\n// changed');assert.throws(()=>p.consumeArtifact(file,{extraWat:extra,tailCalls:true}),/provenance/);
 put('./tools/watx-src/compiler.js',stage);put('./tools/watx-src/additional-input','addition');assert.throws(()=>p.consumeArtifact(file,{extraWat:extra,tailCalls:true}),/provenance/);fs.unlinkSync('./tools/watx-src/additional-input');
 fs.symlinkSync('compiler.js','./tools/watx-src/link');assert.throws(()=>p.identity(),/non-regular compiler/);fs.unlinkSync('./tools/watx-src/link');
 put('./tools/watx.js',read('./tools/watx.js')+'\\nfs.appendFileSync(require("path").join(__dirname,"../src/13-exports.wat"),"changed");');assert.throws(()=>p.prepareArtifact(file,{extraWat:extra,tailCalls:true}),/inputs changed during compilation/);assert.equal(hosts,0);`);
run('consume zero compiler evaluation with sealed throwing loader; no fallback',`
 p.prepareArtifact(file,{extraWat:extra,tailCalls:true});put('./tools/watx-src/compiler.js','throw Error("COMPILER_EVALUATED")');put('./tools/watx.js','throw Error("LOADER_EVALUATED")');
 // Trusted hand-built manifest fixture isolates consumption; not a production preparation claim.
 put(file+'.json',JSON.stringify({...p.identity({extraWat:extra,tailCalls:true}),module:JSON.parse(read(file+'.json')).module}));
 const load=Module._load;Module._load=function(r,...a){if(/compile-src|watx/.test(r))throw Error('COMPILER_IMPORTED');return load.call(this,r,...a)};
 process.env.WINE_RENDER_ARTIFACT=file;await marker(4);assert.equal(hosts,1);fs.unlinkSync(file+'.json');await assert.rejects(boot(opts),/ENOENT/);assert.equal(hosts,1);`);
run('module/manifest bounds before allocation',`
 p.prepareArtifact(file,{extraWat:extra,tailCalls:true});const fstat=fs.fstatSync,alloc=Buffer.alloc;
 for(const [target,limit] of [[file,8388608],[file+'.json',131072]]){const s=fs.statSync(target);let attempted=false;
 fs.fstatSync=fd=>{const q=fstat(fd);return q.ino===s.ino&&q.dev===s.dev?{isFile:()=>true,size:limit+1}:q};Buffer.alloc=n=>{if(n===limit+1)attempted=true;return alloc(n)};
 assert.throws(()=>p.consumeArtifact(file,{extraWat:extra,tailCalls:true}),new RegExp('size/type'));assert.equal(attempted,false);fs.fstatSync=fstat;Buffer.alloc=alloc;}`);
for(const name of ['test-d3d-software-compaction.js','test-d3d-software-ctx-arena-reuse.js'])run('PREPARATION ONLY actual '+name,`
 const load=Module._load;Module._load=function(r,...a){if(r.includes('d3d9-software-backend')||r.includes('fixtures/d3d9-triangle-edge-cases'))return {};if(/canvas-compat|host-imports|renderer|font-substitutions/.test(r))throw Error('HOST_PREPARE');return load.call(this,r,...a)};
 put('./tools/watx-src/compiler.js','function compile(s,v,o){if(!v.get("13-exports.wat").includes("reverse_pointer"))throw Error("target extraWat absent");return {success:true,wasmBinary:Uint8Array.from([0,97,115,109,1,0,0,0])}}');
 process.env.WINE_RENDER_ARTIFACT_PREPARE=file;require('./test/${name}');process.on('beforeExit',()=>{throw Error('preparation failed to exit')});`);
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({verdict:'source fixtures only',results},null,2)+'\n');console.log('PASS independent '+results.length+' groups; native/canonical qualification pending');
