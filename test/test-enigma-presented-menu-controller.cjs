'use strict';
// Dependency-free OFFLINE control/canvas fixture; no runner or guest execution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {MENU,createController,ATOMIC_ACTION,ATOMIC_BRANCH}=require('../tools/enigma-presented-menu-controller.cjs');
const contract=require('./fixtures/enigma-presented-menu-contract.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=fs.readFileSync(path.join(__dirname,
  '../docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png'));
assert.equal(sha(expected),MENU.pngSHA256);
assert.equal(sha(contract.helper),contract.helperSHA256);
for(const [k,v] of Object.entries(contract.parts)) {
  assert.equal(sha(v),contract.excerpts[k].sha256);
  assert.equal(Buffer.byteLength(v),contract.excerpts[k].bytes);
}
// Small RGBA8 PNG decoder for the immutable inspected fixture. Implements all
// five scanline filters, no canvas, native module, installed codec or browser.
function decodePNG(b) {
  const width=b.readUInt32BE(16),height=b.readUInt32BE(20),chunks=[];
  assert.equal(b[24],8);assert.equal(b[25],6);assert.equal(b[28],0);
  for(let off=8;off<b.length;) {
    const n=b.readUInt32BE(off),type=b.toString('ascii',off+4,off+8);
    if(type==='IDAT') chunks.push(b.subarray(off+8,off+8+n));off+=n+12;
  }
  const stride=width*4,raw=zlib.inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});
  assert.equal(raw.length,(stride+1)*height);const data=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
  for(let y=0;y<height;y++) {
    const f=raw[y*(stride+1)];assert(f<=4);
    for(let x=0;x<stride;x++) {
      const i=y*stride+x,a=x>=4?data[i-4]:0,b=y?data[i-stride]:0,c=y&&x>=4?data[i-stride-4]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][f];
      data[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return {width,height,data};
}
function crc(b){let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return (n^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),b.length-4);return b}
function encodePNG(width,height,data){
  const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;
  const raw=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++)data.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([expected.subarray(0,8),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const image=decodePNG(expected);
assert.equal(sha(image.data),'a44ee9b285f41ab7ac824d47703d06a81cf85b126b77cb6b93ae0b285207f587');
assert.equal(image.width,640);assert.equal(image.height,480);

function fixture(options={}) {
  const events=[],files=new Map(),tickState={batch:100000};let clicks=0;
  const menu=Buffer.from(image.data);if(options.changedPixel)menu[12345]^=1;
  const canvas={width:options.wrongSize?639:640,height:480,data:Buffer.alloc(image.data.length),
    getContext(){return {getImageData:()=>({data:canvas.data})}},
    toBufferSync(){events.push('serialize');
      // Preserve the inspected PNG's actual codec bytes when pixels agree.
      return canvas.width===640&&canvas.data.equals(image.data)?Buffer.from(expected):encodePNG(canvas.width,480,canvas.data);
    }};
  if(options.eager)canvas.data=Buffer.from(menu);
  const repaint=function(){events.push('repaint');canvas.data=Buffer.from(menu)};
  const renderer={canvas,repaint:options.noRepaint?undefined:repaint};
  const originalRepaint=renderer.repaint;
  const fakeFS={existsSync:p=>files.has(p),statSync:p=>{
    if(options.readError)throw Error('mock readback error');
    if(!files.has(p))throw Error('ENOENT');return {isFile:()=>true,size:files.get(p).length};
  },readFileSync:p=>{events.push('readback');return files.get(p)},writeFileSync:(p,b)=>{events.push('write');files.set(p,b)}};
  const context=vm.createContext({Buffer,renderer,tickState,fs:fakeFS,
    process:{getBuiltinModule:n=>n==='fs'?fakeFS:require('node:'+n),memoryUsage:()=>({rss:0})}});
  // Execute byte-exact runner boundary functions. Hooks stay private in an IIFE;
  // controlEval's real new Function cannot see presentForRead/dxPresentHook.
  vm.runInContext(`(()=>{
    let dxPresentHook=null;const instance={exports:{}},memory={buffer:{byteLength:0}},
      g2w=()=>0,ctx={},resolveAddr=()=>0,moduleBases={},controlSafeValue=x=>x;
    let controlFrozen=true,controlRunCredits=0,videoRecorder=null;
    // This older pixel fixture mocks parsing/queueing; the full protocol suite
    // separately executes the pinned parser, snapshot and complete handler.
    const scheduledInput=[],parseInputEntries=()=>[{action:'click',batch:tickState.batch,x:344,y:212}];
    globalThis.atomic=cmd=>{${ATOMIC_BRANCH}};
    const presentDxIfDirty=()=>{};
    ${contract.parts.presentForRead}
    ${contract.parts.dxPresentHook}
    ${options.missingHook?'dxPresentHook=null;':''}
    ${contract.parts.controlEval}
    ${contract.parts.controlPng}
    globalThis.controlEval=controlEval;globalThis.controlPng=controlPng;
  })()`,context);
  if(options.staleFile)files.set('/owned/menu.png',expected);
  let evalCount=0;
  const ask=async command=>{
    events.push(command.action||command.cmd);
    try {
      let value;
      if(command.action==='snapshot')value={batch:tickState.batch,
        frozen:{frozen:!options.live,credits:options.credits?1:0,recording:false},
        windows:[{title:options.wrongTitle?'Other screen':MENU.title}]};
      else if(command.action==='eval'){
        evalCount++;
        if(options.cleanupError&&evalCount===3)return {ok:false,error:'cleanup rejected before dispatch'};
        if(options.evalError&&evalCount===2)return {ok:false,error:'mock eval error'};
        value=context.controlEval(command.code);
        if(evalCount===2&&options.badHash)value.pngSHA256='0'.repeat(64);
      } else if(command.action==='png'){
        if(options.pngError)throw Error('mock PNG error');
        value=context.controlPng(command.path);
        if(options.batchDrift)tickState.batch++;
        if(options.badPngBatch)value.batch++;
        if(options.badPngPath)value.path='/other.png';
        if(options.badPngBytes)value.bytes++;
        if(options.badPngFrozen)value.frozen=false;
        if(options.truncated)files.set(command.path,Buffer.from('broken'));
        if(options.changedCanvasSize)canvas.width=800;
      } else {
        assert.equal(command.action,ATOMIC_ACTION);

        assert(events.includes('readback'),'readback before click');
        value=context.atomic(command);assert.equal(renderer.repaint,originalRepaint,'observer restored by atomic operation');clicks++;
        if(options.lostThrow)throw Error('transport lost AFTER enqueue');
        if(options.lostEnvelope)return {ok:false,error:'transport lost AFTER enqueue'};
        if(options.missingEnvelope)return undefined;
        if(options.missingValue)return {ok:true};
        if(options.nullAck)return {ok:true,value:null};
        if(options.malformedAck)return {ok:true,value:{queued:false,batch:tickState.batch}};
        if(options.wrongAckBatch)return {ok:true,value:{queued:true,batch:tickState.batch+1}};
        if(options.malformedEnvelope)return {ok:'true',value};
      }
      return {ok:true,value};
    } catch(error){
      if(options.lostThrow&&clicks>0)throw error;
      return {ok:false,error:error.message};
    }
  };
  return {ask,events,context,renderer,originalRepaint,get clicks(){return clicks},
    run:createController(ask,'/owned/menu.png')};
}
let passes=0,rejections=0;
async function test(name,fn){await fn();passes++;console.log('PASS '+name)}
(async()=>{
  // Final-outcome tests can run alone without replaying unchanged pixel groups.
  for(const fault of ['lostEnvelope','lostThrow','missingEnvelope','missingValue',
    'nullAck','malformedAck','wrongAckBatch','malformedEnvelope']) {
    await test(fault+' after enqueue is unknown and consumed',async()=>{
      const f=fixture({[fault]:true});
      await assert.rejects(f.run(),e=>{
        assert.equal(e.code,'ENIGMA_ENQUEUE_OUTCOME_UNKNOWN');
        assert.equal(e.enqueueOutcome,'unknown');
        assert.match(e.message,/enqueue outcome unknown/);
        assert.doesNotMatch(e.message,/no click/i);return true;
      });
      assert.equal(f.clicks,1);assert.equal(f.renderer.repaint,f.originalRepaint);
      assert.equal(f.events.filter(x=>x===ATOMIC_ACTION).length,1);
      await assert.rejects(f.run(),/consumed/);assert.equal(f.clicks,1);
    });
  }
  await test('known pre-dispatch cleanup rejection never invokes atomic action',async()=>{
    const f=fixture({cleanupError:true});
    await assert.rejects(f.run(),e=>{
      assert.equal(e.enqueueOutcome,'not-dispatched');
      assert.equal(e.code,'ENIGMA_NOT_DISPATCHED');return true;
    });
    assert.equal(f.clicks,0);assert(!f.events.includes(ATOMIC_ACTION));
    assert.equal(f.renderer.repaint,f.originalRepaint);
    await assert.rejects(f.run(),/consumed/);assert.equal(f.clicks,0);
  });
  await test('acknowledged enqueue is exactly once and consumed',async()=>{
    const f=fixture(),r=await f.run();
    assert.equal(r.enqueueOutcome,'acknowledged');assert.equal(r.click.queued,true);
    assert.equal(r.click.batch,100000);assert.equal(f.clicks,1);
    await assert.rejects(f.run(),/consumed/);assert.equal(f.clicks,1);
    assert.equal(f.events.filter(x=>x===ATOMIC_ACTION).length,1);
  });
  if(process.argv.includes('--final-dispatch-only')) {
    console.log(JSON.stringify({pass:passes,guestExecutions:0,group:'final-dispatch-only'}));return;
  }
  await test('legacy lazy framebuffer rejects the unchanged inspected menu before click',async()=>{
    const f=fixture(),raw=f.context.controlEval(contract.legacyCode);
    assert.notEqual(raw.rgbaSHA256,sha(image.data));
    assert.equal(raw.rgbaSHA256,'3630e065eb7b4540fbab11dbfd2619e8500f211b9c404380a1867fdc44b77c0c');
    assert.throws(()=>assert.equal(raw.rgbaSHA256,sha(image.data),
      'before framebuffer differs from inspected menu; no click'),/before framebuffer differs/);
    assert.equal(f.clicks,0);
  });
  await test('control eval really cannot reach runner-private presentation hooks',async()=>{
    const f=fixture();assert.equal(f.context.controlEval('typeof presentForRead'),'undefined');
    assert.equal(f.context.controlEval('typeof dxPresentHook'),'undefined');
  });
  for(const eager of [false,true])await test(eager?'eager menu clicks exactly once':'lazy unchanged menu presents then clicks exactly once',async()=>{
    const f=fixture({eager}),r=await f.run();assert.equal(r.safety.pngSHA256,MENU.pngSHA256);
    assert.equal(r.click.x,344);assert.equal(r.click.y,212);assert.equal(f.clicks,1);
    const e=f.events;assert(e.indexOf('repaint')<e.indexOf('serialize'));
    assert(e.indexOf('write')<e.indexOf('readback'));assert(e.indexOf('readback')<e.indexOf(ATOMIC_ACTION));
    assert(!e.some(x=>x.startsWith('step')));assert.equal(f.renderer.repaint,f.originalRepaint);
    await assert.rejects(f.run(),/already consumed/);assert.equal(f.clicks,1);
  });
  await test('missing presentation hook rejects even when canvas already matches menu',async()=>{
    const f=fixture({eager:true,missingHook:true});await assert.rejects(f.run(),/readback error/);
    assert.equal(f.clicks,0);assert.equal(f.renderer.repaint,f.originalRepaint);rejections++;
  });
  const cases={changedPixel:/framebuffer differs/,wrongSize:/dimensions/,readError:/readback error/,
    missingHook:/readback error/,noRepaint:/readback error/,pngError:/readback error/,
    evalError:/readback error/,wrongTitle:/title/,live:/frozen/,credits:/frozen/,
    batchDrift:/readback error/,badPngBatch:/transaction/,badPngPath:/transaction/,
    badPngBytes:/byte count/,badPngFrozen:/transaction/,truncated:/readback error/,
    changedCanvasSize:/dimensions/,badHash:/framebuffer differs/,staleFile:/readback error/};
  for(const [name,error] of Object.entries(cases))await test(name+' rejects without click',async()=>{
    const f=fixture({[name]:true});await assert.rejects(f.run(),error);
    assert.equal(f.clicks,0);assert.equal(f.renderer.repaint,f.originalRepaint);
    await assert.rejects(f.run(),/already consumed/);assert.equal(f.clicks,0);rejections++;
  });
  console.log(JSON.stringify({pass:passes,rejections,positiveClicks:2,guestExecutions:0,
    expectedPNG:MENU.pngSHA256,expectedRGBA:sha(image.data)}));
})().catch(e=>{console.error(e);process.exitCode=1});
