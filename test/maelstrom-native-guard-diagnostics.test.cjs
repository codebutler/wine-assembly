'use strict';
// Offline source-AST execution only. No compiler, Wasm, guest, or native execution.
const assert = require('node:assert/strict');
const { Model, parse } = require('./maelstrom-select-hook-model.cjs');
const hook = require(process.env.MNE_GUARD_HELPER || '../tools/maelstrom-native-errno-latch.cjs');
const baseline = process.argv.includes('--baseline');
const { decodeRejection, createAdapter } = require('../tools/maelstrom-original-errno-adapter.cjs');
const a = { selectRet:0x7a3362, successor:0x7a3366, frame:0x124,
  crtEntryRva:0xc430, crtTailRva:0xc435, crtRetRva:0xc438 };
const crt = 0x522000;
class Scalars extends Model {
  constructor(uop = true) {
    super('(func $handle_select )', 0, 0, false);
    this.g = { $code16:0, $block_exec_enabled:0, $uop_enabled:+uop,
      $current_thread_id:1, $reg_base:100, $eip:a.selectRet,
      $image_base:0x400000, $GUEST_BASE:0x12000 };
    for (const k of ['started','token','ret','phase','completions','fault','active','capped',
      'thread','regs','pre','post','parks','result']) this.g['$msc_'+k] = 0;
    for (const n of parse(hook.storage(a, crt, uop))) {
      if (n[0] === 'global') this.g[n[1]] = 0;
      if (n[0] === 'func') {
        if (typeof n[1] === 'string') this.functions.set(n[1],n);
        else if (n[1][1] === '"mne_start"') this.functions.set('$start',['func','$start',...n.slice(2)]);
      }
    }
    this.begins = 0;
  }
  eval(n,l) {
    const e = x => this.eval(x,l);
    if (n[0] === 'i32.and') return (e(n[1]) & e(n[2])) >>> 0;
    if (n[0] === 'i32.shl') return (e(n[1]) << e(n[2])) >>> 0;
    if (n[0] === 'i32.shr_u') return e(n[1]) >>> e(n[2]);
    if (n[0] === 'i32.le_u') return +((e(n[1])>>>0) <= (e(n[2])>>>0));
    if (n[0] === 'i32.lt_u') return +((e(n[1])>>>0) < (e(n[2])>>>0));
    if (n[0] === 'memory.size') return 8192;
    if (n[0] === 'region.end') { assert.equal(n[1],'$DIRECT_WINDOW'); return 0x8000000; }
    if (n[0] === 'call') {
      if (n[1] === '$msc_begin_for_mne') { this.begins++; return; }
      return this.run(n[1],n.slice(2).map(e));
    }
    return super.eval(n,l);
  }
  start() { this.run('$start'); }
  complete() {
    Object.assign(this.g,{$msc_token:7,$msc_ret:a.selectRet,$msc_phase:3,$msc_completions:1,
      $msc_thread:1,$msc_regs:100,$msc_pre:1000,$msc_post:1024,$msc_result:17});
    this.run('$mne_complete');
  }
  prepare() {
    this.start();this.complete();
    this.mem = new Map([[116,1024],[120,17],[128,crt+a.crtEntryRva],[100,0x410000]]);
  }
  call() { this.run('$mne_call',[a.successor,crt+a.crtEntryRva,7]); }
  ret() { this.g.$eip=a.successor;this.run('$mne_return',[crt+a.crtTailRva]); }
  fields() { return Object.fromEntries([...hook.FIELDS,...hook.DIAGNOSTIC_FIELDS].map(k=>[k,this.g['$mne_'+k]])); }
}
let groups=0;
function test(name,f) { f();groups++;console.log('PASS '+name); }
function rejected(m,reason) {
  assert.equal(m.g.$mne_status,5);
  assert.equal(m.g.$mne_rejectReason,baseline ? 0 : reason);
  assert.equal(m.g.$mne_errno,0);assert.equal(m.g.$mne_caller,0);
  if (!baseline) {
    const fields=m.fields(),d=Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,fields[k]]));
    const decoded=decodeRejection(fields,d);
    assert.equal(decoded.reason,reason);assert.equal(decoded.predicate,hook.GUARD_REJECTION_REASONS[reason]);
    assert.equal(decoded.schema,'maelstrom-native-guard-rejection/v1');
  }
}
test('awaiting-select UOP switch reproducer and unchanged-mode control',()=>{
  for (const from of [0,1]) {
    const m=new Scalars();m.g.$uop_enabled=from;m.start();
    assert.equal(m.g.$mne_status,1);assert.equal(m.begins,1);
    const before=m.fields();m.run('$mne_uop_switch',[from]);assert.deepEqual(m.fields(),before);
    m.run('$mne_uop_switch',[1-from]);rejected(m,15);
    assert.equal(m.g.$mne_event,0);
  }
  for(const phase of [2,3]) {
    const m=new Scalars();m.prepare();if(phase===3)m.call();
    const before=m.fields();m.run('$mne_uop_switch',[1]);assert.deepEqual(m.fields(),before);
    m.run('$mne_uop_switch',[0]);rejected(m,15);assert.equal(m.g.$mne_event,phase-1);
  }
});
test('start mode and select ownership guards reject before beginning select',()=>{
  for(const [key,value,reason] of [['code16',2,10],['block_exec_enabled',2,11],['uop_enabled',2,12],['msc_started',1,13],['msc_token',7,14]]) {
    const m=new Scalars();m.g['$'+key]=value;m.start();rejected(m,reason);assert.equal(m.begins,0);
  }
});
test('completion mode mismatch and established completion ABI',()=>{
  const m=new Scalars();m.start();m.g.$uop_enabled=0;m.complete();rejected(m,16);
  for(const [key,value,reason] of [['code16',1,1],['block_exec_enabled',1,2],['uop_enabled',2,3],['msc_ret',0,4],['msc_phase',0,5],['msc_completions',2,6],['msc_fault',1,7],['msc_active',1,8],['msc_capped',1,9]]) {
    const x=new Scalars(false);x.start();x.complete();x.g.$mne_status=1;x.g.$mne_event=0;
    x.g['$'+key]=value;x.run('$mne_complete');assert.equal(x.g.$mne_status,5);assert.equal(x.g.$mne_rejectReason,reason);
  }
});
test('call guard inventory preserves source, register and return anchors',()=>{
  const cases = [
    [17,m=>{m.call();}], [18,m=>{m.g.$code16=1;}],
    [19,m=>{m.g.$msc_token++;}], [20,()=>{},[a.successor+1,crt+a.crtEntryRva,7]],
    [21,()=>{},[a.successor,crt+a.crtEntryRva+1,7]], [22,()=>{},[a.successor,crt+a.crtEntryRva,6]],
    [23,m=>{m.g.$eip++;}], [24,m=>{m.mem.set(116,1028);}], [25,m=>{m.mem.set(120,18);}]
  ];
  for(const [reason,mutate,args] of cases) {const m=new Scalars();m.prepare();mutate(m);m.run('$mne_call',args||[a.successor,crt+a.crtEntryRva,7]);rejected(m,reason);}
});
test('return guard inventory preserves frame and direct mapping rejection',()=>{
  const cases = [
    [26,m=>{m.g.$code16=1;}], [27,m=>{m.g.$msc_token++;}], [28,m=>{m.g.$mne_status=2;m.g.$mne_event=1;m.g.$mne_nativeEntry=0;m.g.$mne_callBlock=0;}],
    [29,m=>{m.g.$eip++;}], [30,()=>{},crt+a.crtTailRva+1], [31,m=>{m.mem.set(116,1028);}],
    [32,m=>{m.mem.set(120,18);}], [33,m=>{m.mem.set(128,1);}],
    [34,m=>{m.mem.set(116,0xfffffed0);m.g.$mne_post=0xfffffed0;m.g.$msc_post=0xfffffed0;}],
    [35,m=>{m.mem.set(100,0);}],
    [36,m=>{m.mem.set(116,0x10000);m.g.$mne_post=0x10000;m.g.$msc_post=0x10000;}]
  ];
  for(const [reason,mutate,source] of cases) {const m=new Scalars();m.prepare();m.call();m.g.$eip=a.successor;mutate(m);m.run('$mne_return',[source||crt+a.crtTailRva]);rejected(m,reason);}
});
test('nonowner hooks and nested CRT returns stay inert',()=>{
  for(const key of ['$current_thread_id','$reg_base']) {const m=new Scalars();m.prepare();m.g[key]++;const before=m.fields();m.call();m.ret();assert.deepEqual(m.fields(),before);}
  const m=new Scalars();m.prepare();m.call();m.mem.set(116,1000);const before=m.fields();m.ret();assert.deepEqual(m.fields(),before);
});
test('first rejection is immutable, no reset, fresh instance has no stale reason',()=>{
  const m=new Scalars();m.start();m.run('$mne_uop_switch',[0]);rejected(m,15);const before=m.fields();
  for(const [f,args] of [['$start',[]],['$mne_complete',[]],['$mne_call',[0,0,0]],['$mne_return',[0]],['$mne_uop_switch',[1]]]) {m.run(f,args);assert.deepEqual(m.fields(),before);}
  const fresh=new Scalars();assert(hook.DIAGNOSTIC_FIELDS.every(k=>fresh.fields()[k]===0));fresh.start();fresh.complete();
  assert.equal(fresh.g.$mne_status,2);assert.equal(fresh.g.$mne_event,1);assert(hook.DIAGNOSTIC_FIELDS.every(k=>fresh.fields()[k]===0));
  for(const status of [0,4,5]) {const x=new Scalars();x.g.$mne_status=status;const before=x.fields();x.run('$mne_uop_switch',[1]);assert.deepEqual(x.fields(),before);}
});
test('successful native capture keeps zero diagnostics',()=>{
  const m=new Scalars();m.prepare();m.call();
  const wa=ga=>ga-0x400000+0x12000;
  m.mem.set(wa(0x410000),42);m.mem.set(wa(1024+a.frame),123);
  // Use a direct-window guest stack, preserving completion and native ownership.
  m.mem.set(116,0x420000);m.g.$mne_post=0x420000;m.g.$msc_post=0x420000;
  m.mem.set(wa(0x420000+a.frame),123);m.mem.set(wa(0x420000+a.frame)+4,456);m.mem.set(wa(0x420000+a.frame)+8,789);
  m.ret();assert.equal(m.g.$mne_status,4);assert.equal(m.g.$mne_errno,42);assert.equal(m.g.$mne_caller,123);
  assert(hook.DIAGNOSTIC_FIELDS.every(k=>m.fields()[k]===0));
});
if (!baseline) {
  test('adapter persists awaiting-select guard rejection once without attribution',()=>{
    const m=new Scalars(),rows=[],exports={mne_start:()=>m.start()};
    for(const k of [...hook.FIELDS,...hook.DIAGNOSTIC_FIELDS]) exports['mne_'+k]=()=>m.g['$mne_'+k];
    for(const k of require('../tools/maelstrom-select-completion-hook.cjs').FIELDS) exports['msc_'+k]=()=>m.g['$msc_'+k]||0;
    const adapter=createAdapter({exports},{persist:r=>rows.push(r),readLive:()=>({})});
    adapter.start();m.run('$mne_uop_switch',[0]);
    assert.throws(()=>adapter.observe(0),/status rejection/);
    assert.equal(rows.at(-1).historicalNativeRejection.predicate,'uop-mode-switch');
    assert.equal(rows.at(-1).historicalNativeLatch.event,0);
    const count=rows.length;assert.equal(adapter.observe(1),null);assert.equal(rows.length,count);
  });
  test('guard decoder rejects unknown reasons and captured/impossible event contexts',()=>{
    const m=new Scalars();m.start();m.run('$mne_uop_switch',[0]);
    const n=m.fields(),d=Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,n[k]]));
    for(const patch of [{status:4},{event:3},{errno:1},{caller:1},{sourceBlock:1},{event:1,nativeEntry:1}])
      assert.throws(()=>decodeRejection({...n,...patch},d),/invalid native rejection/);
    for(const patch of [{rejectReason:37},{rejectModes:8},{rejectExpectedRet:0}])
      assert.throws(()=>decodeRejection(n,{...d,...patch}),/invalid native rejection/);
    for(const event of [1,2]) assert.throws(()=>decodeRejection({...n,event},{...d,rejectReason:16}),/guard context/);
    const zero=Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,0]));assert.equal(decodeRejection(n,zero),null);
  });
}
console.log(JSON.stringify({schema:'offline-native-guard-regression/v1',baseline,groups,originalGameAcceptance:false,measuredCause:'UNKNOWN'}));
