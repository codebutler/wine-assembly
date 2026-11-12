'use strict';
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');

const MENU = Object.freeze({width:640, height:480, x:344, y:212,
  startGameBounds:Object.freeze([269,194,417,232]),
  title:'Enigma - Main Menu',
  pngSHA256:'8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5'});

// Control eval uses new Function, so runner-private presentForRead/dxPresentHook
// are NOT in scope. Only the canonical png command reaches that boundary.
function arm(key,filename) {
  return `(()=>{
    const k=Symbol.for(${JSON.stringify(key)});
    if(process.getBuiltinModule('fs').existsSync(${JSON.stringify(filename)}))
      throw Error('PNG output already exists; no click');
    if(globalThis[k]) throw Error('presentation observer already armed');
    if(!renderer || !renderer.canvas || typeof renderer.repaint!=='function')
      throw Error('missing repaint hook; no click');
    const original=renderer.repaint, state={original,count:0,batch:tickState.batch};
    state.wrapper=function(...args){state.count++;return original.apply(this,args)};
    Object.defineProperty(state.wrapper,k,{value:state});
    globalThis[k]=state; renderer.repaint=state.wrapper;
    return {batch:tickState.batch};
  })()`;
}
function cleanup(key, abort=false) {
  return `(()=>{const k=Symbol.for(${JSON.stringify(key)}),s=globalThis[k];
    // The wrapper carries a second, immutable ownership reference. Losing or
    // replacing the global witness must reject, but must not strand our hook.
    const current=renderer.repaint, owned=current && current[k];
    const intact=owned && owned.wrapper===current && current[k]===owned;
    if(intact && (${abort} || s!==owned || s.count!==1)) renderer.repaint=owned.original;
    const valid=s && intact && s===owned && s.count===1;
    if(${abort} || !valid) delete globalThis[k];
    else s.prepared=true;
    if(!valid) throw Error('presentation observer ownership lost; no click');
    return true;
  })()`;
}

// Insert only in the runner-owned handleControlCommand lexical scope. new
// Function/eval cannot see controlFrozen, credits, recorder or scheduledInput.
// This synchronous branch has no await or guest execution between validation
// and one splice. It cannot be emulated by successive remote snapshots.
const ATOMIC_ACTION='enigma-presented-click-v1';
const ATOMIC_BRANCH=`
    if (cmd.action === '${ATOMIC_ACTION}') {
      const k=Symbol.for(cmd.key), s=globalThis[k];
      try {
        if (!s || !s.prepared || s.wrapper[k]!==s || s.count!==1 ||
            renderer.repaint!==s.wrapper || tickState.batch!==s.batch ||
            cmd.batch!==s.batch || !controlFrozen || controlRunCredits!==0 || videoRecorder)
          throw Error('invalidated presented-menu transaction; no click');
        // Parse the one constant ordinary click with the canonical parser.
        const evs=parseInputEntries([String(s.batch)+':click:344:212']);
        if(evs.length!==1 || evs[0].action!=='click') throw Error('invalid click parser');
        let at=scheduledInput.findIndex(e=>e.batch>s.batch);
        if(at<0) at=scheduledInput.length;
        renderer.repaint=s.original;
        delete globalThis[k]; // consume before enqueue: repeated requests reject
        scheduledInput.splice(at,0,...evs);
        return {queued:true,batch:s.batch};
      } finally {
        // Also recover a lost/replaced global witness from our current wrapper.
        // Never overwrite another owner's replacement repaint function.
        const current=renderer.repaint, owned=current && current[k];
        if(owned && owned.wrapper===current && current[k]===owned)
          renderer.repaint=owned.original;
        delete globalThis[k];
      }
    }
`;
function wireRunner(source) {
  // Exact source identity and exact single insertion point; never mutate the
  // canonical runner on disk. Caller writes a separately named derivative.
  // Pin the tracked candidate/current-main blob 4b8461338f4bcddde6b5d5504991523b28d3ac35;
  // historical donor bytes are not interchangeable with this runner.
  const crypto=require('node:crypto');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
    '87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7',
    'runner source identity mismatch');
  const marker="    if (cmd.action === 'eval') return controlEval(cmd.code || '');";
  assert.equal(source.split(marker).length,2,'runner insertion point mismatch');
  return source.replace(marker,ATOMIC_BRANCH+marker);
}
function readback(key, filename) {
  return `(()=>{
    const s=globalThis[Symbol.for(${JSON.stringify(key)})];
    if(!s || renderer.repaint!==s.wrapper || s.count!==1)
      throw Error('canonical presentation hook not observed exactly once; no click');
    if(tickState.batch!==s.batch) throw Error('batch changed during readback; no click');
    const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');
    const file=${JSON.stringify(filename)},stat=fs.statSync(file);
    if(!stat.isFile() || stat.size<33 || stat.size>2097152) throw Error('invalid PNG size; no click');
    const b=fs.readFileSync(file);
    if(b.length!==stat.size || b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' ||
       b.readUInt32BE(8)!==13 || b.toString('ascii',12,16)!=='IHDR')
      throw Error('invalid PNG readback; no click');
    return {batch:tickState.batch, width:b.readUInt32BE(16),height:b.readUInt32BE(20),
      canvasWidth:renderer.canvas.width,canvasHeight:renderer.canvas.height,
      bytes:b.length,pngSHA256:crypto.createHash('sha256').update(b).digest('hex')};
  })()`;
}

// ask(command) must return the runner's {ok,value} envelope, throwing on HTTP,
// decode or read errors. Use one exclusive control client on a --frozen runner
// with no outstanding step credits; allocate a fresh absolute PNG output path.
// This factory is one-shot even after failure: retries need a new assignment.
function createController(ask, filename) {
  assert.equal(typeof ask,'function');
  assert.equal(typeof filename,'string');
  assert(filename.startsWith('/') && filename.endsWith('.png'), 'absolute PNG path required');
  let used=false;
  return async function clickInspectedMenu() {
    assert(!used,'controller already consumed'); used=true;
    const key='wine.enigma.presented-menu.'+randomUUID();
    let dispatched=false;
    const send=async command=>{
      const response=await ask(command);
      assert(response && response.ok===true,'control readback error; no click');
      assert(Object.hasOwn(response,'value'),'missing control value; no click');
      return response.value;
    };
    try {
      const snapshot=await send({action:'snapshot'});
      assert(snapshot.frozen?.frozen===true && snapshot.frozen.credits===0 &&
        snapshot.frozen.recording===false,'runner must be frozen and idle; no click');
      const batch=snapshot.batch;
      assert(Number.isSafeInteger(batch),'invalid batch; no click');
      assert(snapshot.windows?.some(w=>w.title===MENU.title),'unexpected before title; no click');
      let observed;
      // Cleanup is attempted even if arming only partially succeeds or PNG fails.
      try {
        const armed=await send({action:'eval',code:arm(key,filename)});
        assert.equal(armed.batch,batch,'batch changed before presentation; no click');
        const png=await send({action:'png',path:filename});
        assert(png.frozen===true && png.batch===batch && png.path===filename,
          'invalid canonical PNG transaction; no click');
        observed=await send({action:'eval',code:readback(key,filename)});
        assert.equal(observed.batch,batch,'batch changed after presentation; no click');
        assert.equal(observed.bytes,png.bytes,'PNG readback byte count changed; no click');
        assert(observed.width===MENU.width && observed.height===MENU.height &&
          observed.canvasWidth===MENU.width && observed.canvasHeight===MENU.height,
          'wrong framebuffer dimensions; no click');
        assert(Number.isInteger(MENU.x) && Number.isInteger(MENU.y) &&
          MENU.x>=0 && MENU.x<observed.width && MENU.y>=0 && MENU.y<observed.height,
          'click outside framebuffer; no click');
        const [left,top,right,bottom]=MENU.startGameBounds;
        assert(MENU.x>=left && MENU.x<right && MENU.y>=top && MENU.y<bottom,
          'click outside inspected Start Game bounds; no click');
        assert.equal(observed.pngSHA256,MENU.pngSHA256,
          'before framebuffer differs from inspected menu; no click');
      } catch(error) {
        try { await send({action:'eval',code:cleanup(key,true)}); } catch(_) {}
        throw error;
      }
      try {
        assert.equal(await send({action:'eval',code:cleanup(key)}),true,'observer cleanup failed; no click');
      // Atomic runner-owned validation and enqueue; stock runners reject the
      // unknown action without input. Cleanup transport ambiguity never retries
      // this operation. The controller remains consumed even on a lost reply.
      // Once ask is invoked, a lost/invalid response cannot establish whether
      // enqueue happened. Do not use the pre-dispatch no-click diagnostics here.
      dispatched=true;
      const response=await ask({action:ATOMIC_ACTION,key,batch});
      assert(response && response.ok===true && Object.hasOwn(response,'value'),
        'atomic response unavailable');
      const queued=response.value;
      assert(queued && queued.queued===true && queued.batch===batch,
        'click queue acknowledgement invalid');
      } catch(error) {
        try { await send({action:'eval',code:cleanup(key,true)}); } catch(_) {}
        throw error;
      }
      return {enqueueOutcome:'acknowledged',safety:observed,click:{x:MENU.x,y:MENU.y,batch,queued:true}};
    } catch(cause) {
      if(dispatched) {
        const error=new Error('enqueue outcome unknown; controller consumed; do not retry', {cause});
        error.code='ENIGMA_ENQUEUE_OUTCOME_UNKNOWN';
        error.enqueueOutcome='unknown';
        throw error;
      }
      cause.code='ENIGMA_NOT_DISPATCHED';
      cause.enqueueOutcome='not-dispatched';
      throw cause;
    }
  };
}
module.exports={MENU,createController,ATOMIC_ACTION,ATOMIC_BRANCH,wireRunner};
