'use strict';
// Explicit canonical module only. This tests mapping lifetime, not QT entry.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHostImports}=require('../lib/host-imports');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const R=require('../lib/region-map.generated');

async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory=memory;
  const e=(await WebAssembly.instantiate(module,imports)).exports;
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
  const pe=makeFixture();
  // Replace two import names within their existing allocated name slots.
  for(const [old,name] of [['GetModuleHandleA','VirtualAlloc'],['LoadLibraryA','VirtualFree']]) {
    const at=pe.indexOf(Buffer.from(old+'\0'));assert(at>=0);
    pe.fill(0,at,at+old.length+1);pe.write(name,at);
  }
  // CALL EAX; JMP $: invoke the genuine imported API through the interpreter.
  pe.set([0xff,0xd0,0xeb,0xfe],0x1200);
  bytes.set(pe,e.get_staging());assert.equal(e.load_pe(pe.length),0x402000);
  const wa=p=>e.guest_to_wasm(p)>>>0;
  const read=p=>view.getUint32(wa(p),true),write=(p,v)=>view.setUint32(wa(p),v,true);
  const alloc=read(iat('GetModuleHandleA')),free=read(iat('LoadLibraryA'));
  function api(target,args) {
    const sp=0x7408000;
    args.forEach((v,i)=>write(sp+4*i,v));
    e.set_esp(sp);e.set_eax(target);e.set_eip(0x402000);e.run(100);
    assert.equal(e.get_esp()>>>0,sp+args.length*4,'stdcall cleanup');
    return e.get_eax()>>>0;
  }
  const reserve=size=>api(alloc,[0,size,0x2000,4]);
  const commit=(base,size)=>api(alloc,[base,size,0x1000,4]);
  const vfree=(base,size,type)=>api(free,[base,size,type]);
  function begin(base) {
    e.set_esp(0x7408000);
    const token=e.win16_bridge_frame_begin();assert(token);
    assert.equal(e.win16_bridge_stack_lease(token,base,wa(base)),0,'scope required');
    assert(e.win16_bridge_scope_begin(token));
    assert.equal(e.win16_bridge_stack_lease(token,base,wa(base)+4096),0,'revalidate physical identity');
    assert.equal(e.win16_bridge_stack_lease(token,base+1,wa(base)),0,'alignment required');
    assert.equal(e.win16_bridge_stack_lease(token,base,wa(base)),1);
    assert.equal(e.win16_bridge_stack_lease(token,base,wa(base)),0,'one lease per frame');
    return token;
  }
  // Direct fixed stack lease still requires owned frame cleanup.
  let token=begin(0x7400000);
  assert.equal(vfree(0x7400000,0,0x8000),0,'fixed stack release busy');
  assert.equal(vfree(0x7400000,4096,0x4000),0,'fixed stack decommit busy');
  assert.equal(e.win16_process_arena_release(),0,'live frame prevents arena reset');
  bytes.set(pe,e.get_staging());assert.equal(e.load_pe(pe.length),-4,'reset rejects before replacing mappings');
  assert(e.win16_bridge_frame_end(token));
  assert.equal(e.win16_bridge_stack_lease(token,0x7400000,wa(0x7400000)),0,'stale frame');
  token=e.win16_bridge_frame_begin();assert(token);assert(e.win16_bridge_scope_begin(token));
  const directHeap=R.BASE.GUEST_HEAP_BASE-R.BASE.GUEST_BASE+0x400000;
  for(const invalid of [directHeap,0x50000000,0x32000000])
    assert.equal(e.win16_bridge_stack_lease(token,invalid,wa(invalid)),0,'heap/DIB/unmapped windows excluded');
  assert(e.win16_bridge_frame_end(token));

  // First island is unleased. Reject before freeing/zeroing it when a later
  // island is leased, including the reservation's gap and ownership record.
  const base=reserve(0x40000);assert(base);assert.equal(base&0xffff,0);
  assert.equal(commit(base,0x10000),base);
  assert.equal(commit(base+0x20000,0x10000),base+0x20000);
  const island=base+0x20000;
  write(base,0x11223344);write(island,0x55667788);
  token=begin(island);
  const owner=e.get_current_thread_id();e.set_current_thread_id(owner+1);
  assert.equal(e.win16_bridge_stack_lease(token,island,wa(island)),0,'foreign owner cannot bind');
  assert.equal(e.win16_bridge_frame_end(token),0,'foreign owner cannot drop lease');
  assert.equal(e.guest_map_free(base),0,'foreign mapping caller sees shared lease');
  e.set_current_thread_id(owner);
  const before=[wa(base),wa(island),read(base),read(island)];
  assert.equal(e.guest_map_free(base),0,'reservation release busy');
  assert.equal(vfree(base,0,0x8000),0,'VirtualFree reports failed release');
  assert.equal(vfree(base,0x30000,0x4000),0,'decommit preflights all islands');
  assert.equal(vfree(island,0,0x4000),0,'zero-size decommit busy');
  assert.equal(commit(base,0x30000),0,'commit rejects before publishing gap');
  assert.equal(wa(base+0x10000),0xf0,'rejected commit did not fill gap');
  assert.deepEqual([wa(base),wa(island),read(base),read(island)],before);
  // Unrelated memory remains usable while a lease exists.
  const other=e.guest_stack_alloc(0x10000)>>>0;assert(other);
  assert.equal(e.guest_map_free(other),1);
  const nested=begin(island);
  assert.equal(e.win16_bridge_frame_end(token),0,'cannot end suspended parent');
  assert(e.win16_bridge_frame_end(nested));assert.equal(e.guest_map_free(base),0,'parent still pins');
  assert(e.win16_bridge_frame_end(token));
  assert.equal(vfree(island,4096,0x4000),1,'decommit after release');
  assert.equal(wa(island),0xf0);
  assert.equal(commit(island,4096),island);assert.equal(read(island),0,'recommit zero fills');
  assert.equal(e.guest_map_free(base),1,'reservation retained for successful retry');
  const wide=reserve(0x20000);assert(wide);assert.equal(commit(wide,0x20000),wide);
  token=begin(wide+0x10000);write(wide,0x99887766);
  assert.equal(commit(wide,4096),0,'conservative same-record commit rejection');
  assert.equal(vfree(wide,4096,0x4000),0,'conservative same-record decommit rejection');
  assert.equal(read(wide),0x99887766);
  assert(e.win16_bridge_frame_end(token));assert.equal(e.guest_map_free(wide),1);

  // Capacity failure does not evict another frame; unwinding restores all
  // ownership, including nested leases of the same fixed window.
  const frames=[];
  for(let i=0;i<17;i++) {
    const frame=e.win16_bridge_frame_begin();assert(frame);frames.push(frame);
    assert(e.win16_bridge_scope_begin(frame));
    assert.equal(e.win16_bridge_stack_lease(frame,0x7400000,wa(0x7400000)),i<16?1:0);
  }
  while(frames.length)assert(e.win16_bridge_frame_end(frames.pop()));

  // Section free has a separate island walker and must preserve view identity.
  const section=e.guest_section_reserve(0x40000)>>>0;assert(section);
  assert.equal(e.guest_section_commit(section,0,0x10000,4)>>>0,section);
  assert.equal(e.guest_section_commit(section,0x20000,0x10000,4)>>>0,section+0x20000);
  token=begin(section+0x20000);write(section,0xabcdef01);
  assert.equal(e.guest_section_free(section),0);
  assert.equal(e.guest_map_free(section),0);
  assert.equal(read(section),0xabcdef01);
  assert.equal(vfree(section,0,0x8000),0,'failed host free kept mapped-view classification');
  assert(e.win16_bridge_frame_end(token));assert.equal(e.guest_section_free(section),1);

  // Make two real, separately backed adjacent records into the allocator's
  // continuation representation without exhausting hundreds of MB of backing.
  const chain=0x31000000;
  assert.equal(e.test_virtual_map_commit(chain,0x10000)>>>0,chain);
  const spacer=e.guest_stack_alloc(0x10000)>>>0;assert(spacer);
  assert.equal(e.test_virtual_map_commit(chain+0x10000,0x10000)>>>0,chain+0x10000);
  let continuation=0;
  for(let i=0;i<view.getUint32(R.BASE.VIRTUAL_MAP_STATE,true);i++) {
    const rec=R.BASE.VIRTUAL_MAP_TABLE+i*16;
    if(view.getUint32(rec,true)===chain+0x10000)continuation=rec;
  }
  assert(continuation,'separate continuation record');
  view.setUint32(continuation+12,view.getUint32(continuation+12,true)|0x80000000,true);
  write(chain,0x12345678);token=begin(chain+0x10000);
  assert.equal(e.guest_map_free(chain),0);assert.equal(read(chain),0x12345678);
  assert(e.win16_bridge_frame_end(token));assert.equal(e.guest_map_free(chain),1);
  assert.equal(wa(chain+0x10000),0xf0);assert.equal(e.guest_map_free(spacer),1);
  assert.equal(e.win16_process_arena_release(),1);
  console.log('PASS direct/sparse frame leases, nested/stale ownership, atomic release/decommit/commit, sections and split chains');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
