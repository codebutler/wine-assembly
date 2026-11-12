#!/usr/bin/env node
'use strict';
// Offline independent interpreter: executes the wrapper AND production ownership/
// spill primitives, unlike the implementation oracle's modeled enter/leave.
// Run, guest translation, flags, IO, dbg_recompute and beep imports remain models.
// No compile, WebAssembly instantiation, native execution or guest is involved.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const parser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../tools/watx-src/compiler-parser.js'), 'utf8'), parser);
const functions = new Map();
for (const file of ['04-cache.wat', '11-seh.wat']) {
  const input = file === '11-seh.wat' && process.argv.find(a=>a.startsWith('--source='));
  for (const n of parser.parseSource(fs.readFileSync(input ? input.slice(9) : path.join(__dirname, '../src', file), 'utf8'), file))
    if (n[1] === 'func') functions.set(n[2], n);
}
const controlNames = ['eip', 'handler_set_eip', 'steps', 'yield_reason', 'yield_flag',
  'ip', 'resume_ip', 'eip_redirected', 'cur_page_base', 'cur_page_index', 'cur_page_chunk',
  'cur_page_desc', 'cur_page_chunk_cap', 'cur_page_desc_cap'].map(s => '$'+s);
class Trap extends Error {}
class Return { constructor(value) {this.value=value;} }
class Jump { constructor(label) {this.label=label;} }
function fixture({depth=0, syncDepth=depth, spill=false, ip=150, handlers=[0], lazy=false}={}) {
  const memory = new DataView(new ArrayBuffer(131072));
  const g = Object.fromEntries(controlNames.map((s,i)=>[s,101+i]));
  Object.assign(g, {$reg_base:0, $fs_base:8192, $sync_msg_ret_thunk:0x1234, $seh_node_thunk:0x9876,
    $fault_sync_active:0, $fault_sync_epoch:8, $fault_raising:0, $current_thread_id:1,
    $invocation_root:lazy?0n:10n, $invocation_epoch:lazy?0n:9n,
    $invocation_slot:lazy?0:65552, $invocation_tid:lazy?0:1,
    $invocation_depth:depth, $sync_msg_depth:syncDepth, $guest_can_block:1,
    $spill_active:Number(spill), $spill_base:100, $spill_end:200,
    $spill_pins:0, $spill_desk_forced:0, $ip:ip});
  const w=(p,v)=>memory.setInt32(p,v,true), r=p=>memory.getInt32(p,true);
  const w64=(p,v)=>memory.setBigInt64(p,BigInt.asIntN(64,v),true), r64=p=>memory.getBigInt64(p,true);
  w64(65536,100n); w64(65544,9n); w64(65552,lazy?0n:10n);
  for(let i=0;i<=depth;i++)w64(65568+i*8,10n+BigInt(i));
  for(let i=0;i<8;i++)w(i*4,i===4?16384:200+i);
  w(8192,handlers.length?9000:-1);
  handlers.forEach((value,i)=>{w(9000+16*i,i+1<handlers.length?9016+16*i:-1);w(9004+16*i,value==='dispatch'?0x9876:10000+16*i);});
  let flags=0x200a97, runs=0, fills=0, leaves=0, runHook, ioHook=()=>1, afterLeave=()=>{};
  const visits=[], pins=[];
  const cpu=()=>({g:Object.fromEntries(controlNames.map(s=>[s,g[s]])),regs:Array.from({length:8},(_,i)=>r(i*4)),flags});
  const complete=(value=0)=>{g.$eip=0;w(0,value);};
  runHook=()=>{const idx=(g.$eip-10000)/16; complete(handlers[idx]);};
  function call(name, args=[]) {
    if(name==='$run') {runs++; visits.push(r64(g.$invocation_slot+16+8*g.$invocation_depth)); pins.push(g.$spill_pins); return runHook();}
    if(name==='$host_io_fill_sync') {fills++;return ioHook();}
    if(name==='$build_eflags')return flags;
    if(name==='$load_eflags'){flags=args[0];return;}
    if(name==='$g2w')return args[0];
    if(name==='$gl32')return r(args[0]);
    if(name==='$gs32'){w(...args);return;}
    if(name==='$zero_memory'){for(let i=0;i<args[1];i++)memory.setUint8(args[0]+i,0);return;}
    if(name==='$dbg_recompute' || name.startsWith('$host_beep_'))return 0;
    const fn=functions.get(name); assert(fn,'unmodeled call '+name);
    const l={};let arg=0;
    for(const n of fn.slice(3))if(Array.isArray(n)&&['local','param'].includes(n[1]))
      l[n[2]]=n[1]==='param'?args[arg++]:n[3]==='i64'?0n:0;
    const seq=nodes=>{let value;for(const n of nodes)value=ev(n);return value;};
    function ev(n) {
      assert(Array.isArray(n),'nonfolded AST unsupported');
      const op=n[1],a=n.slice(2),v=i=>ev(a[i]);
      switch(op) {
        case 'local':case 'param':case 'result':return;
        case 'local.get':assert(a[0] in l);return l[a[0]];
        case 'global.get':assert(a[0] in g,a[0]);return g[a[0]];
        case 'local.set':l[a[0]]=v(1);return;
        case 'global.set':g[a[0]]=v(1);return;
        case 'i32.const':return Number(a[0])|0;
        case 'i64.const':return BigInt.asIntN(64,BigInt(a[0]));
        case 'i32.add':return (v(0)+v(1))|0;
        case 'i32.sub':return (v(0)-v(1))|0;
        case 'i32.mul':return Math.imul(v(0),v(1));
        case 'i32.shl':return v(0)<<v(1);
        case 'i32.and':return v(0)&v(1);
        case 'i32.or':return v(0)|v(1);
        case 'i32.xor':return v(0)^v(1);
        case 'i32.wrap_i64':return Number(BigInt.asIntN(32,v(0)));
        case 'i64.add':return BigInt.asIntN(64,v(0)+v(1));
        case 'i64.shr_u':return BigInt.asUintN(64,v(0))>>(v(1)&63n);
        case 'i32.eqz':return Number(v(0)===0);
        case 'i64.eqz':return Number(v(0)===0n);
        case 'i32.eq':case 'i64.eq':return Number(v(0)===v(1));
        case 'i32.ne':case 'i64.ne':return Number(v(0)!==v(1));
        case 'i32.ge_u':return Number((v(0)>>>0)>=(v(1)>>>0));
        case 'i32.lt_u':return Number((v(0)>>>0)<(v(1)>>>0));
        case 'select':{const x=v(0),y=v(1),c=v(2);return c?x:y;}
        case 'region.addr':assert.equal(a[0],'$CALLBACK_OWNERSHIP');return 65536+(Number(a[1])||0);
        case 'i32.load':case 'i32.store':case 'i64.load':case 'i64.store': {
          const offset=typeof a[0]==='string'?Number(a.shift().split('=')[1]):0;
          const p=ev(a[0])+offset;
          if(op==='i32.load')return r(p);
          if(op==='i64.load')return r64(p);
          if(op==='i32.store')w(p,ev(a[1]));else w64(p,ev(a[1]));return;
        }
        case 'i64.atomic.load':return r64(v(0));
        case 'i64.atomic.store':w64(v(0),v(1));return;
        case 'i64.atomic.rmw.cmpxchg':{const p=v(0),expected=v(1),value=v(2),old=r64(p);if(old===expected)w64(p,value);return old;}
        case 'drop':v(0);return;
        case 'call':return call(a[0],a.slice(1).map(ev));
        case 'if':return v(0)?seq(a[1].slice(2)):a[2]?seq(a[2].slice(2)):undefined;
        case 'return':throw new Return(a.length?v(0):undefined);
        case 'unreachable':throw new Trap('production unreachable');
        case 'br':throw new Jump(a[0]);
        case 'br_if':if(v(1))throw new Jump(a[0]);return;
        case 'block':try{return seq(a.slice(1));}catch(e){if(!(e instanceof Jump&&e.label===a[0]))throw e;return;}
        case 'loop':for(let i=0;i<10000;i++){const label=typeof a[0]==='string'?a[0]:null;try{return seq(a.slice(label?1:0));}catch(e){if(!(e instanceof Jump&&e.label===label))throw e;}}throw Error('loop budget');
        default:throw Error('unsupported opcode '+op);
      }
    }
    let result;
    try {result=seq(fn.slice(3));}catch(e){if(e instanceof Return)result=e.value;else throw e;}
    if(name==='$sync_depth_leave'){leaves++;afterLeave();}
    return result;
  }
  return {g,w,r,w64,r64,cpu,complete,visits,pins,call:()=>call('$seh_fault_sync',[0x55001234]),primitive:call,
    hook:f=>{runHook=f;},io:f=>{ioHook=f;},postLeave:f=>{afterLeave=f;},
    counts:()=>({runs,fills,leaves}),clobber:()=>{for(const s of controlNames)g[s]=777;for(let i=0;i<8;i++)w(i*4,800+i);flags=0x246;}};
}
let cases=0;
function test(label,fn){
 if(process.argv.includes('--retained-only') && label!=='production sibling replacement reproducer')return;
 fn();cases++;console.log('PASS '+label);
}
for(const depth of [0,4,30,31,32,62])test('production spill lifetime depth '+depth,()=>{
 const f=fixture({depth,spill:true,handlers:[1,0]}),before=f.cpu();
 assert.equal(f.call(),1);assert.deepEqual(f.cpu(),before);
 const bit=1<<Math.min(depth,31);assert.deepEqual(f.pins,[bit,bit]);
 assert.equal(new Set(f.visits).size,1);assert.equal(f.counts().leaves,1);
 assert.equal(f.g.$spill_pins,depth>=31?bit:0);
 assert.equal(f.g.$spill_desk_forced,Number(depth===0));
});
for(const ip of [99,100,199,200])test('unsigned spill endpoints '+ip,()=>{
 const f=fixture({depth:4,spill:true,ip});assert.equal(f.call(),1);
 assert.deepEqual(f.pins,[ip>=100&&ip<200?16:0]);
});
for(const handlers of [[],['dispatch'],['dispatch','dispatch']])test('empty/dispatch-only acquisition '+handlers.length,()=>{
 const f=fixture({handlers}),before=f.cpu(),serial=f.r64(65536);assert.equal(f.call(),0);
 assert.equal(f.r64(65536),serial+1n);assert.deepEqual(f.counts(),{runs:0,fills:0,leaves:1});assert.deepEqual(f.cpu(),before);
});
for(const syncDepth of [0,5,32])test('independently retained depths '+syncDepth,()=>{
 const f=fixture({depth:4,syncDepth});assert.equal(f.call(),1);assert.equal(f.g.$invocation_depth,4);assert.equal(f.g.$sync_msg_depth,syncDepth);
});
test('lazy bootstrap production ensure',()=>{const f=fixture({lazy:true});assert.equal(f.call(),1);assert.equal(f.g.$invocation_root,101n);assert.equal(f.g.$invocation_depth,0);});
for(const mode of ['capacity-empty','serial-exhausted','retired-root'])test('prewrite failure '+mode,()=>{
 const f=fixture({depth:mode==='capacity-empty'?63:0,handlers:mode==='capacity-empty'?[]:[0]});
 if(mode==='serial-exhausted')f.w64(65536,-1n);
 if(mode==='retired-root')f.w64(65552,123n);
 const before=f.cpu();assert.throws(f.call,Trap);assert.deepEqual(f.cpu(),before);assert.equal(f.g.$fault_sync_active,0);assert.equal(f.counts().leaves,0);
});
test('parent high bits changed beneath child',()=>{
 const f=fixture();let foreign;
 f.hook(()=>{f.clobber();f.complete();f.w64(65568,10n+0x100000000n);foreign=f.cpu();});
 assert.throws(f.call,Trap);assert.deepEqual(f.cpu(),foreign);assert.equal(f.counts().leaves,1);
});
for(const mode of ['parent','root','sync-depth','inv-depth'])test('postretirement guard '+mode,()=>{
 const f=fixture();let foreign;
 f.postLeave(()=>{
  if(mode==='parent')f.w64(65568,10n+0x100000000n);
  if(mode==='root'){f.g.$invocation_root+=0x100000000n;f.w64(65552,f.g.$invocation_root);}
  if(mode==='sync-depth')f.g.$sync_msg_depth++;
  if(mode==='inv-depth'){f.g.$invocation_depth++;f.w64(65576,10n);}
  foreign=f.cpu();
 });
 f.hook(()=>{f.clobber();f.complete();});assert.throws(f.call,Trap);assert.deepEqual(f.cpu(),foreign);
});
test('production sibling replacement reproducer',()=>{
 const f=fixture();let foreign;
 f.hook(()=>{f.primitive('$sync_depth_leave');f.primitive('$sync_depth_enter');f.clobber();f.complete();foreign=f.cpu();});
 assert.throws(f.call,Trap);assert.deepEqual(f.cpu(),foreign);assert.equal(f.counts().leaves,1);
});
for(const fill of [0,1])test('production IO sibling replacement fill '+fill,()=>{
 const f=fixture();let foreign;
 f.hook(()=>{f.g.$yield_reason=12;});
 f.io(()=>{f.primitive('$sync_depth_leave');f.primitive('$sync_depth_enter');foreign=f.cpu();return fill;});
 assert.throws(f.call,Trap);assert.deepEqual(f.cpu(),foreign);assert.deepEqual(f.counts(),{runs:1,fills:1,leaves:1});
});
for(const boundary of ['run','io'])test('ordinary JS exception '+boundary,()=>{
 const f=fixture(),error=new Error('injected import exception');let foreign;
 f.hook(()=>{f.clobber();if(boundary==='run'){foreign=f.cpu();throw error;}f.g.$yield_reason=12;});
 f.io(()=>{foreign=f.cpu();throw error;});assert.throws(f.call,e=>e===error);assert.deepEqual(f.cpu(),foreign);assert.equal(f.counts().leaves,0);
});
test('invalid AST opcode fails closed',()=>{
 const good=functions.get('$seh_fault_sync');functions.set('$seh_fault_sync',[0,'func','$seh_fault_sync',[0,'made.up']]);
 try{assert.throws(fixture().call,/unsupported opcode/);}finally{functions.set('$seh_fault_sync',good);}
});
console.log(`Independent production-primitive source review PASS: ${cases} controls; modeled host/guest boundaries; no VM/native/gameplay claim`);
