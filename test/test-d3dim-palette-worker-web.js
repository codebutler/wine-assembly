#!/usr/bin/env node
'use strict';
// Actual production guest and render Workers; no synthetic Release or decoder.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const puppeteer=require('puppeteer');
const {compileSrcWasm}=require('./compile-src');
const {startStaticServer,closeServer}=require('./static-server');
const extraWat=require('./helpers/palette-worker-wat');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const wasm=compileSrcWasm((file,source)=>file==='13-exports.wat'?source+'\n'+extraWat:source);
  const scripts=['lib/region-map.generated.js','lib/gl-command-stream.js','lib/d3d-command-stream.js','lib/guest-rpc.js',
    'lib/guest-thread-host.js','lib/render-worker.js','test/helpers/palette-worker-browser.js'];
  const evidence={source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    diff:cp.execFileSync('git',['diff','--stat'],{encoding:'utf8'}).trim(),
    wasmSha256:sha(wasm),extraWatSha256:sha(extraWat),
    scripts:Object.fromEntries(scripts.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]))};
  const server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.url==='/palette-worker.wasm'){
      res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;
    }
    if(req.url!=='/palette-worker-fixture')return false;
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(scripts.map(p=>`<script src="/${p}"></script>`).join('\n'));return true;
  }});
  let browser,page;
  try{
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/chromium',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.results=[];
    for(const lazySync of [false,true]){
      page=await browser.newPage();
      page.on('pageerror',error=>console.error('pageerror:',error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/palette-worker-fixture`);
      evidence.results.push(await page.evaluate(lazy=>runPaletteWorker(lazy),lazySync));
      console.log(`PASS production guest/render Worker palette lifetime and keyed RGBA/state snapshots/cache transitions; lazySync=${lazySync}`);
      await page.close();page=null;
    }
  }catch(error){
    evidence.error=error.stack||String(error);
    if(page)evidence.partial=await page.evaluate(()=>globalThis.paletteWorkerEvidence||null).catch(()=>null);
    throw error;
  }finally{
    if(process.env.PALETTE_WORKER_EVIDENCE)fs.writeFileSync(process.env.PALETTE_WORKER_EVIDENCE,JSON.stringify(evidence,null,2)+'\n');
    if(browser)await browser.close();await closeServer(server);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
