
'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const root=process.env.WA_TEST_ROOT||require('path').resolve(__dirname,'..');
const {createHostImports}=require(root+'/lib/host-imports');
const {makeFixture,iat}=require(root+'/tools/kernel32-native-fixture');
const control=process.argv[2]||'positive',rows=[];
(async()=>{
const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'11aee57cb158ffd734534b97aef9c36e3152aec660c8371d609a771e4eee9a5f');
const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});let now=0;
const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{},guestNowMs:()=>now};
const imports=createHostImports(ctx);imports.host.memory=memory;
for(const i of WebAssembly.Module.imports(mod)){assert.equal(i.module,'host');if(i.kind==='function'&&!imports.host[i.name])imports.host[i.name]=()=>{throw Error('unexpected dependency '+i.name)}}
const e=(await WebAssembly.instantiate(mod,imports)).exports;ctx.exports=e;
const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
const dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,u8=new Uint8Array(memory.buffer);
const alloc=n=>{const p=e.guest_alloc(n);assert(p);return p>>>0};const stack=alloc(65536)+65520;
const get=p=>dv.getUint32(wa(p),true),put=(p,v)=>dv.setUint32(wa(p),v>>>0,true);
const text=s=>{const p=alloc(s.length+1);u8.set(Buffer.from(s+'\0'),wa(p));return p};
function call(address,args){e.set_esp(stack);e.call_func(address,...Array.from({length:4},(_,i)=>args[i]||0));const before=e.get_esp()>>>0;for(let i=4;i<args.length;i++)put(before+4*(i+1),args[i]);for(let n=0;n<20000&&e.get_eip();n++){e.run(100);assert.equal(e.get_yield_reason(),0,'public call unexpected yield')}assert.equal(e.get_eip(),0,'public call bounded');assert.equal(e.get_esp()>>>0,before+4*(args.length+1),'public stdcall');return e.get_eax()>>>0}
const kapi=(n,args)=>call(get(iat(n)),args),winmm=kapi('LoadLibraryA',[text('winmm.dll')]);assert(winmm);
const names=['midiStreamOpen','midiStreamOut','midiStreamPause','midiStreamRestart','midiStreamStop','midiStreamClose','midiStreamProperty','midiOutPrepareHeader','midiOutUnprepareHeader','midiOutShortMsg','midiOutReset','timeGetTime'];
const addresses=Object.fromEntries(names.map(n=>{const p=kapi('GetProcAddress',[winmm,text(n)]);assert(p,n);return[n,p]}));
function api(n,a){const r=call(addresses[n],a);rows.push({api:n,args:a,result:r,tick:now});return r}
const count=alloc(4),log=alloc(8192),callback=alloc(256);let b=[];const emit=(...v)=>b.push(...v),dword=v=>{const a=Buffer.alloc(4);a.writeUInt32LE(v>>>0);emit(...a)};
emit(0x8b,0x15);dword(count);emit(0x6b,0xd2,20,0x81,0xc2);dword(log);
for(let i=0;i<5;i++){emit(0x8b,0x44,0x24,4*(i+1),0x89,0x42,i*4)}
emit(0xff,0x05);dword(count);emit(0xb8,0xff,0xff,0xff,0xff,0xf8,0x40);
if(control==='carry-corrupt')emit(0xc7,0x44,0x24,60,0,0,0,0);
emit(0xc2,control==='bad-ret'?16:20,0);u8.set(b,wa(callback));
const idle=alloc(32);u8.set([0xb8,0xff,0xff,0xff,0xff,0xf9,0x40,0xeb,0xfe,0x9c,0x58,0xc3],wa(idle));const loop=idle+7,finish=idle+9;
let callbackCount=0;
function drain(){let delivered=0;while(ctx._midiOut.callbacks.length){assert(delivered++<100,'callback bounded');e.set_esp(stack);e.call_func(idle,0,0,0,0);for(let n=0;n<20&&e.get_eip()!==loop;n++)e.run(1);assert.equal(e.get_eip(),loop,'real x86 INC interrupted at loop');const before=e.get_esp()>>>0;const old=get(count);ctx.pumpAudioCompletions();assert.equal(e.get_eip()>>>0,callback,'queued function delivery');for(let n=0;n<1000&&e.get_eip()!==loop;n++)e.run(1);assert.equal(e.get_eip(),loop,'callback returns through production continuation');assert.equal(e.get_esp()>>>0,before,'callback stdcall stack restored');assert.equal(get(count),old+1,'one callback');e.set_eip(finish);for(let n=0;n<1000&&e.get_eip();n++)e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_eax()&0x41,0x41,'native INC carry and zero restored');callbackCount++}}
const records=()=>Array.from({length:get(count)},(_,i)=>Array.from({length:5},(_,j)=>get(log+i*20+j*4)));
function open(instance,mode=0x30000,cb=callback){const h=alloc(4),dev=alloc(4);put(dev,0);assert.equal(api('midiStreamOpen',[h,dev,1,cb,instance,mode]),0);return get(h)}
function header(events){const p=alloc(64),data=alloc(events.length*12);events.forEach(([delta,event],i)=>{put(data+i*12,delta);put(data+i*12+8,event)});put(p,data);put(p+4,events.length*12);put(p+8,events.length*12);return p}
const flags=h=>get(h+16);function submit(h,p){assert.equal(api('midiOutPrepareHeader',[h,p,64]),0);assert.equal(api('midiStreamOut',[h,p,64]),0);assert.equal(flags(p)&19,18)}
function prop(h,k,v,expected=0){const p=alloc(8);put(p,8);put(p+4,v);assert.equal(api('midiStreamProperty',[h,p,0x80000000|k]),expected)}
const a=open(0x11223344),c=open(0x55667788);assert.notEqual(a,c);drain();assert.deepEqual(records(),[[a,0x3c7,0x11223344,0,0],[c,0x3c7,0x55667788,0,0]]);
const ha=header([[480,0x02000000]]),hc=header([[480,0x02000000]]);submit(a,ha);submit(c,hc);
assert.equal(api('midiOutUnprepareHeader',[a,ha,64]),65);assert.equal(api('midiOutPrepareHeader',[c,ha,64]),11);
assert.equal(api('midiOutShortMsg',[a,0x643c90]),0);assert.equal(api('midiOutShortMsg',[c,0x643c90]),0);
assert(ctx._midiOut.devices.get(a).notes.has('0:60'));assert(ctx._midiOut.devices.get(c).notes.has('0:60'));
assert.equal(api('midiStreamStop',[a]),0);assert.equal(flags(ha)&19,3);assert.equal(flags(hc)&19,18);assert(!ctx._midiOut.devices.get(a).notes.size);assert(ctx._midiOut.devices.get(c).notes.has('0:60'));drain();assert.deepEqual(records().at(-1),[a,0x3c9,0x11223344,ha,0]);
assert.equal(api('midiOutReset',[a]),0);assert(ctx._midiOut.devices.get(c).notes.has('0:60'));assert.equal(api('midiStreamStop',[c]),0);drain();
assert.equal(api('midiOutUnprepareHeader',[a,ha,64]),0);assert.equal(api('midiOutUnprepareHeader',[c,hc,64]),0);
// 1200 one-tick NOP events: exact accumulated 1250 ms rather than per-event truncation.
const timing=header(Array.from({length:1200},()=>[1,0x02000000]));submit(a,timing);prop(a,1,480);prop(a,2,500000);now=0;assert.equal(api('midiStreamRestart',[a]),0);prop(a,1,240,11);
for(now=0;now<=1249;now++)assert.equal(api('timeGetTime',[]),now);assert.equal(flags(timing)&19,18,'not completed early');now=1250;api('timeGetTime',[]);assert.equal(flags(timing)&19,3,'fractional deadline');drain();
assert.equal(api('midiStreamPause',[a]),0);prop(a,1,240,11);assert.equal(api('midiStreamStop',[a]),0);prop(a,1,480);
// Paused duration shifts deadline; no completion while paused.
const paused=header([[480,0x02000000]]);submit(a,paused);now=2000;api('midiStreamRestart',[a]);now=2100;api('timeGetTime',[]);api('midiStreamPause',[a]);now=3000;api('timeGetTime',[]);assert.equal(flags(paused)&19,18);api('midiStreamRestart',[a]);now=3399;api('timeGetTime',[]);assert.equal(flags(paused)&19,18);now=3400;api('timeGetTime',[]);assert.equal(flags(paused)&19,3);drain();api('midiStreamStop',[a]);
// Real USER ownership, growable FIFO, and allocator-induced backpressure.
const user32=kapi('LoadLibraryA',[text('user32.dll')]);
function resolve(dll,name){const p=kapi('GetProcAddress',[dll,text(name)]);assert(p,name);return p}
const createWindow=resolve(user32,'CreateWindowExA'),isWindow=resolve(user32,'IsWindow');
const ownerThread=resolve(user32,'GetWindowThreadProcessId');
const kernel=kapi('GetModuleHandleA',[text('kernel32.dll')]);
const currentThread=resolve(kernel,'GetCurrentThreadId');
const hwnd=call(createWindow,[0,text('STATIC'),0,0,0,0,16,16,0,0,0,0]);
assert(hwnd,'public CreateWindowExA creates a real HWND');
assert.equal(call(isWindow,[hwnd]),1);assert.equal(call(isWindow,[0x123]),0);
const owner=call(ownerThread,[hwnd,0]),tid=call(currentThread,[]);
assert(owner);assert.equal(owner,tid,'live window belongs to calling thread');
e.set_post_queue_count(0);
assert.equal(e.post_message_q(0x123,0x400,0,0),0,'invalid HWND is rejected, not saturation');
assert.equal(e.post_queue_depth(),0);
for(let i=0;i<65;i++)assert.equal(e.post_message_q(hwnd,0x400,i,0),1,'valid FIFO grows past inline ring');
assert.equal(e.post_queue_depth(),65);
assert.deepEqual(Array.from({length:65},(_,i)=>e.post_queue_peek(i,2)),Array.from({length:65},(_,i)=>i),'overflow preserves FIFO');
e.set_post_queue_count(0);assert.equal(e.post_queue_depth(),0);
// All guest fixture storage is reserved before genuine allocator exhaustion.
const wh=alloc(4),wd=alloc(4),hw=header([[1,0x02000000]]);put(wd,0);
const held=[],allocationCounts=[];
for(const size of [1048576,65536,4096,256,24,12]){
  let n=0;for(;n<20000;n++){const p=e.guest_alloc(size)>>>0;if(!p)break;held.push(p)}
  assert(n<20000,'bounded real heap exhaustion');allocationCounts.push({size,count:n});
}
assert.equal(e.guest_alloc(24),0,'overflow node cannot allocate');
e.set_post_queue_count(0);
for(let i=0;i<64;i++)assert.equal(e.post_message_q(hwnd,0x400,i,0),1,'all 64 inline posts accepted');
assert.equal(e.post_queue_depth(),64);
assert.equal(e.post_message_q(hwnd,0x400,64,0),0,'real overflow allocation backpressure');
assert.equal(e.post_queue_depth(),64,'failed enqueue loses no queued message');
assert.equal(api('midiStreamOpen',[wh,wd,1,hwnd,0,0x10000]),0);const w=get(wh);
submit(w,hw);api('midiStreamStop',[w]);
assert.equal(flags(hw)&19,3,'header completes even while notification is backpressured');
assert.equal(ctx._midiOut.windowCallbacks.length,2,'OPEN and DONE retained under actual backpressure');
ctx.pumpAudioCompletions();
assert.equal(ctx._midiOut.windowCallbacks.length,2,'retry while full retains both notifications');
assert.deepEqual(Array.from({length:64},(_,i)=>e.post_queue_peek(i,2)),Array.from({length:64},(_,i)=>i),'backpressure leaves FIFO intact');
e.set_post_queue_count(0);ctx.pumpAudioCompletions();
assert.equal(ctx._midiOut.windowCallbacks.length,0);
assert.equal(e.post_queue_depth(),2);
assert.deepEqual([0,1].map(i=>[0,1,2,3].map(j=>e.post_queue_peek(i,j)>>>0)),[[hwnd,0x3c7,w,0],[hwnd,0x3c9,w,hw]]);
ctx.pumpAudioCompletions();assert.equal(e.post_queue_depth(),2,'retained completions delivered exactly once');
for(const p of held)e.guest_free(p);
console.log(JSON.stringify({queueProof:{hwnd,owner,tid,invalidRejected:true,inline:64,overflowAccepted:65,allocationCounts,retained:2,deliveredOnce:2}}));
assert.equal(api('midiStreamClose',[w]),0);assert.equal(api('midiStreamClose',[a]),0);assert.equal(api('midiStreamClose',[c]),0);drain();
for(const h of [a,c,0xdead]){assert.equal(api('midiStreamStop',[h]),5);assert.equal(api('midiStreamClose',[h]),5);assert.equal(api('midiOutShortMsg',[h,0x643c90]),5)}
assert.equal(ctx._midiOut.pending.size,0);assert.equal(ctx._midiOut.devices.size,0);
console.log(JSON.stringify({status:'PASS',control,publicCalls:rows.length,callbacks:callbackCount,callbackRecords:records(),timing1200TicksMs:1250,pauseDeadline:3400,notes:'production bookkeeping only; no acoustic output claim',moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>process.env.WA_MIDI_ROWS&&fs.writeFileSync(process.env.WA_MIDI_ROWS,JSON.stringify(rows)));
