'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
for (const n of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) WebAssembly[n] = () => { throw Error('forbidden Wasm ' + n); };
const { Machine } = require('../tools/toyvm/dos');
const sandbox = {};
new Function('self','atob',fs.readFileSync(path.join(__dirname,'../docs/dos-corpus/live/toyvm-bundle.js'),'utf8'))(sandbox,s=>Buffer.from(s,'base64').toString('binary'));
function fixture(api, pointer) {
  const canvas = new EventTarget(), win = new EventTarget(), doc = new EventTarget();
  Object.assign(canvas,{width:320,height:200,focus(){},getBoundingClientRect:()=>({left:10,top:20,width:640,height:400})});
  if(pointer) win.PointerEvent=function(){};
  function make() {
    const r = new api.LiveRun({canvas,files:{},exe:'never-executed.com'});
    r.machine=Object.assign(Object.create(Machine.prototype),{mouse:{x:0,y:0,buttons:0,dx:0,dy:0,pressed:[0,0,0],released:[0,0,0],reads:0},vga:{bpp:8},audio:{},releaseKeys(){},exited:false});
    return r;
  }
  let run=make();
  const detach=api.bindInput(canvas,()=>run,win,doc);
  const send=(type,buttons,button=-1,target=canvas,x=330,y=220,id=7)=>{
    const e=new Event((pointer?'pointer':'mouse')+type,{cancelable:true});
    Object.assign(e,{buttons,button,clientX:x,clientY:y,...(pointer?{pointerId:id,pointerType:'mouse'}:{})});target.dispatchEvent(e);
  };
  const poll=(fn=3,bx=0)=>{const regs={ax:fn,bx};run.machine.int33({get:k=>regs[k]||0,set:(k,v)=>{regs[k]=v;}});return regs;};
  return {canvas,win,doc,send,poll,detach,get run(){return run;},retry(){const old=run;run=make();return old;}};
}
let passes=0;
for(const [name,api] of [['source',require('../tools/toyvm/live')],['bundle',sandbox.ToyVM.require('tools/toyvm/live.js')]]) for(const pointer of [true,false]) {
  for(const trigger of ['blur','hidden','pagehide','cancel','lostcapture','detach','stop','exit']) {
    const f=fixture(api,pointer);
    try {
      f.send('down',7,0); assert.strictEqual(f.poll().bx,7);
      assert.deepStrictEqual([f.poll().cx,f.poll().dx],[320,100]);
      assert.deepStrictEqual([f.poll(11).cx,f.poll(11).dx],[0,0]);
      f.send('move',7,-1,f.win,9999,-9999);
      assert.deepStrictEqual([f.poll().cx,f.poll().dx],[639,0]);
      const motion=f.poll(11);assert.deepStrictEqual([motion.cx,motion.dx],[319,65436]);
      if(trigger==='blur') f.win.dispatchEvent(new Event('blur'));
      if(trigger==='hidden'){f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));f.doc.hidden=false;}
      if(trigger==='pagehide') f.win.dispatchEvent(new Event('pagehide'));
      if(trigger==='cancel'||trigger==='lostcapture') {
        const e=new Event(trigger==='cancel'?'pointercancel':'lostpointercapture');Object.assign(e,{pointerId:7,pointerType:'mouse'});f.canvas.dispatchEvent(e);
      }
      if(trigger==='detach') f.detach();
      if(trigger==='stop') f.run.stop();
      if(trigger==='exit'){f.run.machine.exited=true;f.run.releaseKeys();f.run.releaseMouse();}
      assert.strictEqual(f.poll().bx,0,trigger+' releases all buttons');
      for(let b=0;b<3;b++) {assert.strictEqual(f.poll(5,b).bx,1);assert.strictEqual(f.poll(6,b).bx,1);assert.strictEqual(f.poll(6,b).bx,0);}
      f.send('move',7,-1);assert.strictEqual(f.poll().bx,0,'stale motion suppressed');
      if(!['detach','stop','exit'].includes(trigger)) {f.send('up',0,0);f.send('down',2,2);assert.strictEqual(f.poll().bx,2,'fresh gesture works');}
      passes++;
    } finally {f.detach();}
  }
  const f=fixture(api,pointer);
  try {
    f.send('down',1,0);const old=f.retry();f.send('move',3,2,f.win);
    assert.strictEqual(old.machine.mouse.buttons,0);assert.strictEqual(f.poll().bx,0);
    f.send('down',4,1);assert.strictEqual(f.poll().bx,4);
    f.detach();f.send('down',1,0);assert.strictEqual(f.poll().bx,0);
    passes++;
  } finally {f.detach();}
  console.log('PASS '+name+' '+(pointer?'pointer':'fallback')+' release/resume, outside clamp/deltas, edge reset, retry/disposal');
}
console.log(JSON.stringify({passes,scope:'DOM and actual LiveRun/INT33 methods only; exit invokes release methods, not guest execution'}));
