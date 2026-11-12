'use strict';
// Requires a future explicitly built module. This is an executable-address
// lifetime test, not a QT gateway test; no private register ABI is assumed.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHostImports}=require('../lib/host-imports');
const {createNeLifecycle}=require('../lib/ne-lifecycle');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const {makeFixture}=require('../tools/kernel32-native-fixture');
async function main(){
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const e=(await WebAssembly.instantiate(module,imports)).exports;
  const pe=makeFixture();new Uint8Array(memory.buffer,e.get_staging(),pe.length).set(pe);
  assert.equal(e.load_pe(pe.length),0x402000);e.set_esp(0x7408000);
  const lifecycle=createNeLifecycle(e,memory,[['FIRST',neLifecycleImage()],['SECOND',neLifecycleImage()]]);
  const first=lifecycle.load('FIRST'),second=lifecycle.load('SECOND');
  const target=lifecycle.lookup(first,'VALUE'),other=lifecycle.lookup(second,'VALUE');
  let token=e.win16_bridge_frame_begin();assert(token);
  assert.equal(e.win16_bridge_invoke_target(token,target),0,'owner scope required');
  assert(e.win16_bridge_scope_begin(token));
  for(const bad of [0,0xffffffff,(target&0xffff0000)|0xffff,
    (e.win16_bridge_module_data(first)<<16)>>>0])
    assert.equal(e.win16_bridge_invoke_target(token,bad),0,'reject invalid/data target before pin');
  assert.equal(e.win16_bridge_invoke_target(token,target),first);
  assert.equal(e.win16_bridge_invoke_target(token,target),0,'duplicate bind rejected');
  assert.equal(e.win16_bridge_invoke_module(token,second),0,'cannot replace pinned module');
  assert.equal(e.win16_bridge_invoke_begin(token,other,0,0,0),0,'cannot enter another target under pin');
  assert.throws(()=>lifecycle.release(first),/release rejected/,'final free cannot destroy active code');
  assert(e.win16_bridge_frame_end(token),'teardown releases prepared pin');
  assert.equal(e.win16_bridge_invoke_target(token,target),0,'stale frame rejected');
  assert.equal(lifecycle.lookup(first,'VALUE'),target,'failed free retained module');
  lifecycle.release(first);
  token=e.win16_bridge_frame_begin();assert(token);assert(e.win16_bridge_scope_begin(token));
  assert.equal(e.win16_bridge_invoke_target(token,target),0,'unloaded selector cannot be pinned');
  assert(e.win16_bridge_frame_end(token));
  lifecycle.release(second);
  console.log('PASS executable NE target pin, mismatched target, final-free exclusion and teardown');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
