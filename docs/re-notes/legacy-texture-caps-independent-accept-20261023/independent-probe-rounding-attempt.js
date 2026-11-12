const fs=require('fs'),path=require('path'),Module=require('module');
const R='/tmp/legacy-texture-operation-caps-oct23/repo';
const file=path.join(R,'test/test-legacy-texture-operation-caps.js');
const original=fs.readFileSync(file,'utf8');const cut=original.indexOf('\ntry {\n  const f = makeFixture(assembled);');
if(cut<0)throw Error('fixture boundary absent');
const probe=String.raw`
const out={groups:[],controls:[],qualification:receipts.qualification};
const f=makeFixture(assembled);
function bytes(n){return [n>>>24,n>>>16&255,n>>>8&255,n&255];}
function expectedIndependent(t,d,c,a){
 const T=bytes(t),D=bytes(d),X=T.map((v,i)=>Math.round(v*D[i]/255));
 const A=a===2?T[0]:a===3?D[0]:X[0];
 const rgb=(c===2?T:c===3?D:X).slice(1);
 return (A*16777216+rgb[0]*65536+rgb[1]*256+rgb[2])>>>0;
}
const vectors=[0,1,2,63,64,127,128,129,191,192,253,254,255];let count=0;
for(const x of vectors)for(const y of vectors)for(const c of [2,3,4])for(const a of [2,3,4]){
 const t=((x<<24)|((255-x)<<16)|(x<<8)|(x^170))>>>0;
 const d=((y<<24)|((y^85)<<16)|((255-y)<<8)|y)>>>0;
 assert.equal(f.e.d3dim_texture_stage_combine(t,d,c,a)>>>0,expectedIndependent(t,d,c,a));count++;
}
for(let x=0;x<256;x++)for(let y=0;y<256;y++){
 const t=(x*0x01010101)>>>0,d=(y*0x01010101)>>>0;
 assert.equal(f.e.d3dim_texture_stage_combine(t,d,4,4)>>>0,expectedIndependent(t,d,4,4));count++;
}
out.groups.push({name:'independent byte arithmetic and separate RGB/alpha selection',cases:count});
function checkGPU(src){
 for(const c of [2,3,4])for(const a of [2,3,4]){
 const s=gpuDraw(f,c,a,src); assert.equal(s.colorOp,c);assert.equal(s.alphaOp,a);
 assert.equal(s.colorArg1,2);assert.equal(s.colorArg2,0);assert.equal(s.alphaArg1,2);assert.equal(s.alphaArg2,0);
 }
}
checkGPU();out.groups.push({name:'independent actual descriptor/lowering cross product',cases:9});
const gpuSource=fs.readFileSync(path.join(root,'lib/d3dim-gpu.js'),'utf8');
for(const [name,from,to] of [
 ['GPU color operand','colorArg1: 2, colorArg2: 0','colorArg1: 0, colorArg2: 2'],
 ['GPU alpha operand','alphaArg1: 2, alphaArg2: 0','alphaArg1: 0, alphaArg2: 2'],
 ['GPU alpha operation crosswire','alphaOp: op(d.alphaOp)','alphaOp: op(d.colorOp)']]){
 const wrong=gpuSource.replace(from,to);assert.notEqual(wrong,gpuSource);assert.throws(()=>checkGPU(wrong),assert.AssertionError);out.controls.push(name);
}
const baseManifest=JSON.parse(fs.readFileSync(process.env.REVIEW_DIR+'/../legacy-texture-operation-caps-oct23/repo/docs/re-notes/legacy-texture-operation-caps-20261023/baseline-excerpt-manifest.json','utf8'));
const bm=baseManifest.excerpts[0],baseCore=fs.readFileSync(process.env.REVIEW_DIR+'/baseline-core.wat');
const baseForm=baseCore.subarray(bm.startByte,bm.endByteExclusive).toString();
const bf=makeFixture(assembled.replace(forms[0],baseForm));
f.e.d3dim_fill_device_desc7(512);bf.e.d3dim_fill_device_desc7(512);
const can=Buffer.from(f.e.memory.buffer,512,236),old=Buffer.from(bf.e.memory.buffer,512,236);
assert.equal(can.readUInt32LE(180),14);assert.equal(old.readUInt32LE(180),1023);
const changed=[];for(let i=0;i<236;i++)if(can[i]!==old[i])changed.push(i);
assert.deepEqual(changed,[180,181]);for(let i=0;i<236;i++)if(i<180||i>=184)assert.equal(can[i],old[i]);
out.groups.push({name:'executed full descriptor differential',changed,unrelatedIdenticalBytes:232});
for(const mask of [0,6,15,30,1023]){
 const wrong=assembled.replace('(i32.const 0x0000E)', '(i32.const '+mask+')');assert.notEqual(wrong,assembled);
 const mf=makeFixture(wrong);mf.e.d3dim_fill_device_desc7(512);
 assert.throws(()=>assert.equal(mf.dv.getUint32(692,true),14),assert.AssertionError);out.controls.push('independent mask '+mask);
}
for(const a of [2,3,4]){
 f.setOps(1,a);assert.equal(f.e.d3dim_tss_load(4096,0,1),1);assert.equal(f.e.d3dim_bound_texture_entry(1),8192);
 f.softwareOuter();const s=gpuDraw(f,1,a);assert.equal(s.colorOp,4);assert.equal(s.alphaOp,a);
}
out.groups.push({name:'valid COLOROP DISABLE with each enabled alpha path still textured/modulated',cases:3});
// Legal D3DTA_DIFFUSE ARG1 and TEXTURE ARG2 settings. The setter stores
// these but the production WAT descriptor/GPU lowering never reads them.
for(const [type,val] of [[2,0],[3,2],[5,0],[6,2]]){
 f.e.d3dim_set_tss(1,0,type,val);assert.equal(f.e.d3dim_tss_load(4096,0,type),val);
}
const stage=gpuDraw(f,2,2);
out.argumentReproducer={storedColorArg1:f.e.d3dim_tss_load(4096,0,2),storedAlphaArg1:f.e.d3dim_tss_load(4096,0,5),loweredColorArg1:stage.colorArg1,loweredAlphaArg1:stage.alphaArg1,expectedArg1:0,observedArg1:2};
assert.equal(stage.colorArg1,2);assert.equal(stage.alphaArg1,2);
out.finding='legal swapped argument state is ignored; producer checks fixed TEXTURE/DIFFUSE lowering only, not general SELECTARG support';
fs.writeFileSync(process.env.REVIEW_DIR+'/independent-results.json',JSON.stringify(out,null,2)+'\n');
console.log('PASS discriminating probes; retained argument-support counterexample');
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(original.slice(0,cut)+'\n'+probe,file);
