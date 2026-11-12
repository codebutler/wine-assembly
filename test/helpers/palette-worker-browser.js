'use strict';
globalThis.runPaletteWorker=async function(lazySync=false){
  const evidence=globalThis.paletteWorkerEvidence={lazySync,observations:[],barriers:[],snapshots:[],logs:[]};
  const check=(v,s)=>{if(!v)throw Error(s);};
  const eq=(a,b,s)=>check(JSON.stringify(a)===JSON.stringify(b),`${s}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const until=async(predicate,label)=>{
    const end=performance.now()+10000;
    while(!predicate()){if(performance.now()>end)throw Error('timeout '+label);await new Promise(r=>setTimeout(r,5));}
  };
  check(crossOriginIsolated,'isolated shared memory');
  const module=await WebAssembly.compile(await (await fetch('/palette-worker.wasm')).arrayBuffer());
  const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const host={};for(const name of Object.keys(sigs))host[name]=()=>{throw Error('unexpected broker import '+name);};
  for(const name of ['log','log_i32','log_block','log_eip','log_api_exit','dx_trace'])
    host[name]=(...args)=>evidence.logs.push({name,args});
  const broker=GuestRpc.createMainBroker(memory,host,sigs,{onError:(name,error)=>evidence.logs.push({name,error:String(error)})});
  broker.publish({tickMs:0});
  let manager,port,lastStats,heldRecord,holding=false;
  const held=[];
  const link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,workerUrl:'/lib/guest-worker.js',
    sharedRenderWorker:true,d3dimGpu:true,d3dimLazySync:lazySync,log:s=>evidence.logs.push(s),
    createRenderEndpoint:async options=>{
      eq(options,{api:'legacy',backend:'webgl'},'production requested WebGL endpoint');
      manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,
        workerUrl:'/lib/d3d-render-worker.js',sourceVersion:'palette-worker-fixture',
        reclaimHeap:head=>raw('d3d_render_adopt_free_list',head)});
      await manager.ready;port=manager.createEndpoint(options);await port.ready;
      port.addEventListener('message',event=>{if(event.data.t==='stats')lastStats=event.data;});
      const post=port.postMessage.bind(port);
      port.postMessage=message=>{
        // Deliberate delay only. Messages, native exports, Encoder shared
        // control, dispatcher and GPU executor are otherwise unmodified.
        if(holding && (message.t==='batch'||held.length))held.push(()=>post(message));
        else post(message);
        if(holding)heldRecord.messages.push(message.t);
      };
      return port;
    }});
  const raw=(name,...args)=>link.callExport(name,...args);
  let stack;
  const call=async(name,...args)=>{await raw('pa_stack',stack);return (await raw(name,...args))>>>0;};
  const alloc=async n=>{const p=(await raw('pa_alloc',n))>>>0;check(p,'allocation');return p;};
  const write=(p,v)=>raw('guest_write32',p,v);
  const read=async p=>(await raw('guest_read32',p))>>>0;
  try{
    await link.start();await raw('pw_init');stack=await alloc(4096)+2048;
    await raw('pa_seed',await alloc(1024));
    const dd=await raw('pa_ddraw'),desc=await alloc(128),out=await alloc(16),entries=await alloc(1024);
    const surface=async(bpp,caps,size=4)=>{
      for(let i=0;i<128;i+=4)await write(desc+i,0);
      for(const [o,v] of [[0,108],[4,0x1007],[8,size],[12,size],[72,32],[76,bpp===8?0x60:0x40],[84,bpp],[104,caps]])await write(desc+o,v);
      if(bpp===32)for(const [o,v] of [[88,0xff0000],[92,0xff00],[96,0xff]])await write(desc+o,v);
      eq(await call('pa_surface',dd,desc,out),0,'CreateSurface');return read(out);
    };
    const texture=await surface(8,0x1000);
    // Retain a real surface as padding: RT clears/readback must not dirty the
    // texture's 4KB watch page merely because both small DIBs share a page.
    await surface(32,0x1000,128);
    const rt=await surface(32,0x2040);
    eq(await call('pa_device',rt,out),0,'CreateDevice');const device=await read(out);
    const rgb=[64,128,192],packed=a=>rgb[0]|rgb[1]<<8|rgb[2]<<16|a<<24;
    for(let i=0;i<256;i++)await write(entries+4*i,packed(255));
    const palette=async caps=>{eq(await call('pa_palette',dd,caps,entries,out),0,'CreatePalette');return read(out);};
    // Keep palette storage away from state/stack/vertex and allocator writes.
    // Retained allocations are deliberate fixture padding, never freed live.
    await alloc(8192);
    const alpha=await palette(0x404),alphaSlot=(await raw('pa_entry',alpha))>>>0;
    const palData=(await raw('pa_palette_data',alpha))>>>0;
    await alloc(8192);
    await raw('pa_bind',device,0,texture);eq(await call('pa_attach',texture,alpha),0,'attach alpha');
    const texDib=await raw('pw_dib',texture),rtDib=await raw('pw_dib',rt),rtEntry=await raw('pa_entry',rt);
    check((texDib>>>12)!==(rtDib>>>12),'texture and RT watch pages are separate');
    evidence.watchLayout={texDib,rtDib,initialAlphaPaletteData:palData};
    const texGuest=await raw('pa_w2g',texDib);
    for(let i=0;i<16;i++)await raw('guest_write8',texGuest+i,7);
    const vertices=await alloc(192),fv=new DataView(new ArrayBuffer(4));
    const float=async(p,v)=>{fv.setFloat32(0,v,true);await write(p,fv.getUint32(0,true));};
    for(const [i,[x,y,u,v]] of [[-.5,-.5,0,0],[3.5,-.5,1,0],[-.5,3.5,0,1],[3.5,-.5,1,0],[3.5,3.5,1,1],[-.5,3.5,0,1]].entries()){
      const p=vertices+i*32;for(const [j,n] of [x,y,.5,1].entries())await float(p+j*4,n);
      await write(p+16,0xffffffff);await write(p+20,0);await float(p+24,u);await float(p+28,v);
    }
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,1],[19,5],[20,6],[28,0],[41,0]])await raw('pa_rs',device,id,v);
    for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[13,3],[14,3],[16,1],[17,1]])await raw('pa_tss',device,0,id,v);
    await raw('pa_tss',device,1,1,1);await raw('set_page_watch_audit',0);
    const clear=async(color=0xff000000,flags=1)=>eq(await raw('pa_clear',rtEntry,flags,color,1,0,0,4,4,0),1,'real clear');
    let drawCount=0;
    const draw=()=>{drawCount++;return raw('pa_draw',device,4,3,vertices,6);};
    const pixel=()=>{const b=new Uint8Array(memory.buffer,rtDib+20,4);return [b[2],b[1],b[0]];};
    const observe=(label,expected)=>{const actual=pixel();eq(actual,expected,label);evidence.observations.push({label,actual});};
    // The production GPU deliberately declines clears until it has drawn on
    // the target. Establish that ownership with a real queued draw and fence.
    await draw();await raw('pw_fence');observe('initial GPU ownership',rgb);
    const barrier=async(label,mutation,expected)=>{
      await clear();const before=new Uint8Array(memory.buffer,palData,1024).slice();
      const ownership=new Uint8Array(memory.buffer,alphaSlot,32).slice();
      const record={label,messages:[]};evidence.barriers.push(record);heldRecord=record;holding=true;
      await draw();await until(()=>held.length>0,'held draw');
      let settled=false;const result=mutation().then(v=>{settled=true;return v;});
      await until(()=>record.messages.includes('legacy-fence'),'actual producer fence');
      check(!settled,'mutation cannot return before drain');
      eq(Array.from(new Uint8Array(memory.buffer,palData,1024)),Array.from(before),'palette unchanged before drain');
      eq(Array.from(new Uint8Array(memory.buffer,alphaSlot,32)),Array.from(ownership),'ownership unchanged before drain');
      record.blockedBeforeDrain=true;holding=false;for(const send of held.splice(0))send();
      const value=await result;record.value=value;observe(label+' old generation',expected);return value;
    };
    eq(await barrier('caller Release',()=>call('pw_release',alpha),rgb),1,'surface retains reference');
    eq(await raw('pw_refs',alpha),1,'attachment survives Release');
    await write(entries,packed(128));
    eq(await barrier('SetEntries',()=>call('pa_entries',alpha,7,1,entries),rgb),0,'entry update');
    await clear();await draw();await raw('pw_fence');observe('new alpha generation blends',[32,64,96]);
    check(await raw('pw_exhaust')>0,'fill unused slots through actual allocator');
    eq(await barrier('final detach',()=>call('pa_attach',texture,0),[32,64,96]),0,'detach');
    eq(await raw('pw_type',alpha),0,'attachment final release retires palette');
    await clear();await draw();await raw('pw_fence');observe('detached grayscale',[7,7,7]);
    await write(entries+7*4,packed(128));
    // Slot reuse does not reuse palette storage: CreatePalette heap-allocates
    // a fresh1024 bytes. Isolate this later allocation too, after pw_exhaust
    // and vertex allocation; the earlier alpha-palette padding cannot do so.
    await alloc(8192);
    const replacement=await palette(4);
    const replacementData=(await raw('pa_palette_data',replacement))>>>0;
    await alloc(8192);
    const deviceEntry=(await raw('pa_entry',device))>>>0;
    // d3ddev_state reads the guest pointer at device entry+16.
    const stateGuest=new DataView(memory.buffer).getUint32(deviceEntry+16,true);
    Object.assign(evidence.watchLayout,{replacementPaletteData:replacementData,
      deviceState:(await raw('guest_to_wasm',stateGuest))>>>0,
      vertices:(await raw('guest_to_wasm',vertices))>>>0,
      stack:(await raw('guest_to_wasm',stack))>>>0});
    eq((await raw('pa_entry',replacement))>>>0,alphaSlot,'natural retired slot reuse');
    eq(await raw('pw_refs',replacement),1,'new slot ownership');
    eq(await call('pa_attach',texture,replacement),0,'ordinary replacement');
    await clear();await draw();await raw('pw_fence');observe('reused ordinary palette ignores peFlags',rgb);

    // Exercise the same real transport with an ordinary keyed palette. All
    // three native indices have identical RGB; only index 7 is a key. Keep
    // these bytes and palette unchanged throughout the mode/cache switches.
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)await raw('guest_write8',texGuest+y*4+x,[7,8,9,9][x]);
    await write(out,7);await write(out+4,7);
    eq(await call('pa_key',texture,out),0,'Worker SetColorKey native index 7');
    const rs=(id,v)=>raw('pa_rs',device,id,v);
    await rs(27,0);await rs(41,1);await rs(144,1);
    // Production fence writes opaque DIB X bytes, not framebuffer alpha.
    // Source alpha is checked by application rejection/blend/stage behavior;
    // the direct GPU fixture separately reads actual framebuffer RGBA.
    evidence.readback='production DIB BGRA with X normalized to 255';
    const opaque=[...rgb,255],zero=[0,0,0,255],background=[17,34,51,255];
    const recordRGBA=(label,expected)=>{
      const actual=[0,1,2].map(x=>{
        const b=new Uint8Array(memory.buffer,rtDib+16+x*4,4);
        return [b[2],b[1],b[0],b[3]];
      });
      // Retain numeric failure evidence before throwing, including alpha.
      evidence.observations.push({label,actual,expected});eq(actual,expected,label);
    };
    const renderRGBA=async(label,expected)=>{
      await clear(0xff112233);await draw();await raw('pw_fence');recordRGBA(label,expected);
    };
    await renderRGBA('Worker explicit key zero RGBA/native duplicate RGB',[zero,opaque,opaque]);
    // Delay only message delivery. Mutate live device state after the real
    // Encoder has copied the draw, then let the production dispatcher replay
    // it. Reading live state instead of the queued snapshot must fail pixels.
    const snapshot=async(label,nextMode,expected)=>{
      await clear(0xff112233);await raw('pw_fence');
      heldRecord={label,messages:[],nextMode};evidence.snapshots.push(heldRecord);holding=true;
      await draw();await until(()=>held.length>0,'held keyed draw');
      await rs(144,nextMode);heldRecord.stateChangedBeforeDrain=true;
      holding=false;for(const send of held.splice(0))send();
      await raw('pw_fence');recordRGBA(label,expected);
    };
    await snapshot('Worker queued TRUE survives live FALSE',0,[zero,opaque,opaque]);
    await renderRGBA('Worker FALSE cache transition legacy rejection',[background,opaque,opaque]);
    await snapshot('Worker queued FALSE survives live TRUE',1,[background,opaque,opaque]);
    await renderRGBA('Worker TRUE cache restore unchanged bytes',[zero,opaque,opaque]);
    await rs(41,0);
    await renderRGBA('Worker state144 alone does not key',[opaque,opaque,opaque]);
    // Rebuild first in legacy mode: stale legacy RGB/zero-alpha must become
    // visible if the subsequent TRUE transition omits keyBlend cache identity.
    await rs(41,1);await rs(144,0);
    await renderRGBA('Worker FALSE primes colored zero-alpha cache',[background,opaque,opaque]);
    await until(()=>lastStats?.stats.drawCalls===drawCount,'FALSE prime stats');
    const uploadsBefore=lastStats.stats.textureUploads;
    // Read-only diagnostics mirror PageLease's published table ABI. Capture
    // both actual lease ranges, not the retired alpha palette's address.
    // No lease generations, decoder, transport or renderer are substituted.
    const watchRoot=(await raw('page_watch_root'))>>>0;
    const watch32=new Uint32Array(memory.buffer),watch64=new BigUint64Array(memory.buffer);
    const watchRange=(address,length)=>{
      const pages=[];
      for(let page=address>>>12;page<=((address+length-1)>>>12);page++){
        const table=Atomics.load(watch32,(watchRoot>>>2)+(page>>>10));
        const cell=table?table+(page&1023)*16:0;
        pages.push({page,cell,refs:cell?Atomics.load(watch32,cell>>>2):0,
          generation:cell?String(Atomics.load(watch64,(cell+8)>>>3)):null});
      }
      return {address,length,pages};
    };
    const diagnostic=phase=>{
      const record={phase,texture:watchRange(texDib,16),palette:watchRange(replacementData,1024),
        poison:Atomics.load(watch32,(watchRoot+2048)>>>2),audit:Atomics.load(watch32,(watchRoot+2052)>>>2)};
      evidence.cacheDiagnostics.phases.push(record);
    };
    evidence.cacheDiagnostics={fixtureIdentity:{texture,texDib,width:4,height:4,pitch:4,bpp:8,
      palette:replacement,paletteData:replacementData,paletteAlpha:0,keyed:1,keyRaw:7,keyBlend:0},phases:[]};
    const pagesOf=(address,length)=>Array.from({length:((address+length-1)>>>12)-(address>>>12)+1},(_,i)=>(address>>>12)+i);
    const palettePages=pagesOf(replacementData,1024);
    evidence.cacheDiagnostics.paletteOverlaps=Object.entries({
      deviceState:[evidence.watchLayout.deviceState,4096],vertices:[evidence.watchLayout.vertices,192],
      stack:[evidence.watchLayout.stack-2048,4096],rt:[rtDib,64],texture:[texDib,16]
    }).filter(([,range])=>pagesOf(...range).some(page=>palettePages.includes(page))).map(([name])=>name);
    diagnostic('before clear');await clear(0xff112233);diagnostic('after clear');
    await draw();diagnostic('after producer draw');await raw('pw_fence');diagnostic('after fence');
    recordRGBA('Worker unchanged FALSE uses cached texture',[background,opaque,opaque]);
    await until(()=>lastStats?.stats.drawCalls===drawCount,'unchanged FALSE stats');
    const first=evidence.cacheDiagnostics.phases[0],last=evidence.cacheDiagnostics.phases.at(-1);
    evidence.cacheDiagnostics.changedRanges=['texture','palette'].filter(name=>
      JSON.stringify(first[name].pages)!==JSON.stringify(last[name].pages));
    evidence.cacheReuse={uploadsBefore,uploadsAfter:lastStats.stats.textureUploads};
    eq(evidence.cacheReuse.uploadsAfter,uploadsBefore,'unchanged FALSE must hit texture cache');
    await rs(144,1);
    await renderRGBA('Worker FALSE to TRUE replaces cached key RGB',[zero,opaque,opaque]);
    await rs(41,1);await rs(15,1);await rs(25,5);await rs(24,0);
    await renderRGBA('Worker application GREATER0 rejects zero alpha',[background,opaque,opaque]);
    await rs(15,0);await rs(27,1);
    await renderRGBA('Worker application blend preserves destination',[background,opaque,opaque]);
    await rs(27,0);
    // SELECTARG2(DIFFUSE) makes stage alpha opaque: application rejection
    // must use stage output, while the keyed sample RGB remains zero.
    await raw('pa_tss',device,0,4,3);await raw('pa_tss',device,0,6,0);await rs(15,1);
    await renderRGBA('Worker opaque stage alpha passes application test',[[0,0,0,255],opaque,opaque]);
    // The near keyed draw and far opaque draw use actual queued geometry.
    // A discarded near fragment must leave depth untouched; a surviving zero
    // alpha fragment (or opaque stage alpha) must occlude the far green draw.
    const geometry=async(z,color)=>{
      for(let i=0;i<6;i++){await float(vertices+i*32+8,z);await write(vertices+i*32+16,color);}
    };
    const depth=async(label,test,stageAlpha,expected)=>{
      await raw('pa_bind',device,0,texture);await raw('pa_tss',device,0,4,stageAlpha);
      await rs(15,test);await clear(0xff112233,3);
      await geometry(.1,0xffffffff);await draw();
      await rs(15,0);await raw('pa_bind',device,0,0);
      await geometry(.5,0xff00ff00);await draw();await raw('pw_fence');
      recordRGBA(label,expected);
    };
    await rs(7,1);await rs(14,1);await rs(23,2);
    await depth('Worker rejected key leaves depth unwritten',1,2,[[0,255,0,255],opaque,opaque]);
    await depth('Worker surviving zero alpha writes depth',0,2,[zero,opaque,opaque]);
    await depth('Worker opaque stage alpha passes test and writes depth',1,3,[[0,0,0,255],opaque,opaque]);
    await rs(7,0);await rs(14,0);await raw('pa_bind',device,0,texture);
    await geometry(.5,0xffffffff);
    await rs(15,0);await raw('pa_tss',device,0,4,2);await rs(41,0);await rs(144,0);
    eq(await call('pw_release',replacement),1,'replacement attachment ownership');
    eq(await call('pa_attach',texture,0),0,'replacement final detach');
    eq(await raw('pw_type',replacement),0,'replacement retired');
    await until(()=>lastStats?.stats.drawCalls>=drawCount,'all GPU draw stats');evidence.stats=lastStats;
    evidence.expectedDrawCalls=drawCount;
    eq(lastStats.stats.drawCalls,drawCount,'every draw used actual GPU');
    eq(lastStats.stats.fallbacks,0,'no renderer fallback');
    eq(lastStats.stats.errors,0,'no GPU errors');
    eq(lastStats.stats.dirtyAuditMisses,0,'no watch misses');
    eq(lastStats.stats.textureByteChecks,0,'actual page leases, no byte shadow');
    check(lastStats.stats.pageChecks>0,'watched textures');
    return evidence;
  }finally{
    holding=false;for(const send of held.splice(0))send();
    // Keep the owning guest instance alive until it has adopted the retired
    // render heap through the production export; then terminate the guest.
    try{if(manager)evidence.retirement=await manager.stop();}finally{await link.stop();}
  }
};
