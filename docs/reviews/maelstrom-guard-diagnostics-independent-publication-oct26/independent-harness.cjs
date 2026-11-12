'use strict';
// Offline WAT source AST checks. No compiler, Wasm, guest, or native execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Model, parse } = require('./maelstrom-select-hook-model.cjs');
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const adapterModule = require('../tools/maelstrom-original-errno-adapter.cjs');
const original = require('../tools/independent-baseline.cjs');
const A = {selectRet:0x7a3362, successor:0x7a3366, frame:0x124,
  crtEntryRva:0xc430, crtTailRva:0xc435, crtRetRva:0xc438};
const CRT=0x522000, WA=x=>(x-0x400000+0x12000)>>>0;
const cache = new Map();
class State extends Model {
  constructor(helper=hook, uop=true, edit=null) {
    super('(func $handle_select )',0,0,false);
    this.g={$code16:0,$block_exec_enabled:0,$uop_enabled:+uop,$current_thread_id:1,
      $reg_base:100,$eip:A.selectRet,$image_base:0x400000,$GUEST_BASE:0x12000};
    for(const k of ['started','token','ret','phase','completions','fault','active','capped',
      'thread','regs','pre','post','parks','result']) this.g['$msc_'+k]=0;
    const key=(helper===original?'original':'candidate')+uop;
    if(!cache.has(key))cache.set(key,parse(helper.storage(A,CRT,uop)));
    const ast=edit?JSON.parse(JSON.stringify(cache.get(key))):cache.get(key);
    if(edit)edit(ast);
    for(const n of ast) {
      if(n[0]==='global')this.g[n[1]]=0;
      if(n[0]==='func')this.functions.set(typeof n[1]==='string'?n[1]:'$start',
        typeof n[1]==='string'?n:['func','$start',...n.slice(2)]);
    }
    this.begins=0;this.pages=8192;
  }
  eval(n,l) {
    const e=x=>this.eval(x,l);
    switch(n[0]) {
      case 'i32.and':return (e(n[1])&e(n[2]))>>>0;
      case 'i32.shl':return (e(n[1])<<e(n[2]))>>>0;
      case 'i32.shr_u':return e(n[1])>>>e(n[2]);
      case 'i32.le_u':return +((e(n[1])>>>0)<=(e(n[2])>>>0));
      case 'i32.lt_u':return +((e(n[1])>>>0)<(e(n[2])>>>0));
      case 'memory.size':return this.pages;
      case 'region.end':assert.equal(n[1],'$DIRECT_WINDOW');return 0x8000000;
      case 'i32.load':{
        const hasOffset=typeof n[1]==='string'&&n[1].startsWith('offset=');
        const offset=hasOffset?Number(n[1].slice(7)):0;
        const addr=(e(n[hasOffset?2:1])>>>0)+offset;
        assert(addr+4<=this.pages*65536,'model memory bounds');
        return this.mem.get(addr)||0;
      }
      case 'call':if(n[1]==='$msc_begin_for_mne'){this.begins++;return;}
        return this.run(n[1],n.slice(2).map(e));
      default:return super.eval(n,l);
    }
  }
  start(){this.run('$start');}
  complete(){Object.assign(this.g,{$msc_token:7,$msc_ret:A.selectRet,$msc_phase:3,
    $msc_completions:1,$msc_thread:1,$msc_regs:100,$msc_pre:0x420000-24,
    $msc_post:0x420000,$msc_result:17});this.run('$mne_complete');}
  prepare(){this.start();this.complete();this.mem=new Map([[116,0x420000],[120,17],
    [128,CRT+A.crtEntryRva],[100,0x410000],[WA(0x410000),42],
    [WA(0x420000+A.frame),123],[WA(0x420000+A.frame)+4,456],
    [WA(0x420000+A.frame)+8,789]]);}
  call(){this.run('$mne_call',[A.successor,CRT+A.crtEntryRva,7]);}
  ret(){this.g.$eip=A.successor;this.run('$mne_return',[CRT+A.crtTailRva]);}
  native(){return Object.fromEntries(hook.FIELDS.map(k=>[k,this.g['$mne_'+k]]));}
  diag(){return Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,this.g['$mne_'+k]]));}
  snapshot(){return {native:this.native(),diag:this.diag(),begins:this.begins,mem:[...this.mem]};}
}
let groups=0, comparisons=0;const killed=[];
function group(name,f){f();groups++;console.log('PASS '+name);}
function rejected(m,r){assert.equal(m.g.$mne_status,5);assert.equal(m.g.$mne_rejectReason,r);
  assert.equal(m.g.$mne_errno,0);assert.equal(m.g.$mne_caller,0);
  assert.equal(adapterModule.decodeRejection(m.native(),m.diag()).reason,r);}
function exercise(m,phase){if(phase>=1)m.start();if(phase>=2)m.prepare();
  if(phase>=3)m.call();if(phase===4)m.ret();}
function pair(phase,change,action,uop=true){
  const x=new State(original,uop),y=new State(hook,uop);
  exercise(x,phase);exercise(y,phase);change(x);change(y);action(x);action(y);
  assert.deepEqual(y.native(),x.native());assert.equal(y.begins,x.begins);
  assert.deepEqual([...y.mem],[...x.mem]);comparisons++;
}
group('model i32 arithmetic, eager evaluation, offset stability and invocation returns',()=>{
  const m=new State();
  for(const a of [0,1,2,0x7fffffff,0x80000000,0xffffffff])
    for(const b of [0,1,2,31,32,0xffffffff])
      for(const [op,want] of [['add',(a+b)>>>0],['sub',(a-b)>>>0],['or',(a|b)>>>0],
        ['and',(a&b)>>>0],['shl',(a<<b)>>>0],['shr_u',a>>>b],['gt_u',+(a>b)],
        ['ge_u',+(a>=b)],['le_u',+(a<=b)],['lt_u',+(a<b)]])
        assert.equal(m.eval(parse(`(i32.${op} (i32.const ${a}) (i32.const ${b}))`)[0],{}),want);
  m.mem.set(116,9);const load=parse('(i32.load offset=16 (global.get $reg_base))')[0];
  const encoded=JSON.stringify(load);assert.equal(m.eval(load,{}),9);assert.equal(m.eval(load,{}),9);
  assert.equal(JSON.stringify(load),encoded);
  const f=parse('(func $inner (return (i32.const 7)) (global.set $eip (i32.const 999)))')[0];
  m.functions.set('$inner',f);m.functions.set('$outer',parse('(func $outer (call $inner) (global.set $eip (i32.const 88)) (return) (global.set $eip (i32.const 99)))')[0]);
  assert.equal(m.run('$inner'),7);m.run('$outer');assert.equal(m.g.$eip,88);
  assert.throws(()=>m.eval(parse('(i32.or (i32.const 1) (i32.load (i32.const 4294967295)))')[0],{}),/model memory bounds/);
});
group('exact unchanged reason0 baseline, same diagnostic regression fails then passes',()=>{
  function reproduce(helper){const m=new State(helper);m.start();m.run('$mne_uop_switch',[0]);return m;}
  const old=reproduce(original);assert.equal(old.g.$mne_status,5);assert.equal(old.g.$mne_event,0);
  assert.equal(old.g.$mne_rejectReason,0);assert.throws(()=>rejected(old,15),assert.AssertionError);
  rejected(reproduce(hook),15);
});
group('differential start and mode switches include unsigned nonboolean on across phases',()=>{
  for(const uop of [false,true])for(const key of ['$code16','$block_exec_enabled','$uop_enabled','$msc_started','$msc_token'])
    for(const value of [0,1,2,0x80000000,0xffffffff])
      pair(0,m=>{m.g[key]=value;},m=>m.start(),uop);
  for(const phase of [0,1,2,3,4,5])for(const from of [0,1])for(const on of [0,1,2,0x80000000,0xffffffff]){
    const change=m=>{if(phase===5){m.start();m.run('$mne_uop_switch',[1]);}
      m.g.$mne_uopMode=from;};
    pair(Math.min(phase,4),change,m=>m.run('$mne_uop_switch',[on]));
  }
});
group('differential all changed call/return predicates, stale snapshots, owners and nested frames',()=>{
  const keys=['$code16','$block_exec_enabled','$uop_enabled','$current_thread_id','$reg_base','$eip',
    ...['token','phase','completions','active','fault','capped','pre','post','ret','result','thread','regs'].map(k=>'$msc_'+k)];
  for(const phase of [2,3])for(const key of keys)for(const value of [0,1,2,0xffffffff])
    for(const action of ['call','ret'])pair(phase,m=>{m.g[key]=value;},m=>m[action]());
  for(const phase of [2,3])for(const offset of [0,16,20,28])for(const v of [0,1,0x41ffff,0x420000,0x420001,0xfffffed0,0xffffffff])
    for(const action of ['call','ret'])pair(phase,m=>m.mem.set(100+offset,v),m=>m[action]());
  for(const key of ['$code16','$block_exec_enabled','$uop_enabled']){
    const m=new State();m.prepare();m.call();m.mem.set(116,0x41ffff);m.g[key]=2;m.ret();rejected(m,26);
  }
  for(const key of ['$current_thread_id','$reg_base']){
    const m=new State();m.prepare();m.g[key]=999;m.g.$msc_token=99;
    const before=m.snapshot();m.call();m.ret();assert.deepEqual(m.snapshot(),before);
  }
});
group('terminal snapshots and first-reason immutable under all late hooks and stale state',()=>{
  for(const terminal of ['rejected','captured']){
    const m=new State();m.prepare();m.call();
    if(terminal==='captured')m.ret();else{m.g.$code16=2;m.ret();rejected(m,26);}
    const before=m.snapshot();Object.assign(m.g,{$msc_token:0,$msc_fault:99,$uop_enabled:0});
    for(const f of [()=>m.start(),()=>m.complete(),()=>m.call(),()=>m.ret(),()=>m.run('$mne_uop_switch',[2])]){
      f();assert.deepEqual(m.snapshot(),before);
    }
  }
  const m=new State();assert(hook.DIAGNOSTIC_FIELDS.every(k=>m.diag()[k]===0));
});
group('direct-window unsigned boundaries, overflow and memory-page oracle',()=>{
  const m=new State();
  const oracle=(ga,len,pages)=>{
    ga>>>=0;len>>>=0;if(ga<0x10000||ga>0xffffffff-len)return 0xffffffff;
    const wa=WA(ga);if(wa<0x12000||wa>0x8000000-len)return 0xffffffff;
    return (((wa+len-1)>>>0)>>>16)>=pages?0xffffffff:wa;
  };
  for(const pages of [1,2,2047,2048,8192])for(const len of [4,12])
    for(const ga of [0,0xffff,0x10000,0x3fffff,0x400000,0x410000,
      0x400000+0x8000000-0x12000-len,0x400000+0x8000000-0x12000-len+1,
      0xfffffff0,0xfffffffb,0xffffffff]){
      m.pages=pages;assert.equal(m.run('$mne_wa',[ga,len]),oracle(ga,len,pages));
    }
});
function exportsFor(m){const e={mne_start:()=>m.start()};
  for(const k of [...hook.FIELDS,...hook.DIAGNOSTIC_FIELDS])e['mne_'+k]=()=>m.g['$mne_'+k];
  for(const k of require('../tools/maelstrom-select-completion-hook.cjs').FIELDS)e['msc_'+k]=()=>m.g['$msc_'+k]||0;
  return e;
}
group('adapter malformed/unknown/reason0 and stale diagnostic close permanently',()=>{
  const m=new State();m.start();m.run('$mne_uop_switch',[0]);const n=m.native(),d=m.diag();
  for(const key of hook.DIAGNOSTIC_FIELDS)for(const value of [-1,NaN,1.5,0x100000000,undefined])
    assert.throws(()=>adapterModule.decodeRejection(n,{...d,[key]:value}),/invalid native rejection/);
  for(const reason of [37,99,0xffffffff])assert.throws(()=>adapterModule.decodeRejection(n,{...d,rejectReason:reason}),/invalid/);
  const zero=Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,0]));assert.equal(adapterModule.decodeRejection(n,zero),null);
  assert.throws(()=>adapterModule.decodeRejection(n,{...zero,rejectPhase:3}),/nonzero without reason/);
  const x=new State(),rows=[],e=exportsFor(x),instance={exports:e};
  const ad=adapterModule.createAdapter(instance,{persist:r=>rows.push(r),readLive:()=>({})});ad.start();
  x.g.$mne_rejectReason=15;assert.throws(()=>ad.observe(0),/guard context/);
  x.g.$mne_rejectReason=0;assert.equal(ad.observe(1),null);assert.equal(rows.length,1);
  assert.throws(()=>adapterModule.createAdapter(instance,{persist:()=>{},readLive:()=>({})}),/duplicate/);
});
group('adapter terminal seal precedes callback reentry and export changes',()=>{
  for(const phase of [1,2,3]){
    const m=new State(),rows=[];let ad,reentered;
    ad=adapterModule.createAdapter({exports:exportsFor(m)},{readLive:()=>({}),persist:r=>{
      rows.push(r);if(r.kind==='rejected'){m.g.$mne_rejectReason=99;reentered=ad.observe(99);}
    }});ad.start();if(phase>=2)m.prepare();if(phase===3)m.call();
    m.run('$mne_uop_switch',[0]);assert.throws(()=>ad.observe(1),/status rejection/);
    assert.equal(reentered,null);assert.equal(rows.length,2);assert.equal(rows[1].historicalNativeRejection.reason,15);
    assert.equal(ad.observe(2),null);
  }
});
group('meaningful generated-AST mutations are killed by independent behavioral oracles',()=>{
  function kill(name,edit,oracle){assert.throws(()=>oracle(new State(hook,true,edit)),assert.AssertionError);killed.push(name);}
  const fn=(ast,name)=>ast.find(n=>n[0]==='func'&&n[1]===name);
  kill('drop terminal completion guard',ast=>fn(ast,'$mne_complete').splice(2,1),m=>{
    m.start();m.run('$mne_uop_switch',[0]);const s=m.snapshot();m.complete();assert.deepEqual(m.snapshot(),s);});
  kill('drop nonowner CALL guard',ast=>fn(ast,'$mne_call').splice(6,1),m=>{
    m.prepare();m.g.$current_thread_id=2;const s=m.snapshot();m.call();assert.deepEqual(m.snapshot(),s);});
  kill('wrong UOP rejection label',ast=>{
    const f=fn(ast,'$mne_uop_switch');const walk=n=>{if(!Array.isArray(n))return;
      if(n[0]==='global.set'&&n[1]==='$mne_rejectReason')n[2]=['i32.const','16'];else n.forEach(walk);};walk(f);
  },m=>{m.start();m.run('$mne_uop_switch',[0]);rejected(m,15);});
  kill('weaken direct-window upper bound',ast=>{
    const f=fn(ast,'$mne_wa');const walk=n=>{if(!Array.isArray(n))return;
      if(n[0]==='region.end')n.splice(0,n.length,'i32.const','0x9000000');else n.forEach(walk);};walk(f);
  },m=>{assert.equal(m.run('$mne_wa',[0x400000+0x8000000-0x12000,4]),0xffffffff);});
});
console.log(JSON.stringify({schema:'independent-native-guard-acceptance/v1',groups,differentialComparisons:comparisons,
  killedMutations:killed,mode:'offline-source-AST-only',measuredCause:'UNKNOWN',originalGameAcceptance:false}));
