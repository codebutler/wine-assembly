#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
    args:['--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();
    for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat'])await page.addScriptTag({path:path.join(__dirname,`../lib/${name}.js`)});
    const results=await page.evaluate(()=>{
      const results=[];
      const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);};
      for(const apiVersion of [1,2]) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
        const gpu=new GpuBackend.WebGLBackend(canvas,{apiVersion,stencil:true,alpha:true}),gl=gpu.gl;
        const front=new OpenGLCompat.FixedFunctionGL(gpu),memory=new ArrayBuffer(512),dv=new DataView(memory);
        const bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory,exports:{guest_to_wasm:p=>p}});
        const ctx={frontend:front,backend:gpu,win:{},layer:{}};bridge.contexts.set(1,ctx);bridge.current=1;
        const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
        const f=x=>{dv.setFloat32(256,x,true);return dv.getUint32(256,true);};
        const mask=m=>call('glColorMask',[0,1,2,3].map(i=>(m>>i)&1));
        const pixel=(x=2,y=2)=>Array.from(gpu.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
        const clear=(rgba=[.2,.4,.6,.8],bits=gl.COLOR_BUFFER_BIT)=>{call('glClearColor',rgba.map(f));call('glClear',[bits]);};
        const draw=(rgba=[1,0,1,1],z=0,flush=true)=>{const v=new Float32Array(19);v.set([-.6875,-.6875,z,...rgba]);v[14]=1;front.enqueuePacked(gl.POINTS,v);if(flush)front.flushPendingDraw();};
        const expectMask=(base,value,m)=>base.map((v,i)=>m&(1<<i)?value[i]:v);
        call('glViewport',[0,0,16,16]);mask(15);clear();const base=pixel();
        for(let m=0;m<16;m++) {
          mask(15);clear();mask(m);clear([1,0,1,1]);same(pixel(),expectMask(base,[255,0,255,255],m),`clear ${m}`);
          mask(15);clear();mask(m);draw();same(pixel(),expectMask(base,[255,0,255,255],m),`draw ${m}`);
        }
        mask(15);clear();mask(2);call('glEnable',[gl.SCISSOR_TEST]);call('glScissor',[2,2,1,1]);clear([1,1,1,1]);call('glDisable',[gl.SCISSOR_TEST]);
        same(pixel(),expectMask(base,[255,255,255,255],2),'scissor inside');same(pixel(3,2),base,'scissor outside');
        mask(15);clear();call('glClear',[gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT]);
        call('glEnable',[gl.DEPTH_TEST]);call('glDepthFunc',[gl.LESS]);call('glEnable',[gl.STENCIL_TEST]);
        call('glStencilFunc',[gl.ALWAYS,7,255]);call('glStencilOp',[gl.KEEP,gl.INCR,gl.REPLACE]);mask(0);draw([1,0,0,1],-.5);
        same(pixel(),base,'hidden draw color');mask(15);draw([1,0,0,1],.5);same(pixel(),base,'hidden draw depth');
        call('glDisable',[gl.DEPTH_TEST]);call('glStencilFunc',[gl.EQUAL,8,255]);call('glStencilOp',[gl.KEEP,gl.KEEP,gl.KEEP]);draw([0,1,0,1]);same(pixel(),[0,255,0,255],'hidden draw stencil');call('glDisable',[gl.STENCIL_TEST]);
        mask(5);call('glPushAttrib',[0x4000]);mask(0);call('glPopAttrib');same(gl.getParameter(gl.COLOR_WRITEMASK),[true,false,true,false],'attrib');
        call('glPushAttrib',[0x2000]);mask(2);call('glPopAttrib');same(gl.getParameter(gl.COLOR_WRITEMASK),[false,true,false,false],'unrelated attrib');
        call('glColorMask',[256,2,255,0]);same(gl.getParameter(gl.COLOR_WRITEMASK),[false,true,true,false],'GLboolean byte');
        call('glGetFloatv',[gl.COLOR_WRITEMASK,128]);same([0,1,2,3].map(i=>dv.getFloat32(128+i*4,true)),[0,1,1,0],'float query');
        // A setter flushes the old pending draw before changing the backend mask.
        mask(15);clear([0,0,0,0]);mask(1);draw([1,0,0,1],0,false);mask(2);draw([0,1,0,1],0,false);mask(0);same(pixel(),[255,255,0,0],'pending draw ordering');
        // Bitmap points and color seeding obey distinct responsibilities: a seed
        // imports all canonical DIB channels then restores the guest write mask.
        mask(4);gpu.seedColorBuffer(new Uint8Array(16*16*4).fill(51),16,16);same(pixel(),[51,51,51,51],'seed all channels');
        same(gl.getParameter(gl.COLOR_WRITEMASK),[false,false,true,false],'seed restoration');
        const v=new Float32Array(19);v.set([2,2,.5,1,1,1,1]);gpu.drawBitmapPoints(v,false,gl.ALWAYS,0);same(pixel(),[51,51,255,51],'bitmap mask');
        mask(5);bridge._clientSize=()=>({w:20,h:20});bridge._syncDrawableSize(ctx);
        same(gl.getParameter(gl.COLOR_WRITEMASK),[true,false,true,false],'resize');
        clear([1,1,1,1]);same(pixel(),[255,0,255,0],'resized masked clear');
        gpu.present();same(gl.getParameter(gl.COLOR_WRITEMASK),[true,false,true,false],'present restores mask');
        clear([0,1,0,1]);same(pixel(),[0,0,0,0],'masked clear after present');
        results.push({version:gpu.version,maskCases:16,base,error:gl.getError()});front.destroy();
      }
      return results;
    });
    for(const r of results)assert.strictEqual(r.error,0);
    console.log('PASS WebGL1+2 all color masks, clears/draws, zero-mask depth/stencil, pending order, bitmap/seed/resize/present',JSON.stringify(results));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
