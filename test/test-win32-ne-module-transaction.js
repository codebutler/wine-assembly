'use strict';
// Compile actual invocation/selector/arena/Win16-call32 helpers, never the full
// emulator. Process backing and code-cache invalidation are controlled inputs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { compileClosure } = require('../tools/watx-closure');
const dir = path.join(__dirname, '../src');
const all = fs.readdirSync(dir).filter(n => n.endsWith('.wat')).map(n => fs.readFileSync(path.join(dir,n),'utf8')).join('\n');
function form(name) {
  const start = all.search(new RegExp('\\(func \\$'+name+'(?=\\s)')); assert(start >= 0, name);
  let depth=0, quoted=false, comment=false;
  for(let i=start;i<all.length;i++) {
    const c=all[i]; if(comment){if(c==='\n')comment=false;continue;}
    if(quoted){if(c==='\\')i++;else if(c==='"')quoted=false;continue;}
    if(c===';'&&all[i+1]===';'){comment=true;continue;} if(c==='"'){quoted=true;continue;}
    if(c==='(')depth++; if(c===')'&&!--depth)return all.slice(start,i+1);
  } throw Error(name);
}
const api = fs.readFileSync(path.join(dir,'09e-win16-api.wat'),'utf8');
const block = api.slice(api.indexOf(';; BEGIN WIN32 NE INVOCATION CONTEXT'),api.indexOf(';; END WIN32 NE INVOCATION CONTEXT'));
const loader = fs.readFileSync(path.join(dir,'08c-ne-loader.wat'),'utf8');
// Include the following guest aliases/retain-name helpers used by the real JS
// coordinator as well as the transaction table itself.
const transactions = loader.slice(loader.indexOf(';; BEGIN WIN32 NE MODULE TRANSACTIONS'));
const helpers = ['memcpy','win16_patch_dll_prologues','ascii_upper','win16_dll_entry','win16_entry_lookup','win16_dll_ordinal','win16_name_table_find','win16_pstr_eq_pstr','win16_dll_init_entry','win16_dll_data_sel','win16_dll_heap_size','win16_dll_path_id_valid','win16_handle_table','win16_dynamic_module_slot','win16_dynamic_module_release',
 'load_ne_dll_sized','win16_dll_staging','win16_dll_rec','win16_dll_loaded','win16_dll_unload','win16_dll_run_ptr','win16_dll_refs_ptr','win16_dll_image_size_ptr','win16_arena_base','win16_task_shared','win16_next_seg_get','win16_next_seg_set',
  'win16_arena_take','win16_arena_give','win16_arena_free_head','win16_alloc_segment','win16_arena_slot_base',
  'win16_gseg_field','win16_gseg_store','win16_gseg_count','win16_seg_set','win16_seg_base','win16_seg_limit',
  'win16_sel_to_index','win16_index_to_sel','win16_seg_is_big','win16_set_sreg','esp_arch',
  'win16_call32_begin','win16_call32_arg','win16_call32_end','win16_call32_waited',
  'lock_owner_id','lock_acquire','lock_release','zero_memory','win16_process_arena_release',
  'sync_depth_enter','sync_depth_leave','thread_spill_can_recycle','win16_push16','th_retf16',
  'virtual_map_lease_page_owned','virtual_map_lease_record'];
helpers.push('win16_apply_relocs','win16_module_name','win16_module_id','win16_system_module_id',
 'win16_pstr_eq','win16_dynamic_module_id','win16_import_constant','win16_thunk_for',
 'win16_thunk_count_get','win16_thunk_count_set');
helpers.push('win16_kernel');
helpers.push('win16_GetModuleUsage','win16_module_usage','win16_arg16','win16_api_key',
 'win16_api_return','win16_handle_next_get','win16_handle_next_set','win16_h16','win16_h16_forget',
 'win16_bridge_fixed_load_api','win16_bridge_fixed_free_api','win16_bridge_fixed_api_stack',
 'win16_cstr_to_pstr','win16_far_to_guest','win16_name_scratch',
 'win16_dynamic_module_is_toolhelp','win16_module_is_ver','win16_module_is_lzexpand','win16_dynamic_module_is7');
const cache = fs.readFileSync(path.join(dir,'04-cache.wat'),'utf8');
const ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
 cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
let code=block+'\n'+transactions+'\n'+ownership+'\n'+helpers.map(form).join('\n');
// Execute the real KERNEL ordinal dispatcher. Any unrelated legacy handler
// reached is a distinct host Error, never the RuntimeError expected from the
// bridge's explicit unsupported-operation guard.
for (const name of new Set([...form('win16_kernel').matchAll(/\(call \$([^\s)]+)/g)].map(m=>m[1]))) {
 if (name === 'host_log_i32' || code.includes('(func $'+name+' ' ) || code.includes('(func $'+name+'\n')) continue;
 const fn=form(name),params=[...fn.matchAll(/\(param [^)]*\)/g)].map(m=>m[0]).join(' ');
 const result=fn.match(/\(result [^)]*\)/)?.[0]||'';
 code+=`\n(func $${name} ${params} ${result} (call $unexpected_legacy) (unreachable))`;
}

code=code.replaceAll('(region.addr $WIN16_PROCESS_ARENA 0)','(i32.const 4096)')
 .replaceAll('(region.addr $WIN16_PROCESS_ARENA 4)','(i32.const 4100)')
 .replaceAll('(region.addr $WIN16_PROCESS_ARENA 8)','(i32.const 4104)')
 .replaceAll('(region.addr $WIN16_PROCESS_ARENA 104)','(i32.const 4200)')
 .replaceAll('(region.addr $GUEST_STACK 0x200)','(i32.add (global.get $GUEST_STACK) (i32.const 512))')
 .replaceAll('(region.end $GUEST_STACK)','(i32.add (global.get $GUEST_STACK) (global.get $GUEST_STACK_SIZE))');
const fixture={WIN16_SEG_TABLE:0x20000,WIN16_SEG_TABLE_SIZE:0x20000,WIN16_THUNK_TABLE:0x50000,
 reg_base:0x60000,fpu_base:0x61000,mmx_base:0x62000,xmm_base:0x63000,GUEST_STACK:0x80000,GUEST_STACK_SIZE:65536,
 DLL_LOAD_LOCK:0x1100,LOCK_VIRTUAL_MAP:0x1110,VIRTUAL_MAP_STATE:0x1120,VIRTUAL_MAP_TABLE:0x1200,
 current_thread_id:1,WIN16_APP_DLL_STAGING:0x90000,WIN16_APP_DLL_STAGING_SIZE:65536,
 WIN16_NAME_KERNEL:0x70000};
const globalNames=[...new Set([...code.matchAll(/\(global\.(?:get|set) \$([^\s)]+)/g)].map(m=>m[1]))];
const declared=new Set([...code.matchAll(/\(global \$([^\s)]+)/g)].map(m=>m[1]));
const mutable=[];
const globals=globalNames.filter(n=>!declared.has(n)).map(n=>{
 const def=all.match(new RegExp('\\(global \\$'+n+'\\s+(?:\\(mut (i32|i64)\\)|(i32|i64))\\s+\\(([^\\n]+)'));assert(def,n);
 const type=def[1]||def[2],mut=!!def[1];if(mut)mutable.push(n);
 const constant=def[3].match(/^(?:i32|i64)\.const\s+(0x[0-9a-f]+|-?\d+)/i);
 const value=fixture[n]??(constant?Number(constant[1]):0);
 return `(global $${n} ${mut?'(mut '+type+')':type} (${type}.const ${value}))`;
}).join('\n');
const saved=[...block.matchAll(/\(i32.store offset=\d+ \(local.get \$frame\) \(global.get \$([^\s)]+)\)\)/g)].map(m=>m[1]).filter(n=>n!=='sync_msg_depth');
for(const n of 'resume_ip eip_redirected current_thunk_eip d_seg d_addr16 ea_temp eip ip steps code16 cs_big sreg_es sreg_cs sreg_ss sreg_ds sreg_fs16 sreg_gs seg_base_es seg_base_cs seg_base_ss seg_base_ds fs_base gs_base df flag_op flag_a flag_b flag_res saved_cf flag_sign_shift eflags_extra yield_flag yield_reason last_error win16_in_call32 win16_esp_save win16_eip_save fpu_top fpu_cw fpu_sw fpu_tag fpu_raw_tag'.split(' '))assert(saved.includes(n),n);
const probes=mutable.map(n=>`(func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))
(func (export "get_${n}") (result i32) (global.get $${n}))`).join('\n');
const exportedHelpers=helpers.filter(n=>!form(n).includes('(export ')).map(n=>`(export "${n}" (func $${n}))`).join('\n');
const source=`
(import "host" "memory" (memory 1024 1024 shared))
;; Fixture-only placement, outside the synthetic selector/register areas.
(region.declare-fixed $CALLBACK_OWNERSHIP (base 0xf0000) (size 0x2110) (align 16))
(import "host" "ensure" (func $win16_process_arena_ensure (result i32)))
(import "host" "release" (func $virtual_map_release (param i32) (result i32)))
(import "host" "g2w" (func $g2w (param i32) (result i32)))
(import "host" "write" (func $gs32 (param i32 i32)))
(import "host" "unexpectedLegacy" (func $unexpected_legacy))
(func $host_log_i32 (param i32) (nop))
(func (export "win16_app_dll_staging_size") (result i32) (global.get $WIN16_APP_DLL_STAGING_SIZE))
(func $dbg_recompute (nop))
(func $win16_dll_path_forget (param i32) (nop))
(export "win16_bridge_module_provisional" (func $win16_bridge_module_provisional))
(export "win16_bridge_module_record" (func $win16_bridge_module_record))
(export "win16_bridge_module_load_allowed" (func $win16_bridge_module_load_allowed))
(func $cs_pop (nop))
(func $gs16 (param $p i32) (param $v i32) (i32.store16 (call $g2w (local.get $p)) (local.get $v)))
(func $gl16 (param $p i32) (result i32) (i32.load16_u (call $g2w (local.get $p))))
(func $gl32 (param $p i32) (result i32) (i32.load (call $g2w (local.get $p))))
(func $gl8 (param $p i32) (result i32) (i32.load8_u (call $g2w (local.get $p))))
(func $win16_dispatch (param $off i32) (param $ret i32)
  (if (i32.ne (local.get $off) (global.get $WIN16_BRIDGE_RETURN)) (then (unreachable)))
  (call $win16_bridge_invoke_return (local.get $ret)))
(func $page_watch_write (param i32 i32) (nop))
(func $process_code_cache_invalidate (param i32 i32) (nop))
${globals}\n${code}\n${probes}\n${exportedHelpers}`;
const compiled=compileClosure({source,vfs:new Map()},{tailCalls:true});assert(compiled.success,compiled.error);
const moduleUnderTest=new WebAssembly.Module(compiled.wasmBinary),memory=new WebAssembly.Memory({initial:1024,maximum:1024,shared:true});
const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
const BASE=0x30000000,BACKING=0x100000,shared=BACKING+943*65536+0xf000;
let initialized=false,ensureCalls=0,failEnsure=false,releaseBetween=false;
const translate=guest=>{if(guest>=BASE){assert(initialized,'access to released arena');return BACKING+guest-BASE;}return guest;};
function instance(id) {
 const e=new WebAssembly.Instance(moduleUnderTest,{host:{memory,
 ensure(){ensureCalls++;if(failEnsure)return 0;if(!initialized){bytes.fill(0,BACKING,BACKING+944*65536);view.setUint32(4096,BASE,true);initialized=true;}if(releaseBetween){releaseBetween=false;assert.equal(second.win16_process_arena_release(),1);}return BASE;},
 release(){initialized=false;return 1;},g2w:translate,
 unexpectedLegacy(){throw Error('Legacy KERNEL handler reached');},
 write(guest,value){view.setUint32(translate(guest),value,true);},
 }}).exports;
 e.set_current_thread_id(id);const delta=(id-1)*0x100;
 for(const n of ['reg_base','fpu_base','mmx_base','xmm_base'])e['set_'+n](fixture[n]+delta);
 return e;
}
const first=instance(1),second=instance(2);
for(const ordinal of [95,96])assert.throws(()=>first.win16_kernel(ordinal),/Legacy KERNEL handler reached/,'ordinary NE dispatch still reaches its handler');
const cpu=(e)=>({globals:Object.fromEntries(saved.map(n=>[n,e['get_'+n]()])),files:Object.fromEntries(['reg','fpu','mmx','xmm'].map(n=>{const p=e['get_'+n+'_base']();return[n,bytes.slice(p,p+(n==='reg'?32:128))];}))});
function seed(e,value){
 for(let i=0;i<saved.length;i++)e['set_'+saved[i]]((value+i*0x10203)|0);
 e.set_code16(0);e.set_is_win16(0);
 for(const n of ['reg','fpu','mmx','xmm']){const p=e['get_'+n+'_base']();bytes.fill(value&255,p,p+(n==='reg'?32:128));}
 view.setUint32(e.get_reg_base()+16,0x7ff00,true);
}
function name(value) {const b=Buffer.alloc(16);b[0]=value.length;b.write(value,1,'ascii');return[b.readBigUInt64LE(0),b.readBigUInt64LE(8)];}
const one=first.win16_bridge_frame_begin(),two=second.win16_bridge_frame_begin();assert(one&&two);
const claim=(e,n)=>e.win16_bridge_module_claim(...name(n));
assert.equal(first.win16_bridge_module_claim(0n,0n),0);
const id=claim(first,'PMPRO62');assert(id>=13);const rec=first.win16_bridge_module_record(id);
assert.equal(view.getUint32(rec,true),1);assert.equal(view.getUint32(rec+8,true),1);
assert.equal(claim(second,'PMPRO62'),0,'uninitialized module never published to another owner');
assert.equal(second.win16_bridge_module_rollback(id),0,'wrong-owner rollback rejected');
assert.equal(first.win16_bridge_module_load_allowed(id),0,'cannot load without staging lease');
assert.equal(first.win16_bridge_module_stage_begin(id),1);
assert.equal(first.win16_bridge_module_load_allowed(id),1);assert.equal(second.win16_bridge_module_load_allowed(id),0,'reject foreign load before allocation');
const noFrame=instance(3),beforeLoader=Buffer.from(bytes);
assert.equal(noFrame.load_ne_dll_sized(id,1024),0,'actual loader rejects foreign no-frame owner id');
assert.equal(noFrame.load_ne_dll_sized(id+1,1024),0,'actual loader rejects foreign no-frame other id');
assert.equal(second.load_ne_dll_sized(id,1024),0,'actual loader rejects foreign framed instance');
assert.deepEqual(Buffer.from(bytes),beforeLoader,'rejection performs no allocation or memory writes');
noFrame.set_is_win16(1);assert.equal(noFrame.win16_bridge_module_load_allowed(id),1,'pure NE path preserved');
assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0,'trap-capable staging owns no mutex');
assert.equal(claim(second,'OTHER'),0,'staging lease excludes another owner');assert.equal(second.win16_bridge_frame_begin(),0n);
const allocation=first.win16_arena_take(3);assert(allocation);
first.win16_bridge_module_provisional(id,allocation,3);
assert.equal(view.getUint32(rec+16,true),allocation);assert.equal(view.getUint32(rec+20,true),3);
// Relocation failure before legacy loader publication: reclaim the actual run.
assert.equal(first.win16_bridge_module_rollback(id),1);assert(bytes.subarray(rec,rec+32).every(v=>v===0));
assert.equal(view.getUint32(shared+40,true),0);assert.equal(view.getUint32(shared+44,true),0);
const reused=first.win16_arena_take(3);assert.equal(reused,allocation);first.win16_arena_give(reused,3);
function staged(moduleName) {
 const id=claim(first,moduleName);assert(id>0);assert.equal(first.win16_bridge_module_stage_begin(id),1);
 const start=first.win16_arena_take(3);first.win16_bridge_module_provisional(id,start,3);
 const r=first.win16_dll_rec(id),header=translate(first.win16_arena_slot_base(start));
 bytes.fill(0,header,header+128);view.setUint16(header+4,64,true);view.setUint16(header+6,7,true);
 bytes.set([1,1,1,5,0,0,0],header+64);
 view.setUint16(header+0x16,1,true);view.setUint16(header+0x14,2,true);
 view.setUint16(header+0x0e,2,true);view.setUint16(header+0x10,1024,true);
 view.setUint16(header+0x26,80,true);view.setUint16(header+0x28,87,true);
 bytes.set([3,87,69,80,1,0,0],header+80);
 view.setUint32(r,header,true);view.setUint32(r+8,header,true);view.setUint32(r+4,start-1,true);view.setUint32(r+12,2,true);
 view.setUint32(first.win16_dll_run_ptr(id),3,true);assert.equal(first.win16_bridge_module_stage_end(id),1);
 return{id,start,record:first.win16_bridge_module_record(id)};
}
const failed=staged('REJECT');
const initScope=first.win16_bridge_frame_begin();assert.equal(first.win16_bridge_scope_begin(initScope),1);
assert.equal(first.win16_bridge_module_entry(failed.id,1),0,'initializer exports unpublished');
assert.equal(first.win16_bridge_module_init(failed.id,0),(((failed.start<<3)|7)<<16)|2);
assert.equal(first.win16_bridge_module_init(failed.id,1),((failed.start+1)<<3)|7);
assert.equal(first.win16_bridge_module_init(failed.id,2),1024);
assert.equal(second.win16_bridge_module_init(failed.id,0),0);
assert.equal(first.win16_bridge_frame_end(initScope),1);
assert.equal(first.win16_bridge_module_publish(failed.id,0),0,'AX zero cannot publish');
assert.equal(claim(second,'REJECT'),0);assert.equal(first.win16_bridge_module_rollback(failed.id),1);
assert.equal(first.win16_dll_loaded(failed.id),0);const recovered=first.win16_arena_take(3);assert.equal(recovered,failed.start);first.win16_arena_give(recovered,3);
const accepted=staged('GOOD');assert.equal(second.win16_bridge_module_publish(accepted.id,1),0);
assert.equal(first.win16_bridge_module_publish(accepted.id,1),1);assert.equal(view.getUint32(accepted.record,true),3);assert.equal(first.win16_bridge_module_load_allowed(accepted.id),0,'cannot replace a ready module');
assert.equal(first.win16_bridge_module_entry(accepted.id,1),0,'lookup needs lifetime lease');
const scope=first.win16_bridge_frame_begin();assert.equal(first.win16_bridge_scope_begin(scope),1);
assert.equal(first.win16_bridge_scope_begin(scope),0,'one scope lease per frame');
assert.equal(first.win16_bridge_module_entry(accepted.id,1),(((accepted.start<<3)|7)<<16)|5);
assert.equal(first.win16_bridge_module_entry(accepted.id,2),0,'ordinal hole');
assert.equal(first.win16_bridge_module_entry(accepted.id,0),0,'invalid ordinal');
assert.equal(second.win16_bridge_module_entry(accepted.id,1),0,'foreign lease');
bytes.set([3,87,69,80],0x70000);assert.equal(first.win16_bridge_module_ordinal(accepted.id,0x70000),1);
assert.equal(first.win16_bridge_module_init(accepted.id,0),0,'ready is no longer initializing');
const loadedRecord=first.win16_dll_rec(accepted.id),savedHeader=view.getUint32(loadedRecord,true);
view.setUint32(loadedRecord,memory.buffer.byteLength-1,true);
assert.throws(()=>first.win16_bridge_module_entry(accepted.id,1),WebAssembly.RuntimeError);
assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0,'export parser trap leaves no held mutex');
view.setUint32(loadedRecord,savedHeader,true);

assert.equal(first.win16_bridge_frame_end(scope),1);assert.equal(view.getUint32(shared+44,true),0);
assert.equal(claim(second,'GOOD'),-accepted.id,'ready lookup acquires reference without another init');
assert.equal(view.getUint32(accepted.record+8,true),2);assert.equal(first.win16_bridge_module_rollback(accepted.id),0,'ready reference cannot be rolled back');
// A parent owns exactly the dependency references transferred to it.
const parent=staged('PARENT');
assert.equal(second.win16_bridge_module_link(parent.id,accepted.id),0,'foreign parent');
assert.equal(first.win16_bridge_module_link(parent.id,parent.id),0,'no self cycle');
assert.equal(first.win16_bridge_module_link(parent.id,accepted.id),1);
assert.equal(first.win16_bridge_module_link(parent.id,accepted.id),0,'duplicate does not consume reference');
const depMask=1<<(accepted.id-13);
assert.equal(first.win16_bridge_module_dependencies(parent.id),depMask);
assert.equal(second.win16_bridge_module_dependencies(parent.id),-1);
assert.equal(first.win16_bridge_module_rollback(parent.id),1);
assert.equal(first.win16_bridge_module_release_begin(accepted.id),0,'rollback drops transferred reference only');
assert.equal(view.getUint32(accepted.record+8,true),1);
assert.equal(first.win16_bridge_module_release_begin(accepted.id),1,'last reference reserves termination');
assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0,'no mutex over termination');
assert.equal(claim(second,'GOOD'),0,'terminating module cannot be acquired');
assert.equal(second.win16_bridge_module_release_begin(accepted.id),-1);
assert.equal(second.win16_bridge_module_release_finish(accepted.id),0);
assert.equal(second.win16_bridge_frame_begin(),0n,'termination excludes foreign allocation');
assert.equal(first.win16_bridge_module_rollback(accepted.id),0,'termination needs exact finish');
assert.equal(first.win16_bridge_module_dependencies(accepted.id),0);
assert.equal(first.win16_bridge_module_release_finish(accepted.id),1);
assert.equal(first.win16_bridge_module_release_finish(accepted.id),0,'stale finish');
assert.equal(first.win16_dll_loaded(accepted.id),0);
assert(bytes.subarray(accepted.record,accepted.record+32).every(v=>v===0));
assert.equal(view.getUint32(shared+40,true),0);assert.equal(view.getUint32(shared+44,true),0);
const afterUnload=first.win16_arena_take(3);assert.equal(afterUnload,accepted.start);first.win16_arena_give(afterUnload,3);
assert.equal(claim(first,'GOOD'),accepted.id,'name and handle slot reusable');
assert.equal(first.win16_bridge_module_rollback(accepted.id),1);
assert.equal(first.win16_bridge_frame_end(one),1);assert.equal(second.win16_bridge_frame_end(two),1);
assert.equal(first.win16_process_arena_release(),1);
console.log('PASS actual NE module transactions: unpublished ownership, mutex-free staging lease, provisional allocation rollback, AX-zero cleanup and ready reference acquisition');

// Real coordinator + actual compiled loader/allocator/entry/RETF helpers.
// Guest execution is a controlled boundary here; the native candidate executes
// these same image bytes with the complete interpreter.
const {createNeLifecycle}=require('../lib/ne-lifecycle');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
// The real loader relocates an imported far CALL before any invocation switches
// stacks. A PE caller's thunk-selector global is still zero at this boundary.
bytes.set(Buffer.from('KERNEL\0'),fixture.WIN16_NAME_KERNEL);
for (const callerThunkSelector of [0, 0x77]) {
first.set_WIN16_THUNK_SEL(callerThunkSelector);
const importCaller=cpu(first),importFrame=first.win16_bridge_frame_begin();assert(importFrame);
assert.equal(first.win16_bridge_scope_begin(importFrame),1);
const importedId=claim(first,'IMPORT');assert(importedId>0);
assert.equal(first.win16_bridge_module_stage_begin(importedId),1);
const importedImage=neLifecycleImage({importLocalInit:true});
bytes.set(importedImage,first.win16_dll_staging(importedId));
assert.equal(first.load_ne_dll_sized(importedId,importedImage.length),1);
assert.equal(first.win16_bridge_module_stage_end(importedId),1);
const importedTarget=first.win16_bridge_module_init(importedId,0);
assert(importedTarget,'owned initializer target');
const importedCode=translate(first.win16_seg_base(importedTarget>>>19));
assert.equal(view.getUint16(importedCode+8,true),15,'staged import uses process NE thunk selector');
assert.equal(view.getUint32(fixture.WIN16_THUNK_TABLE+view.getUint16(importedCode+6,true),true),0x10004,'real KERNEL.LocalInit thunk');
assert.equal(first.get_WIN16_THUNK_SEL(),callerThunkSelector,'relocation does not mutate caller selector');
assert.equal(first.win16_bridge_module_rollback(importedId),1);
assert.equal(first.win16_bridge_frame_end(importFrame),1);assert.deepEqual(cpu(first),importCaller);
}
first.set_WIN16_THUNK_SEL(0);
first.set_sync_msg_depth(0);let calls=0,whileRunning;
const lifecycleExports={...first,run(){
 calls++;whileRunning?.();const p=translate(first.get_eip());
 if(bytes[p]===0xca || bytes[p]===0xcb) {first.th_retf16(bytes[p]===0xca?view.getUint16(p+1,true):0);return;}
 assert.equal(bytes[p],0xb8);view.setUint32(first.get_reg_base(),view.getUint16(p+1,true),true);
 view.setUint32(first.get_reg_base()+8,0,true);
 first.th_retf16(bytes[p+3]===0xca?view.getUint16(p+4,true):0);
}};
const images=new Map([
 ['HELPER',neLifecycleImage()],['PARENT',neLifecycleImage({dependencies:['HELPER']})],
 ['ZERO',neLifecycleImage({result:0,dependencies:['HELPER']})],
 ['TRAP',neLifecycleImage({trapInit:true,dependencies:['HELPER']})],
 ['BADWEP',neLifecycleImage({trapWep:true,dependencies:['HELPER']})],
 ['MISSING',neLifecycleImage({dependencies:['ABSENT']})],
 ['CYCLE',neLifecycleImage({dependencies:['CYCLE']})],
 ['MISSORD',neLifecycleImage({importEntry:{module:'HELPER',symbol:4}})],
 ['MISSNAME',neLifecycleImage({importEntry:{module:'HELPER',symbol:'ABSENT'}})],
 ['HASORD',neLifecycleImage({importEntry:{module:'HELPER',symbol:2}})],
 ['HASNAME',neLifecycleImage({importEntry:{module:'HELPER',symbol:'VALUE'}})],
 ['BADDEP',neLifecycleImage({trapWep:true})],
 ['BADPARENT',neLifecycleImage({dependencies:['BADDEP']})],
 ['BADZERO',neLifecycleImage({result:0,dependencies:['BADDEP']})],
 ['BADTRAP',neLifecycleImage({trapInit:true,dependencies:['BADDEP']})],
]);
const lifecycle=createNeLifecycle(lifecycleExports,memory,images);
assert.throws(()=>lifecycle.load('MISSING'),/Missing NE image/);
assert.throws(()=>lifecycle.load('CYCLE'),/recursive NE dependency/);
const beforeMissing=bytes.slice(),missingCaller=cpu(first);
for(const name of ['MISSORD','MISSNAME'])assert.throws(()=>lifecycle.load(name),/Missing NE import HELPER/);
assert.deepEqual(bytes,beforeMissing,'static missing imports perform no allocation or publication');
assert.deepEqual(cpu(first),missingCaller);assert.equal(calls,0);
// An already-ready dependency may differ from this coordinator's source map.
// Its missing exports must roll back the parent and the newly acquired ref.
const foreignImage=neLifecycleImage();
foreignImage.set([1,1,1,0,0,1,0,1,1,1,32,0,0],0x80+0x60);
foreignImage[0x80+0x70+6]=0; // Keep WEP, omit VALUE's name and ordinal 2.
const foreignLifecycle=createNeLifecycle(lifecycleExports,memory,new Map([['HELPER',foreignImage]]));
const foreignId=foreignLifecycle.load('HELPER');
for(const name of ['HASORD','HASNAME']) {
 const before=calls;
 assert.throws(()=>lifecycle.load(name),/Missing loaded NE import HELPER/);
 assert.equal(calls,before,'parent initializer never executes');assert.deepEqual(cpu(first),missingCaller);
 const frame=first.win16_bridge_frame_begin();assert(frame);
 for(let id=13;id<37;id++) {
  const rec=first.win16_bridge_module_record(id);
  assert.equal(view.getUint32(rec,true),id===foreignId?3:0,'parent fully rolled back');
  if(id===foreignId)assert.equal(view.getUint32(rec+8,true),1,'acquired dependency reference rolled back');
 }
 assert.equal(first.win16_bridge_frame_end(frame),1);
 for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0);
}
foreignLifecycle.release(foreignId);calls=0;
const parentId=lifecycle.load('parent.dll'),afterInit=calls;
assert.equal(afterInit,2,'dependency then parent initialized exactly once');
const parentInstance=first.win16_dll_data_sel(parentId);
const parentHandle=first.win16_h16(0x00d10000|parentId);
assert.equal(first.win16_module_usage(parentInstance),1);
assert.equal(first.win16_module_usage(parentHandle),1);
assert.equal(lifecycle.load('PARENT'),parentId);assert.equal(calls,afterInit,'ready acquisition skips initializer');
assert.equal(first.win16_module_usage(parentInstance),2);
assert.equal(first.win16_module_usage(parentHandle),2);
// Legacy loaded DLLs have an implicit import ref until LoadLibrary records an
// explicit count. Use the actual loaded record with bridge ownership removed
// temporarily; restore it before exercising coordinator lifecycle operations.
const usageRecord=first.win16_handle_table()+0x8c00+(parentId-13)*32;
const legacyRefs=first.win16_dll_refs_ptr(parentId),oldLegacyRefs=view.getUint32(legacyRefs,true);
view.setUint32(usageRecord,0,true);
for(const [stored,expected] of [[0,1],[1,1],[2,2],[1,1]]) {
 view.setUint32(legacyRefs,stored,true);assert.equal(first.win16_module_usage(parentInstance),expected);
 assert.equal(first.win16_module_usage(parentHandle),expected);
}
view.setUint32(usageRecord,3,true);view.setUint32(legacyRefs,oldLegacyRefs,true);
// A selector above HANDLE_BASE must not be rejected merely for lacking a
// handle-table slot. Preserve the real module's original segment base.
const dllRecord=first.win16_dll_rec(parentId),oldBase=view.getUint32(dllRecord+4,true);
view.setUint32(dllRecord+4,100,true);
const highInstance=first.win16_dll_data_sel(parentId),handleTable=first.win16_handle_table();
assert.equal(first.win16_module_usage(highInstance),2);
const oldNext=first.win16_handle_next_get(),collisionSlot=handleTable+(highInstance-0x100)*4;
const oldCollision=view.getUint32(collisionSlot,true);
first.win16_handle_next_set(highInstance-0x100);view.setUint32(collisionSlot,0x12345678,true);
assert.equal(first.win16_module_usage(highInstance),2,'live DGROUP wins over unrelated UI mapping');
view.setUint32(collisionSlot,oldCollision,true);first.win16_handle_next_set(oldNext);
view.setUint32(dllRecord+4,oldBase,true);
// Real alias allocation must never produce selector-shaped values, including
// reuse of a vacant slot. Generic object allocation may use those slots.
const tableBefore=bytes.slice(handleTable,handleTable+0x4000);
bytes.fill(0,handleTable,handleTable+0x4000);first.win16_handle_next_set(0);
for(let i=1;i<=6;i++)assert.equal(first.win16_h16(0x10000+i),0x100+i);
assert.equal(first.win16_h16(0x00d10001),0x108,'skip selector-shaped new slot');
assert.equal(first.win16_h16(0x00d10002),0x109,'skip selector-shaped free slot');
assert.equal(first.win16_h16(0x12345678),0x107,'UI map capacity preserved');
for(let i=3;i<37;i++)assert.notEqual(first.win16_h16(0x00d10000+i)&7,7);
bytes.set(tableBefore,handleTable);first.win16_handle_next_set(oldNext);
// Exhaust real alias allocation: it traps before changing the explicit count,
// and never leaves the loader mutex held. Restore only fixture-owned bytes.
const fullMap=bytes.slice(handleTable,handleTable+4097*4),fullNext=first.win16_handle_next_get();
const aliasFrame=first.win16_bridge_frame_begin();assert(aliasFrame);
assert.equal(first.win16_bridge_scope_begin(aliasFrame),1);
try {
 for(let i=1;i<=4096;i++)view.setUint32(handleTable+i*4,0x12345678,true);
 first.win16_handle_next_set(4096);
 const count=first.win16_bridge_fixed_usage(12);
 assert.throws(()=>first.win16_bridge_fixed_acquire(12),WebAssembly.RuntimeError);
 assert.equal(first.win16_bridge_fixed_usage(12),count,'failed alias leaves refs unchanged');
 assert.equal(view.getUint32(fixture.DLL_LOAD_LOCK,true),0,'no mutex retained after alias trap');
} finally {
 bytes.set(fullMap,handleTable);first.win16_handle_next_set(fullNext);
 assert.equal(first.win16_bridge_frame_end(aliasFrame),1);
}
for(const h of [0,0xffff,0xfffe,0x100,first.win16_h16(0x12345678)])assert.equal(first.win16_module_usage(h),0);
// A standalone task still queries its legacy fixed-id image reference count.
const legacyFixed=first.win16_dll_rec(3),legacyFixedRefs=first.win16_dll_refs_ptr(3);
const savedFixed=bytes.slice(legacyFixed,legacyFixed+16),savedFixedRefs=view.getUint32(legacyFixedRefs,true);
const legacyFixedHandle=first.win16_h16(0x00d10003),wasWin16=first.get_is_win16();
try {
 view.setUint32(legacyFixed+12,1,true);view.setUint32(legacyFixedRefs,7,true);first.set_is_win16(1);
 assert.equal(first.win16_module_usage(legacyFixedHandle),7,'standalone fixed legacy count preserved');
} finally {
 first.set_is_win16(wasWin16);bytes.set(savedFixed,legacyFixed);view.setUint32(legacyFixedRefs,savedFixedRefs,true);
 first.win16_h16_forget(0x00d10003);
}
// Execute the real argument reader, KERNEL dispatcher and far API return.
// Only the outer controlled guest runner is synthetic in this tiny harness.
function queryUsage(handle,expected) {
 const before=cpu(first),stack=0x7fd00,oldStack=bytes.slice(stack,stack+6),reg=first.get_reg_base();
 view.setUint16(stack,0x10,true);view.setUint16(stack+2,first.get_sreg_cs(),true);view.setUint16(stack+4,handle,true);
 view.setUint32(reg+16,stack,true);
 const immutable=bytes.slice(BACKING,BACKING+944*65536);
 assert.equal(first.win16_kernel(48),1);
 assert.equal(view.getUint32(reg,true),expected);assert.equal(view.getUint32(reg+16,true),stack+6,'Pascal WORD cleanup');
 assert.equal(first.get_eip(),first.get_seg_base_cs()+0x10,'far return restored');
 assert.equal(first.get_sreg_ds(),before.globals.sreg_ds);assert.equal(first.get_sreg_ss(),before.globals.sreg_ss);
 assert.deepEqual(bytes.slice(BACKING,BACKING+944*65536),immutable,'query leaves module records/refs/pins untouched');
 for(const [n,v] of Object.entries(before.globals))first['set_'+n](v);
 for(const [n,b] of Object.entries(before.files))bytes.set(b,first['get_'+n+'_base']());
 bytes.set(oldStack,stack);
}
assert(lifecycle.lookup(parentId,'VALUE'));assert.equal(lifecycle.lookup(parentId,'WEP'),lifecycle.lookup(parentId,3));
assert.equal(lifecycle.lookup(parentId,'MISSING'),0);assert.equal(lifecycle.lookup(parentId,4),0);
whileRunning=()=>{
 const r=first.win16_bridge_module_record(parentId);assert.equal(view.getUint32(r+24,true),1,'active module pin');
 queryUsage(parentInstance,2);queryUsage(parentHandle,2);queryUsage(0xfffe,0);
 const apiBefore=cpu(first),reg=first.get_reg_base(),apiSp=view.getUint32(reg+16,true)-16;
 const apiAt=translate(apiSp),apiBytes=bytes.slice(apiAt,apiAt+8),fixedState=bytes.slice(4104,4304);
 try {
  view.setUint32(reg+16,apiSp,true);
  view.setUint16(apiAt,0,true);view.setUint16(apiAt+2,first.get_sreg_cs(),true);
  view.setUint16(apiAt+4,0xffff,true);view.setUint16(apiAt+6,first.get_sreg_ds(),true);
  assert.equal(first.win16_bridge_fixed_api_stack(8),1,'valid owned Pascal frame');
  assert.equal(first.win16_bridge_fixed_load_api(),0,'name outside selector');
  assert.equal(first.win16_bridge_fixed_free_api(),0,'unknown handle');
  view.setUint16(apiAt+2,0,true);
  assert.equal(first.win16_bridge_fixed_load_api(),0,'invalid far return selector');
  assert.equal(first.win16_bridge_fixed_free_api(),0,'invalid far return selector');
  view.setUint32(reg+16,first.get_seg_base_ss()+65534,true);
  assert.equal(first.win16_bridge_fixed_load_api(),0,'truncated load stack');
  assert.equal(first.win16_bridge_fixed_free_api(),0,'truncated free stack');
  assert.deepEqual(bytes.slice(4104,4304),fixedState,'malformed calls leave all fixed refs unchanged');
  const nameAt=translate(first.get_seg_base_ds()+0x80),savedName=bytes.slice(nameAt,nameAt+7);
  const scratchAt=fixture.GUEST_STACK+0x200,scratchBefore=bytes.slice(scratchAt,scratchAt+64);
  const count=first.win16_bridge_fixed_usage(1);
  try {
   bytes.set([75,69,82,78,69,76,0],nameAt);
   view.setUint32(reg+16,apiSp,true);view.setUint16(apiAt+2,first.get_sreg_cs(),true);
   view.setUint16(apiAt+4,0x80,true);view.setUint16(apiAt+6,first.get_sreg_ds(),true);
   assert.equal(first.win16_kernel(95),1,'actual narrow fixed acquisition');
   const handle=view.getUint16(reg,true);assert(handle>=32);
   assert.equal(first.win16_bridge_fixed_usage(1),count+1);
   assert.deepEqual(bytes.slice(scratchAt,scratchAt+64),scratchBefore,'PE fixed stack scratch untouched');
   view.setUint32(reg+16,apiSp,true);view.setUint16(apiAt+4,handle,true);
   assert.equal(first.win16_kernel(96),1);assert.equal(first.win16_bridge_fixed_usage(1),count);
  } finally {bytes.set(savedName,nameAt);}
 } finally {
  bytes.set(apiBytes,apiAt);
  for(const [n,v] of Object.entries(apiBefore.globals))first['set_'+n](v);
  for(const [n,b] of Object.entries(apiBefore.files))bytes.set(b,first['get_'+n+'_base']());
 }
 const beforeGuestFree=bytes.slice(),beforeGlobals=saved.map(n=>first['get_'+n]());
 for(const ordinal of [95,96])assert.throws(()=>first.win16_kernel(ordinal),WebAssembly.RuntimeError,'actual KERNEL dispatcher rejects bridge guest lifecycle');
 assert.deepEqual(bytes,beforeGuestFree,'rejected guest lifecycle changes no segments/refs/pins');
 assert.deepEqual(saved.map(n=>first['get_'+n]()),beforeGlobals);
 // Two refs: dropping the extra ref is legal; freeing the executing image is not.
 lifecycle.release(parentId);assert.throws(()=>lifecycle.release(parentId),/release rejected/);
 queryUsage(parentInstance,1);
};
const savedBuffer=global.Buffer;global.Buffer=undefined;
try {
 assert.equal(lifecycle.call(parentId,'VALUE'),0x1234);
 assert.equal(lifecycle.load('PARENT'),parentId,'browser-like name packing without Buffer');
} finally {global.Buffer=savedBuffer;whileRunning=undefined;}
const afterCall=calls;

lifecycle.release(parentId);assert.equal(calls,afterCall,'extra reference does not terminate');
whileRunning=()=>{
 const r=first.win16_bridge_module_record(parentId);
 assert.equal(view.getUint32(r,true),4,'final WEP retains terminating module');
 queryUsage(parentInstance,1);queryUsage(parentHandle,1);whileRunning=undefined;
};
lifecycle.release(parentId);assert.equal(calls,afterCall+2,'parent and sole dependency WEP executed');
assert.equal(first.win16_module_usage(parentInstance),0);assert.equal(first.win16_module_usage(parentHandle),0,'stale module handle');
assert.equal(lifecycle.lookup(parentId,2),0,'retired module not visible');
for(const name of ['ZERO','TRAP']) {
 assert.throws(()=>lifecycle.load(name),name==='ZERO'?/AX zero/:WebAssembly.RuntimeError);
 for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'failed-init restores lease/frame');
 const inspect=first.win16_bridge_frame_begin();
 for(let id=13;id<37;id++)assert.equal(view.getUint32(first.win16_bridge_module_record(id),true),0,'all failed-init ownership cleared');
 assert.equal(first.win16_bridge_frame_end(inspect),1);
}
const failing=lifecycle.load('BADWEP');
assert.throws(()=>lifecycle.release(failing),error=>error.code==='NE_TERMINATION_PENDING'&&error.moduleId===failing&&error.cause instanceof WebAssembly.RuntimeError);
assert.equal(view.getUint32(shared+36,true),0,'caller context restored after failed WEP');
assert.equal(view.getUint32(shared+44,true),1,'failed termination retains lease');
assert.throws(()=>lifecycle.load('BADWEP'),/busy/);assert.equal(lifecycle.lookup(failing,2),0);
const repair=first.win16_bridge_frame_begin(),failureRecord=first.win16_bridge_module_record(failing);
assert.equal(view.getUint32(failureRecord,true),4);assert(first.win16_bridge_module_dependencies(failing)>0);
const wep=first.win16_bridge_module_termination(failing,0),codeBase=first.win16_seg_base(wep>>>19);
bytes.set([0xb8,1,0,0xca,2,0],translate(codeBase+(wep&65535)));
assert.equal(first.win16_bridge_frame_end(repair),1);
lifecycle.retryTermination(failing);
for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'retry finishes retained owner and dependency');
for(const name of ['BADPARENT','BADZERO','BADTRAP']) {
 let error;
 try {const id=lifecycle.load(name);lifecycle.release(id);} catch(failure) {error=failure;}
 assert(error instanceof AggregateError);assert.equal(error.pendingTerminations.length,1,'indirect failure exposes recovery id');
 const [dependencyId]=error.pendingTerminations;
 const cause=error.errors.find(e=>e.code==='NE_TERMINATION_PENDING');
 assert(cause);assert.equal(cause.moduleId,dependencyId);assert(cause.cause instanceof WebAssembly.RuntimeError);
 if(name==='BADZERO')assert.match(error.errors[0].message,/AX zero/);
 if(name==='BADTRAP')assert(error.errors[0] instanceof WebAssembly.RuntimeError);
 assert.equal(view.getUint32(shared+36,true),0);assert.equal(view.getUint32(shared+44,true),1);
 const frame=first.win16_bridge_frame_begin();assert(frame);
 for(let id=13;id<37;id++)assert.equal(view.getUint32(first.win16_bridge_module_record(id),true),id===dependencyId?4:0,'only failed dependency remains');
 const target=first.win16_bridge_module_termination(dependencyId,0),base=first.win16_seg_base(target>>>19);
 bytes.set([0xb8,1,0,0xca,2,0],translate(base+(target&65535))); // Synthetic repair only.
 assert.equal(first.win16_bridge_frame_end(frame),1);
 lifecycle.retryTermination(dependencyId);
 for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'indirect dependency retry releases final lease');
 assert.deepEqual(cpu(first),missingCaller);
}
assert.equal(first.win16_process_arena_release(),1);
console.log('PASS real NE lifecycle coordinator/loader: dependency refs, init/publication, named lookup, WEP, rollback and retained failed termination (guest run controlled)');
