'use strict';
// Task-only observation. Compile JS text at its authentic fixture filename so
// relative dependencies remain exact; never compile or change WebAssembly.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const root=path.resolve(__dirname,'../../..'),file=path.join(root,'test/test-d3d9-positiont-com-qualification.js');
const mode=process.argv[2];assert(['original','focused','noop'].includes(mode));
let src=fs.readFileSync(file,'utf8');
function replace(a,b){assert(src.includes(a),a);src=src.replace(a,b);}
replace('const {exports:e,memory}=await','const {exports:raw,memory}=await');
replace("assert.strictEqual(memory.buffer.byteLength",`const events=[];let phase='setup';
  const emit=(kind,data)=>{assert(events.length<2000,'trace bound');events.push({kind,phase,...data});};
  const e={...raw,
    guest_alloc(n){const p=raw.guest_alloc(n)>>>0;emit('alloc',{requested:n,p,size:p?raw.q_heap_payload(p)>>>0:0});return p;},
    guest_free(p){const before=raw.q_heap_frees()>>>0;raw.guest_free(p);emit('free',{p,before,after:raw.q_heap_frees()>>>0});},
    d3d_render_coalesce_heap(){const result=raw.d3d_render_coalesce_heap();emit('coalesce',{result});return result;}
  };
  const dump=(label,targets)=>{
    const blocks=[];let at=0x01000000;
    for(let i=0;i<4096;i++){
      const size=raw.guest_read32(at)>>>0;if(size<16||(size&7)||size>16*1024*1024)break;
      blocks.push({header:at,payload:at+4,size});at+=size;
      if(at>0x01100000)break;
    }
    emit(label,{targets,blocks:blocks.filter(b=>targets.some(t=>t.guest>=b.header&&t.guest<b.header+b.size))});
  };
  process.on('exit',()=>console.log('TRACE '+JSON.stringify(events)));
  assert.strictEqual(memory.buffer.byteLength`);
replace('e.d3d_fixed_free(p);',`emit('bundle-free-enter',{rows:traces.slice(-5),before:e.q_heap_frees()>>>0});
      ${mode==='noop'?"if(phase==='recovery'){console.log('ARMED no-op-free: recovery bundle not freed');}else e.d3d_fixed_free(p);":"e.d3d_fixed_free(p);"}
      emit('bundle-free-exit',{after:e.q_heap_frees()>>>0});`);
replace("ok('DrawPrimitiveUP',device,4,1,up,48);const recovered=",`phase='recovery';ok('DrawPrimitiveUP',device,4,1,up,48);const recovered=`);
if(mode==='original'){
  replace('const reused=new Set(),maxReuseBytes',"dump('targets-at-original-search',targets);phase='reuse';\n  const reused=new Set(),maxReuseBytes");
}else{
  replace('const targets=[...latest,{guest:descriptor.guest,size:288}].sort((a,b)=>b.size-a.size);',"const targets=[...latest,{guest:descriptor.guest,size:288}].sort((a,b)=>b.size-a.size);dump('targets-at-focused-search',targets);phase='reuse';");
  replace("assert.strictEqual(reuseProof,null,'recovery draw reached copied-packet reuse proof');","assert.strictEqual(reuseProof,null,'recovery draw reached copied-packet reuse proof');console.log('FOCUSED reuse PASS '+JSON.stringify({reused:[...reused],reuseBytes}));process.exit(0);");
}
replace('if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});','');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(src,file);
m.exports.main(process.argv.slice(3)).catch(e=>{console.error(e.stack);process.exitCode=1;});
