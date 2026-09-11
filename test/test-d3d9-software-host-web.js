#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const puppeteer=require('puppeteer');
const {startStaticServer,closeServer}=require('./static-server');
const {compileSrcWasm}=require('./compile-src');
const root=path.join(__dirname,'..');
(async()=>{
  const wasm=compileSrcWasm();
  console.log(`Browser render worker: compiled ${wasm.length} canonical WASM bytes`);
  const server=await startStaticServer({root,crossOriginIsolated:true,cacheControl:'no-cache',
    handleRequest(request,response){
      if(!request.url.startsWith('/build/wine-assembly.wasm'))return false;
      response.writeHead(200,{'Content-Type':'application/wasm','Content-Length':wasm.length,
        'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});
      response.end(wasm);return true;
    }});
  const browser=await puppeteer.launch({headless:true,
    executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--no-first-run','--no-default-browser-check']});
  try {
    for(const threaded of [false,true]){
      const page=await browser.newPage();const errors=[],consoleErrors=[];
      page.on('pageerror',error=>errors.push(String(error)));
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html?debug&frozen&d3d9-renderer=software`,
        {waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction('typeof launchApp === "function"');
      console.log(`Browser render worker: launching ${threaded?'guest-worker':'cooperative'} calc`);
      await page.evaluate(async threaded=>{
        // Exercise the per-app profile used by local Black & White launches,
        // without loading its large assets for this focused COM regression.
        window.wineApps.APPS.calc.d3d9Programmable=true;
        await setThreads(threaded);document.getElementById('app-select').value='calc';launchApp();
      },threaded);
      await page.waitForFunction(()=>typeof runningApps!=='undefined' && runningApps[0]?.wine?.running && runningApps[0].wine._frozenStep,
        {timeout:120000}).catch(error=>{throw new Error(`${error.message}; browser: ${errors.concat(consoleErrors).join('\n')}`);});
      console.log('Browser render worker: guest frozen and ready');
      await page.evaluate(()=>{
        const wine=runningApps[0].wine,e=wine.instance.exports,ctx=wine.hostCtx,memory=wine.memory;
        const alloc=n=>e.guest_alloc(n)>>>0;
        const p=wine.d3dProbe={pp:alloc(64),out:alloc(4),vertices:alloc(48),marker:alloc(4),stack:alloc(4096)};
        new Uint8Array(memory.buffer,e.guest_to_wasm(p.pp),64).fill(0);
        [8,8,21,1,0,0,1,1].forEach((v,i)=>e.guest_write32(p.pp+i*4,v));
        const view=new DataView(memory.buffer),wa=e.guest_to_wasm(p.vertices);
        [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
          v.forEach((n,j)=>view.setFloat32(wa+i*16+j*4,n,true));view.setUint32(wa+i*16+12,0xffff0000,true);
        });
        const bridge=ctx.d3d9Bridge,call=bridge.call;p.calls=[];
        bridge.call=function(op,a,x){if(op===0x30002)p.target=view.getUint32(a+8,true);
          const result=call.call(this,op,a,x);p.calls.push([op,result]);return result;};
        p.call=async(name,args)=>{
          const id=ctx.apiTable.find(a=>a.name===name).id,base=e.get_thunk_base()>>>0;
          let thunk=0;for(let i=0;i<e.get_num_thunks();i++){
            if((e.guest_read32(base+i*8)>>>0)===0xcaca0010 && e.guest_read32(base+i*8+4)===id){thunk=base+i*8;break;}
          }
          if(!thunk)throw Error('missing '+name);
          const dw=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],code=alloc(256);
          new Uint8Array(memory.buffer).set([...args.slice().reverse().flatMap(n=>[0x68,...dw(n)]),
            0xb8,...dw(thunk),0xff,0xd0,0xa3,...dw(p.marker),0xeb,0xfe],e.guest_to_wasm(code));
          e.guest_write32(p.marker,0xdeadbeef);
          const set=async(name,...args)=>wine.guestWorker?wine.guestWorker.callExport(name,...args):e[name](...args);
          await set('set_esp',p.stack+4000);await set('clear_yield');await set('set_eip',code);
        };
      });
      const call=async(name,args)=>{
        await page.evaluate(({name,args})=>{const p=runningApps[0].wine.d3dProbe;
          return p.call(name,args.map(n=>typeof n==='string'?p[n]:n));},{name,args});
        const deadline=Date.now()+60000;
        while(Date.now()<deadline){
          await page.evaluate(()=>runningApps[0].wine.stepFrozen(4));
          const result=await page.evaluate(()=>{const w=runningApps[0].wine;return w.instance.exports.guest_read32(w.d3dProbe.marker)>>>0;});
          if(result!==0xdeadbeef){
            const reason=await page.evaluate(()=>{const w=runningApps[0].wine,b=w.hostCtx.d3d9Bridge;return JSON.stringify({
              error:String(b.lastError),backend:b.backend,async:b.asyncSoftware,enabled:b.options.enableProgrammable,calls:w.d3dProbe.calls});});
            assert.strictEqual(result,0,`${threaded?'Worker':'cooperative'} ${name}: ${reason}; ${errors.concat(consoleErrors)}`);return;
          }
        }
        throw Error(`${name} never resumed: ${errors}`);
      };
      await call('IDirect3D9_CreateDevice',[0,0,1,1,0,'pp','out']);
      await page.evaluate(()=>{const w=runningApps[0].wine;w.d3dProbe.device=w.instance.exports.guest_read32(w.d3dProbe.out)>>>0;});
      await call('IDirect3DDevice9_SetFVF',['device',0x42]);
      await call('IDirect3DDevice9_SetRenderState',['device',137,0]);
      await call('IDirect3DDevice9_SetRenderState',['device',22,1]);
      await call('IDirect3DDevice9_DrawPrimitiveUP',['device',4,1,'vertices',16]);
      await call('IDirect3DDevice9_Present',['device',0,0,0,0]);
      const result=await page.evaluate(()=>{
        const w=runningApps[0].wine,b=w.hostCtx.d3d9Bridge,q=b.devices.get(w.d3dProbe.device).queue;
        return {pixel:new Uint32Array(w.memory.buffer,w.d3dProbe.target,64)[9],worker:b.workerConsumer.initialized,
          guestWorker:!!w.guestWorker,pending:b.requests.size,submitted:q.submitted,completed:q.completed};
      });
      assert.deepStrictEqual(result,{pixel:0xffff0000,worker:true,guestWorker:threaded,pending:0,submitted:4,completed:4});
      await call('IDirect3DDevice9_Clear',['device',0,0,1,0xff0000ff,0,0]);
      await page.evaluate(()=>{const w=runningApps[0].wine,p=w.d3dProbe;
        [2,0,4,2].forEach((v,i)=>w.instance.exports.guest_write32(p.pp+i*4,v));});
      await call('IDirect3DDevice9_SetScissorRect',['device','pp']);
      await call('IDirect3DDevice9_SetRenderState',['device',174,1]);
      await page.evaluate(()=>{const w=runningApps[0].wine,p=w.d3dProbe;
        for(let i=0;i<4;i++)w.instance.exports.guest_write32(p.pp+i*4,0x77777777);});
      await call('IDirect3DDevice9_DrawPrimitiveUP',['device',4,1,'vertices',16]);
      await call('IDirect3DDevice9_Present',['device',0,0,0,0]);
      const scissorPixels=()=>page.evaluate(()=>{const w=runningApps[0].wine,
        p=new Uint32Array(w.memory.buffer,w.d3dProbe.target,64);return [p[10],p[9],p[18]];});
      assert.deepStrictEqual(await scissorPixels(),[0xffff0000,0xff0000ff,0xff0000ff]);
      await call('IDirect3DDevice9_Clear',['device',0,0,1,0xff00ff00,0,0]);
      await call('IDirect3DDevice9_Present',['device',0,0,0,0]);
      assert.deepStrictEqual(await scissorPixels(),[0xff00ff00,0xff0000ff,0xff0000ff]);
      await call('IDirect3DDevice9_Release',['device']);
      const retired=await page.evaluate(async()=>{
        const w=runningApps[0].wine,b=w.hostCtx.d3d9Bridge;
        await w.hostCtx.closeD3DRender();const info=b.workerConsumer.shutdownInfo;w.stop();return info;
      });
      assert.strictEqual(retired.allocatedBytes,0);assert(retired.heapAdopted>=0);
      assert.deepStrictEqual(errors,[]);
      await page.close();
      console.log(`PASS browser ${threaded?'guest-main Worker':'cooperative main'} -> software render Worker -> canonical draw/scissored Draw+Clear and native retirement`);
    }
  } finally {await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
