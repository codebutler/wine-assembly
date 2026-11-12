'use strict';
const assert=require('assert');
const {boot}=require('./test-d3d9-shared-positiont-ir');
const IR=require('../lib/d3d-shader-ir');
const {Device:Software}=require('../lib/d3d9-software-backend');
function solid(rgba,z){
 const data=Float32Array.from([[0,0],[4,0],[0,4]].flatMap(([x,y])=>[x,y,z,1,...rgba,0,0]));
 return {primitive:4,primitiveCount:1,stride:40,vertices:new Uint8Array(data.buffer),
 attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:1,offset:32}],
 viewport:{x:0,y:0,width:4,height:4,minZ:0,maxZ:1},
 textures:[{width:1,height:1,pixels:Uint8Array.from([255,255,255,255]),sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}],
 state:{zenable:true,zwrite:true,zfunc:2,blend:false,cull:1,fillMode:3,colorWriteMask:15},
 fixedFunction:{lighting:false,fog:false,specular:false,alphaTest:false,colorKey:false,textureFactor:0xffffffff,stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,constant:0xffffffff,transformFlags:0,texCoordIndex:0,resultArg:1},{colorOp:1}]}};
}
const native=(s,e,m)=>IR.fixedPositionT(()=>e,()=>m.buffer,s);
const pixel=d=>Array.from(d.present().pixels.slice(20,24));
(async()=>{
 const {e,memory}=await boot();
 const options={getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024};
 const d=new Software(options),legacy=new Software(options);
 let depthAllocations=0,depthCompiles=0;
 const depthProducer={...e,guest_alloc(n){depthAllocations++;return e.guest_alloc(n);},
 d3d_fixed_compile_positiont(p){depthCompiles++;return e.d3d_fixed_compile_positiont(p);}};
 // Admission must preserve observable pixels, including finite RHW whose
 // reciprocal overflows f32. Check pixels before admission assertions so the
 // exact previous producer fails for its black frame, not for a new policy.
 const numericalCases=[
  ['ordinary',[1,1,1],true],['finite reciprocal overflow',[1e-39,1e-39,1e-39],false],
  ['lower bound',[2**-16,2**-16,2**-16],true],['upper bound',[2**16,2**16,2**16],true],
  ['below bound',[2**-17,2**-17,2**-17],false],['above bound',[2**17,2**17,2**17],false],
  ['unequal bounds',[2**-16,1,2**16],true],['unequal unsafe',[1,1e-39,.25],false],
  ['nonbinary reciprocal',[1,1.5,.25],false],['large finite',[3e38,3e38,3e38],false]
 ];
 for(const [name,rhws,admitted] of numericalCases){
  // Exact review fixture: FLOAT4 position/diffuse, FLOAT2 zero UV, stride40.
  const input=solid([1,0,0,1],.5),v=new DataView(input.vertices.buffer);
  for(let i=0;i<3;i++)v.setFloat32(i*input.stride+12,rhws[i],true);
  const before=[depthAllocations,depthCompiles];input.nativeFixed=native(input,depthProducer,memory);
  d.clear([0,0,0,1],3,1);legacy.clear([0,0,0,1],3,1);
  assert.strictEqual(d.draw(input),1);const fallback={...input};delete fallback.nativeFixed;
  assert.strictEqual(legacy.draw(fallback),1);
  assert.deepStrictEqual(pixel(legacy),[0,0,255,255],name+' established nonblack pixel');
  assert.deepStrictEqual(pixel(d),[0,0,255,255],name+' ordinary route nonblack pixel');
  assert.strictEqual(Array.from(d.present().pixels).filter((x,i)=>i%4===2&&x===255).length,10,name+' red coverage');
  assert.deepStrictEqual(d.present().pixels,legacy.present().pixels,name+' full framebuffer equality');
  assert.strictEqual(!!input.nativeFixed,admitted,name+' admission');
  assert.deepStrictEqual([depthAllocations,depthCompiles],before.map(n=>n+Number(admitted)),name+' before descriptor allocation');
  console.log(JSON.stringify({name,rhws,admitted,pixel:pixel(d),redPixels:10,framebufferEqual:true}));
 }
 // Nonfinite/unsafe coordinates, viewport conversions, loss of subnormal
 // depth and finite screen-coordinate cancellation must reject preallocation.
 const numericalRejects=[];
 for(const value of [0,-1,NaN,Infinity,-Infinity,1e-45,1e-38])
  numericalRejects.push([`RHW ${value}`,s=>new DataView(s.vertices.buffer).setFloat32(12,value,true)]);
 for(const value of [NaN,Infinity,-Infinity,3e38,-3e38,-1,5,1e-39])
  for(const component of [0,4])numericalRejects.push([`coordinate ${component} ${value}`,s=>new DataView(s.vertices.buffer).setFloat32(component,value,true)]);
 numericalRejects.push(['depth underflow',s=>{const v=new DataView(s.vertices.buffer);v.setFloat32(8,1e-45,true);v.setFloat32(12,2**16,true);}]);
 // Adjacent f32 values and a finite non-power-of-two viewport/position
 // exercise the exact supported boundary and reconstruction cancellation.
 for(const bits of [0x377fffff,0x37800001,0x477fffff,0x47800001])
  numericalRejects.push([`adjacent RHW bits ${bits.toString(16)}`,s=>new DataView(s.vertices.buffer).setUint32(12,bits,true)]);
 numericalRejects.push(['finite fractional cancellation',s=>new DataView(s.vertices.buffer).setFloat32(0,.1,true)]);
 numericalRejects.push(['zero width',s=>s.viewport.width=0],['zero height',s=>s.viewport.height=0]);
 for(const field of ['x','y','width','height'])for(const value of [NaN,Infinity,-1,.5,2049])
  numericalRejects.push([`viewport ${field} ${value}`,s=>s.viewport[field]=value]);
 for(const [name,edit] of numericalRejects){
  const input=solid([1,0,0,1],.5);edit(input);const before=[depthAllocations,depthCompiles];
  assert.strictEqual(native(input,depthProducer,memory),null,name);
  assert.deepStrictEqual([depthAllocations,depthCompiles],before,name+' no descriptor allocation');
 }
 console.log('PASS numerical admission: '+numericalCases.length+' nonblack/fullframe controls, '+numericalRejects.length+' preallocation rejects');
 d.destroy();legacy.destroy();
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
