'use strict';
// From repository root: node docs/reviews/env-empty-guard-integration-20261020.js [OUTPUT_DIR]
// Compile actual working-tree functions (HEAD objects for absent sparse files).
// No candidate ancestry, full build, guest launch or browser is required.
const fs=require('fs'),cp=require('child_process'),path=require('path'),vm=require('vm');
const assert=require('assert/strict'),crypto=require('crypto');
const out=process.argv[2];
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024**2});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results={head:git('rev-parse','HEAD').trim(),inputs:{},checks:[],controls:[]};
const source=p=>{const s=fs.existsSync(p)?fs.readFileSync(p,'utf8'):git('show','HEAD:'+p);results.inputs[p]=sha(s);return s;};
const check=(name,fn)=>{fn();results.checks.push(name);};
const reject=(name,fn)=>{assert.throws(fn,assert.AssertionError);results.controls.push(name);};
function expr(s,p){assert(p>=0);let depth=0;for(let i=p;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')'&&--depth===0)return s.slice(p,i+1);}throw Error('unbalanced');}
function func(s,name){s=s.replace(/;;[^\n]*/g,'');return expr(s,s.search(new RegExp('\\(func \\$'+name+'\\s')));}
const compiler={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Float32Array,Float64Array,Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
vm.createContext(compiler);
for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']){
 const p='tools/watx-src/'+f,s=source(p);
 vm.runInContext(s,compiler,{filename:p});
}
const adapters=`
 (import "h" "alloc" (func $heap_alloc (param i32) (result i32)))
 (import "h" "free" (func $heap_free (param i32)))
 (memory 2) (export "memory" (memory 0))
 (global $reg_base i32 (i32.const 128))
 (global $last_error (mut i32) (i32.const 0))
 (global $env_block (mut i32) (i32.const 8192))
 (global $env_cap i32 (i32.const 4096))
 (global $launch_env_len i32 (i32.const 0))
 (func (export "env") (param $p i32) (global.set $env_block (local.get $p)))
 (func $g2w (param $p i32) (result i32) (local.get $p))
 (func $gl8 (param $p i32) (result i32) (i32.load8_u (local.get $p)))
 (func $gl16 (param $p i32) (result i32) (i32.load16_u (local.get $p)))
 (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
 (func $gs8 (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
 (func $guest_memmove (param $d i32) (param $s i32) (param $n i32) (memory.copy (local.get $d) (local.get $s) (local.get $n)))
 (func $ptr_range_access_bad (param $p i32) (param $n i32) (param i32) (result i32)
   (i32.or (i32.eqz (local.get $p)) (i32.gt_u (local.get $p) (i32.sub (i32.const 131072) (local.get $n)))))
 (func (export "error") (result i32) (global.get $last_error))
`;


const helpers=source("src/10-helpers.wat");
function sharedModule(helperText=helpers) {
  const names=['guest_strlen','guest_wcslen','tolower','env_find','env_name_len',
    'env_get','env_set','env_size','env_ensure','env_expand_var','env_expand_a'];
  const wat=adapters+
    '\n(func $gs16 (param $p i32) (param $v i32) (i32.store16 (local.get $p) (local.get $v)))\n'+
    names.map(n=>func(helperText,n).replaceAll('(region.addr $ENV_DEFAULTS 0x000)','(i32.const 12000)')
      .replaceAll('(region.addr $LAUNCH_ENV_OVERRIDES 0x000)','(i32.const 16000)')).join('\n')+
    ['gl_char','lstr_len'].map(n=>func(source('src/09a-handlers2-runtime.wat'),n)).join('\n')+
    func(source('src/09a0-handlers-base.wat'),'store_char')+
    func(source('src/09a6-handlers-crt.wat'),'handle_getenv')+
    ['env_find','env_get','env_set','env_expand_a','handle_getenv'].map(n=>`(export "${n}" (func $${n}))`).join('\n');
  const r=compiler.compile(wat,new Map(),{mode:'production'});assert(r.success,r.error);
  return {module:new WebAssembly.Module(r.wasmBinary),hash:sha(r.wasmBinary)};
}
const shared=sharedModule();
results.sharedCompiledHash=shared.hash;
function sharedFixture(code=shared) {
  let bytes,next=32768;const live=new Map();
  const e=new WebAssembly.Instance(code.module,{h:{
    shell(){throw Error('unexpected shell call');},spawn(){throw Error('unexpected spawn');},
    alloc(n){const p=next+16;next=p+n+16;assert(next<131072);bytes.fill(0xa7,p-16,next);live.set(p,n);return p;},
    free(p){assert(live.has(p));const n=live.get(p);assert(bytes.subarray(p-16,p).every(x=>x===0xa7));
      assert(bytes.subarray(p+n,p+n+16).every(x=>x===0xa7));bytes.fill(0xdd,p,p+n);live.delete(p);}
  }}).exports;
  bytes=new Uint8Array(e.memory.buffer);const dv=new DataView(e.memory.buffer);
  bytes.set(Buffer.from('=C:=D:\\Drive\0ROOT=C:\\Named\0EMPTY=\0\0'),8192);
  const put=(p,s,wide=0)=>bytes.set(Buffer.from(s+'\0',wide?'utf16le':'latin1'),p);
  const read=(p,wide=0)=>{let end=p;while(wide?dv.getUint16(end,true):bytes[end])end+=wide?2:1;
    return Buffer.from(bytes.subarray(p,end)).toString(wide?'utf16le':'latin1');};
  return {e,bytes,dv,put,read,live};
}
for(const wide of [0,1]) {
  for(const [name,value] of [['=C:','D:\\Drive'],['=c:','D:\\Drive'],['rOoT','C:\\Named'],['EMPTY','']]) {
    check(`shared lookup/get A/W=${wide} name=${name}`,()=>{
      const {e,bytes,put,read}=sharedFixture();put(1024,name,wide);
      assert(e.env_find(1024,wide)>0);
      assert.equal(e.env_get(1024,0,0,wide),value.length+1);
      bytes.fill(0xa7,2040,2160);
      assert.equal(e.env_get(1024,2048,value.length,wide),value.length+1);
      assert(bytes.subarray(2040,2160).every(x=>x===0xa7),'short get must not overwrite');
      assert.equal(e.env_get(1024,2048,value.length+1,wide),value.length);
      assert.equal(read(2048,wide),value);
      assert(bytes.subarray(2040,2048).every(x=>x===0xa7));
      assert(bytes.subarray(2048+(value.length+1)*(wide?2:1),2160).every(x=>x===0xa7));
    });
  }
  for(const name of ['', 'MISSING'])check(`shared absent lookup/get A/W=${wide} name=${name}`,()=>{
    const {e,bytes,put}=sharedFixture();put(1024,name,wide);bytes.fill(0xa7,2048,2112);
    assert.equal(e.env_find(1024,wide),0);assert.equal(e.env_get(1024,2048,32,wide),0);
    assert(bytes.subarray(2048,2112).every(x=>x===0xa7));
  });
  check(`shared named replace/empty/delete A/W=${wide}`,()=>{
    const {e,put,read}=sharedFixture();put(1024,'=c:',wide);put(1536,'E:\\New',wide);
    assert.equal(e.env_set(1024,1536,wide),1);
    assert.equal(e.env_get(1024,2048,32,wide),6);assert.equal(read(2048,wide),'E:\\New');
    put(1536,'',wide);assert.equal(e.env_set(1024,1536,wide),1);
    assert(e.env_find(1024,wide)>0);assert.equal(e.env_get(1024,2048,32,wide),0);assert.equal(read(2048,wide),'');
    assert.equal(e.env_set(1024,0,wide),1);assert.equal(e.env_find(1024,wide),0);
    put(1024,'ROOT',wide);assert.equal(e.env_get(1024,2048,32,wide),8);assert.equal(read(2048,wide),'C:\\Named');
  });
  check(`empty deletion cannot remove hidden drive A/W=${wide}`,()=>{
    const {e,bytes,put}=sharedFixture();put(1024,'',wide);const saved=Buffer.from(bytes.subarray(8192,8256));
    assert.equal(e.env_set(1024,0,wide),1);assert.deepEqual(Buffer.from(bytes.subarray(8192,8256)),saved);
  });
}
for(const name of ['', '=c:', 'ROOT','EMPTY','MISSING'])check(`CRT getenv ${name}`,()=>{
  const {e,dv,put,read}=sharedFixture();put(1024,name);dv.setUint32(144,4096,true);
  e.handle_getenv(1024,0,0,0,0,0);
  const pointer=dv.getUint32(128,true);assert.equal(dv.getUint32(144,true),4100);
  if(name===''||name==='MISSING')assert.equal(pointer,0);
  else {assert(pointer>0);assert.equal(read(pointer),({'=c:':'D:\\Drive',ROOT:'C:\\Named',EMPTY:''})[name]);}
});
for(const [input,expected] of [
  ['%%','%%'],['%%%%','%%%%'],['%%/%ROOT%/%EMPTY%/%MISSING%/%','%%/C:\\Named//%MISSING%/%'],
  ['%=C:%/%%/%=c:%','D:\\Drive/%%/D:\\Drive']
])check(`direct expansion sizing/short/alias ${input}`,()=>{
  const {e,bytes,put,read,live}=sharedFixture();put(1024,input);
  assert.equal(e.env_expand_a(1024,0,0),expected.length+1);
  bytes.fill(0xa7,2048,2176);
  assert.equal(e.env_expand_a(1024,2048,expected.length),expected.length+1);
  assert(bytes.subarray(2048,2176).every(x=>x===0xa7));
  assert.equal(e.env_expand_a(1024,1024,expected.length+1),expected.length+1);
  assert.equal(read(1024),expected);assert.equal(live.size,0);
});

// The exact guard is removed only in memory for a defect-rejecting control.
const guard=`    ;; No empty-name variable: a hidden drive entry's leading '=' belongs to
    ;; its name (e.g. "=C:"), not an empty name's separator. Keep %% literal.
    (if (i32.eqz (call $gl_char (local.get $name_g) (local.get $wide)))
      (then (return (i32.const 0))))
`;
assert.equal(helpers.split(guard).length,2,'exact reviewed guard appears once');
const parent=sharedModule(helpers.replace(guard,''));
results.unguardedHelperHash=sha(helpers.replace(guard,''));
results.parentCompiledHash=parent.hash;
for(const wide of [0,1])for(const hiddenFirst of [false,true]) {
 const block=(hiddenFirst?'=C:=D:\\Drive\0ROOT=C:\\Named\0':'ROOT=C:\\Named\0=C:=D:\\Drive\0')+'\0';
 function fixture(code=shared){const f=sharedFixture(code);f.bytes.fill(0,8192,12288);f.bytes.set(Buffer.from(block),8192);return f;}
 function empty(code){const {e,bytes,put}=fixture(code);put(1024,'',wide);const saved=Buffer.from(bytes.subarray(8192,12288));
   assert.equal(e.env_find(1024,wide),0);assert.equal(e.env_get(1024,2048,32,wide),0);
   assert.equal(e.env_set(1024,0,wide),1);assert.deepEqual(Buffer.from(bytes.subarray(8192,12288)),saved);}
 check('empty A/W='+wide+' hiddenFirst='+hiddenFirst,()=>empty(shared));
 reject('unguarded parent A/W='+wide+' hiddenFirst='+hiddenFirst,()=>empty(parent));
 for(const consumer of ['get','delete','CRT','expand']) {
   function oracle(code) {
     const {e,bytes,dv,put,read}=fixture(code);put(1024,'',wide);
     const saved=Buffer.from(bytes.subarray(8192,12288));
     if(consumer==='get')assert.equal(e.env_get(1024,2048,32,wide),0);
     if(consumer==='delete'){
       assert.equal(e.env_set(1024,0,wide),1);
       assert.deepEqual(Buffer.from(bytes.subarray(8192,12288)),saved);
     }
     if(consumer==='CRT'){
       put(1024,'');dv.setUint32(144,4096,true);
       e.handle_getenv(1024,0,0,0,0,0);assert.equal(dv.getUint32(128,true),0);
     }
     if(consumer==='expand'){
       put(1024,'%%');assert.equal(e.env_expand_a(1024,2048,32),3);
       assert.equal(read(2048),'%%');
     }
   }
   check(consumer+' independent benefit '+wide+'/'+hiddenFirst,()=>oracle(shared));
   reject(consumer+' unguarded parent '+wide+'/'+hiddenFirst,()=>oracle(parent));
 }
 check('lazy initialization A/W='+wide+' hiddenFirst='+hiddenFirst,()=>{
   const {e,bytes,put,live,read}=fixture();bytes.set(Buffer.from(block),12000);e.env(0);put(1024,'',wide);
   assert.equal(e.env_find(1024,wide),0);assert.equal(live.size,1,'empty lookup must initialize');
   put(1024,'=c:',wide);assert.equal(e.env_get(1024,2048,32,wide),8);assert.equal(read(2048,wide),'D:\\Drive');
   assert.equal(live.size,1,'must initialize only once');
 });
}
check('UTF16 nonempty low byte zero is not empty',()=>{const {e,put}=sharedFixture();put(1024,'\u0100',1);assert.equal(e.env_find(1024,1),0);});
reject('overbroad guard rejects named hidden variables',()=>{
 const broken=helpers.replace('(i32.eqz (call $gl_char (local.get $name_g) (local.get $wide)))',
 '(i32.le_u (call $gl_char (local.get $name_g) (local.get $wide)) (i32.const 0x3D))');
 const {e,put}=sharedFixture(sharedModule(broken));put(1024,'=C:');assert(e.env_find(1024,0)>0);
});
results.limits='Actual-source slice; memory translation/heap/region placement are adapters. No full dispatch/build, ShellEx launch, runtime or game qualification.';
if(out){const s=fs.statfsSync(out);assert(s.bavail*s.bsize>=2277507072,'prewrite capacity');fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify({checks:results.checks.length,controls:results.controls.length,wasm:shared.hash}));
