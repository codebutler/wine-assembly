'use strict';
// Projective vertices on the WebGL path (lib/gl-compat.js), in a real browser.
//
// The packed vertex carries w as its 15th float (aPositionW), and the vertex
// shader builds the clip position from vec4(aPosition, aPositionW), so WebGL's
// own clip, divide and perspective-correct interpolation see the vertex w.
// Matrices are identity, so clip = vertex. A 2x1 texture (red | blue, NEAREST,
// REPLACE) is mapped s = 0 at the left edge to s = 1 at the right of a quad
// that fills the 64x64 canvas:
//  - w = 1:            the red/blue boundary is at column 32;
//  - w = 2, xyz x2:    the same points, so the same boundary;
//  - w = 1 left, 3 right (xyz x3 there): s reaches 0.5 three quarters across
//    (column 48), because interpolation weights the left by 1/w.
// Usage: node test/test-gl-projective-web.js [outDir]   (CHROME_PATH overrides)
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..');
const out=process.argv[2] || path.join(root,'scratch/runs',new Date().toISOString().replace(/[:.]/g,'-')+'-gl-projective-web');
const puppeteer=require(root+'/node_modules/puppeteer');
fs.mkdirSync(out,{recursive:true});
let browser;const startedAt=new Date().toISOString();
const guard=setTimeout(()=>{if(browser)browser.process().kill('SIGKILL');process.exitCode=1;},120000);
(async()=>{try{
 browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 for(const f of ['gpu-backend.js','gl-command-stream.js','gl-compat.js'])await page.addScriptTag({path:root+'/lib/'+f});
 fs.writeFileSync(out+'/identity.json',JSON.stringify({startedAt,pid:process.pid,browser:await browser.version(),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/lib/gl-compat.js')).digest('hex')}));
 const results=await page.evaluate(()=>{
  const results=[];
  for(const version of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;document.body.appendChild(canvas);
   const b=new GpuBackend.WebGLBackend(canvas,{apiVersion:version,preserveDrawingBuffer:true,antialias:false,alpha:true});
   const f=new OpenGLCompat.FixedFunctionGL(b),G=OpenGLCompat.constants,g=b.gl;g.viewport(0,0,64,64);g.disable(g.DITHER);
   f.bindTexture(1);f.setEnabled(G.TEXTURE_2D,true);f.setTextureMode(G.REPLACE);
   f.texImage(0,G.RGBA,2,1,0,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array([255,0,0,255, 0,0,255,255]));
   f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST);
   f.texParameter(G.TEXTURE_WRAP_S,G.CLAMP_TO_EDGE);f.texParameter(G.TEXTURE_WRAP_T,G.CLAMP_TO_EDGE);
   const boundary=(label,wl,wr)=>{
    const vertices=[];
    for(const[x,y]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
     const w=x<0?wl:wr;
     vertices.push(x*w,y*w,0, 1,1,1,1, (x+1)/2,0.5, 0,0,1, (x+1)/2,0.5, w, 0,1,0,1);
    }
    f.enqueuePacked(G.TRIANGLES,new Float32Array(vertices));f.flushPendingDraw();
    const row=new Uint8Array(64*4);g.readPixels(0,32,64,1,g.RGBA,g.UNSIGNED_BYTE,row);
    let edge=-1;for(let x=0;x<64;x++){if(row[x*4+2]>200&&row[x*4]<50){edge=x;break;}}
    const red=Array.from({length:64},(_,x)=>row[x*4]>200&&row[x*4+2]<50).filter(Boolean).length;
    const r={version,label,edge,red,error:g.getError()};results.push(r);return r;
   };
   const flat=boundary('w = 1',1,1);
   const same=boundary('w = 2 everywhere',2,2);
   const proj=boundary('w = 1 | 3',1,3);
   const fail=(m)=>{throw Error(m+' '+JSON.stringify(results));};
   if(flat.error||same.error||proj.error)fail('GL error');
   if(Math.abs(flat.edge-32)>1||flat.red+64-flat.edge!==64)fail('w = 1 boundary not at mid-canvas');
   if(same.edge!==flat.edge)fail('uniform w = 2 moved the boundary');
   if(Math.abs(proj.edge-48)>1)fail('w = 1 | 3 boundary not at three quarters');
   // Matrix-generated S=3*s, Q=1+2*s must be divided per fragment.
   // Ignoring Q puts the boundary at 1/6; dividing per vertex puts it at
   // 1/2. Correct homogeneous interpolation puts it at 1/4 (column16).
   const identity=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
   const projective=[3,0,0,2, 0,1,0,0, 0,0,1,0, 0,0,0,1];
   for(const unit of [0,1]){
    f.setActiveTexture(0x84C0);f.setEnabled(G.TEXTURE_2D,unit===0);
    f.setActiveTexture(0x84C1);f.setEnabled(G.TEXTURE_2D,unit===1);
    f.setActiveTexture(0x84C0+unit);f.bindTexture(1);f.setTextureMode(G.REPLACE);
    f.matrixMode=G.TEXTURE;f._replaceMatrix(projective);
    for(const wrap of [G.CLAMP_TO_EDGE,G.CLAMP]){
     f.texParameter(G.TEXTURE_WRAP_S,wrap);
     const q=boundary(`texture q unit${unit} wrap${wrap}`,1,1);
     if(q.error||Math.abs(q.edge-16)>1)fail('projective texture boundary not at one quarter');
     const wq=boundary(`vertex w and texture q unit${unit} wrap${wrap}`,1,3);
     if(wq.error||Math.abs(wq.edge-32)>1)fail('vertex w and texture q must interpolate independently');
    }
    f._replaceMatrix(identity);
    const reset=boundary(`texture q reset unit${unit}`,1,1);
    if(reset.error||Math.abs(reset.edge-32)>1)fail('identity texture matrix did not restore q=1');
   }
   b.destroy();
  }
  return results;
 });
 fs.writeFileSync(out+'/pixels.json',JSON.stringify(results,null,2));await page.screenshot({path:out+'/pixels.png'});
 console.log('PASS test-gl-projective-web '+JSON.stringify(results.map(r=>[r.version,r.label,r.edge])));
}catch(e){fs.writeFileSync(out+'/error.json',JSON.stringify({error:e.stack||String(e)}));console.error(e.stack);process.exitCode=1;
}finally{if(browser)await browser.close();clearTimeout(guard);fs.writeFileSync(out+'/cleanup.json',JSON.stringify({finishedAt:new Date().toISOString(),pid:process.pid,exitCode:process.exitCode||0}));}})();
