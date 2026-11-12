'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {installInputHandlers}=require(process.env.RENDERER_UNDER_TEST || path.resolve('lib/renderer-input.js'));
class Input {constructor(){this.inputQueue=[];this.windows={};this.wasm=null;this.mainWasm=null;}}
installInputHandlers(Input);
const H=0x8000;
const families=[[16,'Shift',160],[17,'Control',162],[18,'Alt',164]];
const bit=(r,k)=>r.getAsyncKeyState(k)&1;
for(const [vk,name,left] of families) {
 for(const reverse of [false,true]) {
  test(`${name} reverse=${reverse}: independent read order, filtered delivery and pending new press`,()=>{
   const r=new Input(), a=reverse?'Right':'Left', b=reverse?'Left':'Right';
   const ka=left+(reverse?1:0),kb=left+(reverse?0:1);
   r.handleKeyDown(vk,{code:name+a});
   assert.equal(bit(r,ka),1); assert.equal(bit(r,vk),1);
   r.handleKeyUp(vk,{code:name+a});
   r.handleKeyDown(vk,{code:name+b});
   assert.equal(bit(r,ka),0); // Reading A must leave B and aggregate pending.
   assert.equal(r.takeInput(()=>false),null);
   assert.equal(bit(r,kb),1);
   r.takeInput(); assert.equal(bit(r,vk),1,'new pending aggregate survives old down delivery');
   r.takeInput(); assert.equal(bit(r,vk),0,'old release cannot create another press');
   r.takeInput(); assert.equal(bit(r,vk),0); assert.equal(bit(r,kb),0);
   assert.equal(r.peekKeyDownState(kb),H); assert.equal(r.peekKeyDownState(ka),0);
  });
 }
 test(`${name}: mixed queue provenance and same-side typematic`,()=>{
  const r=new Input();
  r.handleKeyDown(vk,{code:name+'Right'});
  assert.equal(bit(r,vk),1); assert.equal(bit(r,left+1),1);
  r.inputQueue.push({type:'key',msg:0x104,wParam:vk,lParam:0x401d0001});
  r.handleKeyDown(vk,{code:name+'Right',repeat:true});
  r.takeInput(); assert.equal(bit(r,vk),0);
  r.takeInput(); assert.equal(bit(r,vk),1,'raw queue keydown must still latch');
  r.takeInput(); assert.equal(bit(r,vk),0,'typematic must not republish raw or physical press');
  assert.equal(bit(r,left+1),0);
 });
 test(`${name}: synchronous DirectInput notification consumes before queue publication`,()=>{
  const r=new Input(); let calls=0;
  r._directInputEventHandles={1:7};
  r._directInputSignalEvent=()=>{
   calls++; assert.equal(bit(r,vk),1); assert.equal(bit(r,left),1);
   assert.equal(bit(r,vk),0);
  };
  r.handleKeyDown(vk,{code:name+'Left'});assert.equal(calls,1);
  assert.ok(r.takeInput()); assert.equal(bit(r,vk),0);assert.equal(bit(r,left),0);
 });
 test(`${name}: numeric focus release reentrant during delivery`,()=>{
  const r=new Input();r.handleKeyDown(vk,{code:name+'Left'});r.handleKeyDown(vk,{code:name+'Right'});
  assert.equal(bit(r,vk),1);assert.equal(bit(r,left),1);assert.equal(bit(r,left+1),1);
  let entered=false;
  r._profileMark=()=>{if(entered)return;entered=true;r.handleKeyUp(vk);assert.equal(bit(r,vk),0);};
  while(r.takeInput())assert.equal(bit(r,vk),0);
  assert.ok(entered);assert.equal(r.peekKeyDownState(vk),0);
  assert.equal(r.peekAsyncKeyState(vk),0);
  r._profileMark=null;r.handleKeyDown(vk,{code:name+'Right'});
  assert.equal(bit(r,vk),1);assert.equal(bit(r,left+1),1);r.takeInput();assert.equal(bit(r,vk),0);
 });
 test(`${name}: new press during old delivery is consumed exactly once`,()=>{
  const r=new Input();r.handleKeyDown(vk,{code:name+'Left'});assert.equal(bit(r,vk),1);
  let entered=false;
  r._profileMark=()=>{
   if(entered)return;entered=true;
   r.handleKeyUp(vk,{code:name+'Left'});r.handleKeyDown(vk,{code:name+'Right'});
   assert.equal(bit(r,vk),1);assert.equal(bit(r,left+1),1);
  };
  while(r.takeInput())assert.equal(bit(r,vk),0);
  assert.ok(entered);assert.equal(bit(r,left+1),0);
 });
}
for(const vk of [65,32,121]) for(const worker of [false,true]) {
 test(`ordinary ${vk} worker=${worker}: rapid re-press, repeat and legacy interleaving`,()=>{
  const r=new Input();r._keyboardOwnerRunsInGuestWorker=()=>worker;
  r.handleKeyDown(vk);assert.equal(bit(r,vk),1);r.handleKeyUp(vk);r.handleKeyDown(vk);
  r.takeInput();assert.equal(bit(r,vk),1);r.takeInput();assert.equal(bit(r,vk),0);
  r.takeInput();assert.equal(bit(r,vk),0);
  r.handleKeyDown(vk,{repeat:true});assert.equal(bit(r,vk),1,'retain ordinary repeat behavior');
  const repeat=r.takeInput();assert.equal((repeat.lParam>>>30)&1,1);assert.equal(bit(r,vk),0);
  r.inputQueue.push({type:'key',msg:0x100,wParam:vk,lParam:0x401e0001});
  r.takeInput();assert.equal(bit(r,vk),1);assert.equal(bit(r,vk),0);
 });
}
for(const msg of [0x100,0x104]) test(`raw legacy ${msg}: no blanket suppression or side latch invention`,()=>{
 const r=new Input();
 for(const [vk,,left] of families){
  const e={type:'key',msg,wParam:vk,lParam:0x201d0001};r.inputQueue.push(e);
  assert.equal(bit(r,vk),0);assert.equal(r.takeInput(),e);
  assert.equal(r.getAsyncKeyState(vk),H|1);assert.equal(r.getAsyncKeyState(vk),H);
  assert.equal(bit(r,left),0);assert.equal(bit(r,left+1),0);assert.equal(e.lParam,0x201d0001);
 }
});
