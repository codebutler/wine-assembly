'use strict';
// Source evaluator only. Executes consumed decoder branches/handlers; never wasm.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),Module=require('module'),crypto=require('crypto');
const R=process.cwd(), O=__dirname;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=path.join(R,'test/maelstrom-native-errno-latch.test.cjs');
const text=fs.readFileSync(fixture,'utf8');
const mod=new Module(fixture,module);mod.filename=fixture;mod.paths=Module._nodeModulePaths(path.dirname(fixture));
// Deliberate broken-output controls. Candidate files and pinned inputs stay immutable.
const mutation=process.env.MNE_REVIEW_MUTATION;
if(mutation){
 const originalRequire=mod.require.bind(mod);
 mod.require=function(name){const value=originalRequire(name);if(!name.endsWith('/maelstrom-native-errno-latch.cjs'))return value;
  return {...value,transform(s,o){const x=value.transform(s,o);if(o?.enabled!==true)return x;
   const p=mutation==='after-dispatch'?'src/05-alu.wat':'src/09d-winsock.wat';
   const edits={
    'stale-token':['(i32.ne (global.get $msc_token) (global.get $mne_token))','(i32.const 0)'],
    'after-dispatch':['(call $mne_return (local.get $mne_source))\n    (return_call $branch_end)','(return_call $branch_end)\n    (call $mne_return (local.get $mne_source))'],
    'unsafe-span':['(region.end $DIRECT_WINDOW)','(i32.const 0x20000000)'],
    'result-as-errno':['(global.set $mne_errno (i32.load (local.get $errno_wa)))','(global.set $mne_errno (global.get $msc_result))']
   };const [a,b]=edits[mutation];assert(x[p].includes(a),'mutation applied');return {...x,[p]:x[p].replaceAll(a,b)};
  }};
 };
}
mod._compile(text.slice(0,text.indexOf("test('byte-bound"))+'\nmodule.exports={NativeModel,sources,out,binaries,hook,pre,post,entry,tail,successor,selectRet,errnoPtr};',fixture);
const {NativeModel,sources,out,binaries,hook,pre,post,entry,tail,successor,selectRet,errnoPtr}=mod.exports;
const {Model,parse,func,walk}=require(path.join(R,'test/maelstrom-select-hook-model.cjs'));
const results=[];function check(name,f){f();results.push({name,pass:true});}
const decoder=parse(sources['src/07-decoder.wat']);
function one(nodes,pred){const all=walk(nodes,pred);assert.equal(all.length,1);return all[0];}
const callBranch=one(decoder,n=>n[0]==='if'&&JSON.stringify(n[1])==='["i32.eq",["global.get","$mr_reg"],["i32.const","2"]]'&&walk(n,x=>x[0]==='i32.const'&&x[1]==='119').length===1);
const retBranch=one(decoder,n=>n[0]==='if'&&JSON.stringify(n[1])==='["i32.eq",["local.get","$op"],["i32.const","0xC3"]]');
class Decode extends Model {
 constructor(byte,pc){super(out['src/09d-winsock.wat'],0,0,false);this.byte=byte;this.g.$d_pc=pc;this.g.$code16=0;this.emitted=[];this.functions.set('$decode_modrm',func(sources['src/07-decoder.wat'],'decode_modrm'));}
 eval(n,l){
  const e=x=>this.eval(x,l);
  if(n[0]==='i32.and')return(e(n[1])&e(n[2]))>>>0;
  if(n[0]==='i32.shr_u')return e(n[1])>>>e(n[2]);
  if(n[0]==='br')return;
  if(n[0]==='if'&&n[1][0]==='result'){const branch=e(n[2])?n[3]:n[4];let v;for(const x of branch.slice(1))v=e(x);return v;}
  if(n[0]==='call'){
   if(n[1]==='$d_fetch8'){this.g.$d_pc++;return this.byte;}
   if(n[1]==='$decode_modrm')return this.run(n[1]);
   if(n[1]==='$te'||n[1]==='$te_raw'){this.emitted.push([n[1],...n.slice(2).map(e)]);return;}
  }
  return super.eval(n,l);
 }
}
check('consumed ModRM and decoder yield CALL EDI return3366/reg7 and C3 H41/op0',()=>{
 const net=hook.pe(binaries.net), at=net.offset(0x10001364,2);assert.equal(binaries.net[at],0xff);
 const d=new Decode(binaries.net[at+1],0x7a3365);d.run('$decode_modrm');assert.equal(d.g.$mr_mod,3);assert.equal(d.g.$mr_reg,2);assert.equal(d.g.$mr_val,7);
 d.eval(callBranch,{$done:0});assert.deepEqual(d.emitted,[['$te',119,successor],['$te_raw',7]]);
 const crt=hook.pe(binaries.crt);assert.equal(binaries.crt[crt.offset(0x7800c438,1)],0xc3);
 const r=new Decode(0,0);r.eval(retBranch,{$op:0xc3,$prefix_66:0,$done:0});assert.deepEqual(r.emitted,[['$te',41,0]]);
 // A different register really decodes to a different operand, then rejects.
 const wrong=new Decode(0xd6,0x7a3365);wrong.run('$decode_modrm');wrong.eval(callBranch,{$done:0});assert.deepEqual(wrong.emitted,[['$te',119,successor],['$te_raw',6]]);
 const m=new NativeModel();m.complete();m.word=wrong.emitted[1][1];m.callNative();assert.equal(m.state().status,5);
});
check('independent frame arithmetic and native displacement distinguish errno from result',()=>{
 const net=hook.pe(binaries.net),crt=hook.pe(binaries.crt);
 const pro=binaries.net.subarray(net.offset(0x100012b0,18),net.offset(0x100012b0,18)+18);
 assert.equal(pro.readUInt32LE(2),276);assert.equal(pro[8],0x53);assert.equal(pro[16],0x55);assert.equal(pro[17],0x56);
 assert.equal(binaries.net[net.offset(0x100012ef,1)],0x57);
 const frame=pro.readUInt32LE(2)+16;assert.equal(frame,292);
 const c=crt.offset(0x7800c430,9);assert.equal(0x7800c435+binaries.crt.readInt32LE(c+1),0x78003857);
 assert.equal(binaries.crt.subarray(c+5,c+9).toString('hex'),'83c008c3');
 const m=new NativeModel();m.complete();m.callNative();m.returnNative(10004,0x12345678);
 assert.equal(m.state().result,0);assert.equal(m.state().errno,10004);assert.equal(m.state().caller,0x12345678);
 assert.equal(m.mem.get(m.wa(post+frame)),0x12345678);
});
check('actual handlers order stack changes and snapshot before successor dispatch',()=>{
 const m=new NativeModel();m.complete();let atDispatch=false;
 const old=m.eval;
 m.eval=function(n,l){if(n[0]==='return_call'){
   assert.equal(n[1],'$branch_end');assert.equal(this.g.$eip,successor);assert.equal(this.mem.get(116),post);
   assert.equal(this.state().status,4);assert.equal(this.state().errno,4);atDispatch=true;
   // Independent simulated next instruction overwrites live errno AFTER snapshot.
   this.put(errnoPtr,99);return;
  }return old.call(this,n,l);};
 m.callNative();assert.equal(m.mem.get(116),post-4);assert.equal(m.mem.get(m.wa(post-4)),successor);assert.equal(m.g.$eip,entry);
 m.returnNative();assert(atDispatch);assert.equal(m.state().errno,4);assert.equal(m.mem.get(m.wa(errnoPtr)),99);
 const ret=func(out['src/05-alu.wat'],'th_ret');
 assert.deepEqual(ret.slice(-2).map(x=>x.slice(0,2)),[['call','$mne_return'],['return_call','$branch_end']]);
 assert.equal(walk(func(sources['src/05-alu.wat'],'cs_pop'),n=>n[0]==='global.set'&&n[1]==='$eip').length,0);
});
check('real nested RET below owned frame preserves pending latch, then owner captures',()=>{
 const m=new NativeModel();m.complete();m.callNative();
 m.mem.set(116,post-8);m.put(post-8,tail);m.g.$eip=entry+0x100;m.run('$th_ret',[0]);
 assert.equal(m.mem.get(116),post-4);assert.equal(m.state().status,3);
 m.returnNative(7);assert.equal(m.state().status,4);assert.equal(m.state().errno,7);
 const n=new NativeModel();n.complete();n.callNative();n.run('$mne_call',[entry+2,entry+100,0]);assert.equal(n.state().status,5);
});
check('completion identity and return source reject despite matching pointers',()=>{
 for(const mutate of [m=>m.g.$msc_token++,m=>m.g.$msc_regs++,m=>m.g.$msc_thread++,m=>m.g.$msc_post++,m=>m.g.$msc_result=3]){
  const m=new NativeModel();m.complete();m.callNative();mutate(m);m.returnNative();assert.equal(m.state().status,5);assert.notEqual(m.state().event,3);
 }
 const m=new NativeModel();m.complete();m.callNative();m.mem.set(116,post);m.g.$eip=successor;m.run('$mne_return',[tail+3]);assert.equal(m.state().status,5);
});
check('safe span uses full last byte with independent BigInt oracle at all boundaries',()=>{
 const m=new NativeModel();let count=0;
 for(const image of [0x400000,0x10000,0xffff0000])for(const pages of [0,1,2,2048,8192]){
  m.g.$image_base=image;m.pages=pages;
  for(const len of [4,12])for(const ga of [0,0xfffc,0xffff,0x10000,0x3fffff,0x400000,0x83edff4,0x83edffc,0x83ee000,0xfffffff3,0xfffffffc,0xffffffff]){
   const a=BigInt(ga),l=BigInt(len),wa=BigInt.asUintN(32,a-BigInt(image)+0x12000n);
   const good=a>=65536n&&a+l<=0xffffffffn&&wa>=0x12000n&&wa+l<=0x8000000n&&wa+l<=BigInt(pages)*65536n;
   assert.equal(m.run('$mne_wa',[ga,len]),good?Number(wa):0xffffffff,`${ga}/${len}/${image}/${pages}`);count++;
  }
 }
 assert.equal(count,360);
 // Cross a full-memory last-byte bound; starting byte alone would be valid.
 m.g.$image_base=0x400000;m.pages=2;const ga=0x400000+0x20000-0x12000-4;
 assert.notEqual(m.run('$mne_wa',[ga,4]),0xffffffff);assert.equal(m.run('$mne_wa',[ga,12]),0xffffffff);
});
check('disabled inputs are untouched even through getters and enumeration traps',()=>{
 const trap=new Proxy({}, {get(){throw Error('unexpected read');},ownKeys(){throw Error('unexpected enumeration');},getOwnPropertyDescriptor(){throw Error('unexpected descriptor');}});
 for(const enabled of [false,0,null,undefined,'true'])assert.equal(hook.transform(trap,{enabled,get binaries(){throw Error('binary getter');},get crtLoadedBase(){throw Error('base getter');}}),trap);
 const off=new NativeModel(false),original=Object.assign({},off.g);let reads=0;
 off.g=new Proxy(off.g,{get(t,p){reads++;if(p!=='$mne_status')throw Error('disabled global read '+p);return t[p];}});
 off.run('$mne_complete');off.run('$mne_call',[0,0,0]);off.run('$mne_return',[0]);assert(reads>0);off.g=original;
 assert.equal(off.mem.get(116),pre);assert.equal(off.reads.length,0);
});
check('fragment hashes match retained evidence, mutations cannot retain source identity',()=>{
 const pin=JSON.parse(fs.readFileSync(path.join(R,'docs/re-notes/maelstrom-native-errno-successor-latch-20261025/source-identity.json')));
 for(const [p,v] of Object.entries(pin.generatedFragments))assert.equal(sha(out['src/'+p]),v.sha256);
 const sourcesTrap={...sources};Object.defineProperty(sourcesTrap,'src/07-decoder.wat',{get(){return sources['src/07-decoder.wat'].replace('(i32.const 119)','(i32.const 120)');}});
 assert.throws(()=>hook.transform(sourcesTrap,{enabled:true,binaries,crtLoadedBase:0x522000}),/source pin/);
});
check('private latch helper write/call closure excludes guest/global/flags/clock/yield/budget writes',()=>{
 for(const name of ['mne_wa','mne_complete','mne_call','mne_return']){
  const ast=func(out['src/09d-winsock.wat'],name);
  assert.equal(walk(ast,n=>/store|atomic|memory.grow/.test(n[0])).length,0);
  for(const n of walk(ast,n=>n[0]==='global.set'))assert(n[1].startsWith('$mne_'));
  for(const n of walk(ast,n=>n[0]==='call'))assert.equal(n[1],'$mne_wa');
 }
});
const receipt={pass:true,groups:results.length,results,qualification:'Pinned source decoder branches, handlers and bounded AST model only; no compilation, instantiation, x86/native execution or original guest.',decoderFixtures:{call:[119,successor,7],ret:[41,0]},safeSpanCases:360};
fs.writeFileSync(path.join(O,'independent-results.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
