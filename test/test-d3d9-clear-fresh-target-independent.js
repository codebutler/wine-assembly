'use strict';
// Independent correctness probe: real Device adapter, WebGLBackend.clear,
// bindColorResource and cache. Allocation primitives and GL boundary are mocks.
const assert = require('assert');
const {Device} = require('../lib/d3d9-backend');
const {WebGLBackend} = require('../lib/gpu-backend');
const Clear = require('../lib/render-clear');
const g = Object.create(WebGLBackend.prototype);
const state={depth:1,stencil:0}, clears=[];
g.canvas={width:4,height:4}; g._stateValues=new Map();
g._depthStores=new Map(); g._colorResources=new Map();
g._target=null; g._implicitTarget=null;
g.gl={SCISSOR_TEST:1,COLOR_BUFFER_BIT:2,DEPTH_BUFFER_BIT:4,STENCIL_BUFFER_BIT:8,
  FRAMEBUFFER_COMPLETE:9,NO_ERROR:0,
  clearDepth(z){state.depth=z;},clearStencil(s){state.stencil=s;},
  clear(mask){clears.push({mask,...state});},
  clearColor(){},colorMask(){},depthMask(){},stencilMask(){},
  enable(){},disable(){},scissor(){},bindFramebuffer(){},framebufferRenderbuffer(){},
  checkFramebufferStatus(){return 9;},getError(){return 0;},copyTexSubImage2D(){}};
// Keep actual binding/initialization/cache logic, replacing storage allocation.
g._colorStorage=(width,height)=>({width,height,bytes:64,color:{},framebuffer:{}});
g._depthStorage=(key,width,height,bits)=>{
  const store={width,height,bits,object:{},fresh:true};g._depthStores.set(key,store);return store;
};
g.bindTexture=()=>{};
const color={id:7,width:4,height:4,format:21};
const depth={id:11,width:4,height:4,format:75};
g._colorResources.set(7,{...color,color:{},framebuffer:{},variants:new Map()});
const d=Object.create(Device.prototype);
d.gpu=g;d.colorTargets=new Map([[7,{...color,revision:1}]]);d.depthTargets=new Map();
// Controls separate first-use initialization from a cold cache or existing target.
if(process.argv.includes('--existing-target'))d.bindDepth(depth,color);
// A legitimate preceding frontend clear populates the shared wrapper cache.
if(!process.argv.includes('--cold-cache'))g.clear(null,0,.25,52);
d.clearCommand(structuredClone(Clear.create({color:[0,0,0,0],flags:6,
  depth:.25,stencil:52,colorAttachment:color,depthAttachment:depth},4,4)));
const actual={clears,cacheDepth:g._stateValues.get('clearDepth'),
  cacheStencil:g._stateValues.get('clearStencil')};
console.log(JSON.stringify(actual));
assert.deepStrictEqual(clears.at(-1),{mask:12,depth:.25,stencil:52},
  'first named target clear must preserve requested depth and stencil after initialization');
