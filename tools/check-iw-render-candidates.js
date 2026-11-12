#!/usr/bin/env node
'use strict';
// Source-only review: actual fixed lowering and exact backend transformation.
// No GL mock, renderer, WAT build, or claim of pixel/depth/stencil execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const Fixed = require('../lib/d3d9-fixed');
const root = path.resolve(__dirname, '..');
function transformation(source) {
  const start = source.indexOf('      // A colorless fixed-function pass');
  const end = source.indexOf('      // Validate loop domains', start);
  assert(start >= 0 && end > start, 'reviewed transformation boundaries exist');
  return new Function('draw', 'ps', 'guestPS', 'outline', 'fog', 'colorMask',
    source.slice(start, end) + '\nreturn ps;');
}
const candidate = transformation(fs.readFileSync(path.join(root, 'lib/d3d9-backend.js'), 'utf8'));
const held = transformation(execFileSync('git', ['show',
  '1d5243e237ddb27837ee4a3c1c0aa281006468ec:lib/d3d9-backend.js'], {cwd:root, encoding:'utf8'}));
const stage = {colorOp:2, colorArg1:3, colorArg2:3, alphaOp:1, texCoordIndex:0, transformFlags:0};
function draw(s = {}, f = {}, state = {}) {
  return {vertexShader: new Uint32Array([0xfffe0101]), attributes:[], textures:[],
    fixedFunction:{lighting:false, fog:false, specular:false, textureFactor:0xff7f7f7f,
      stages:[{...stage,...s},{colorOp:1}], ...f}, state:{colorWriteMask:7,...state}};
}
function lower(d) { return Fixed.compile(d, {x:0,y:0,width:4,height:4,minZ:0,maxZ:1}).pixel; }
function apply(fn, d, ps = lower(d), guestPS = null, outline = false, fog = {enabled:false}) {
  return fn(d, ps, guestPS, outline, fog, d.state.colorWriteMask);
}
let checks = 0;
function same(d) { const p=lower(d); assert.deepEqual(apply(candidate,d,p),p); checks++; }
for (const colorOp of [2,3,4]) {
  const d=draw({colorOp,colorArg1:2});
  const original=lower(d);
  // The actual compiler terminated the stage. Its entire body is an identity
  // from diffuse to output, with no intervening color assignment or sampling.
  assert.match(original.source, /void main\(\)\{\s*vec4 current = d3d_color0;\s*vec4 temporary = vec4\(0\.0\);\s*gl_FragColor = current;\s*\}/);
  assert.match(apply(held,d,original).source, /vec4 current = vec4\(0\.0\);/);
  assert.deepEqual(apply(candidate,d,original),original);
  checks++;
}
for (const colorOp of [2,3,4]) {
  const d=draw({colorOp});
  assert.match(apply(candidate,d).source,/vec4 current = vec4\(0\.0\);/); checks++;
}
same(draw({}, {}, {colorWriteMask:15}));
for (const factor of [5,6,11]) for (const field of ['srcblend','dstblend'])
  same(draw({}, {}, {blend:true,[field]:factor}));
for (const colorArg1 of [0,1,4,5]) same(draw({colorArg1}));
same(draw({}, {alphaTest:true,alphaFunc:5,alphaRef:128}));
same(draw({}, {specular:true}));
same(draw({}, {stages:[stage,{...stage}]}));
const colorless=draw({}, {}, {colorWriteMask:0});
assert.equal(apply(candidate,colorless).source,'precision highp float; void main(){gl_FragColor=vec4(0.0);}'); checks++;
same(draw({}, {alphaTest:true,alphaFunc:5,alphaRef:128}, {colorWriteMask:0}));
const keyed=draw({colorArg1:2}, {colorKey:true});
keyed.textures=[{width:1,height:1,pixels:new Uint8Array([255,255,255,0])}];
for (const mask of [0,7]) {
  keyed.state.colorWriteMask=mask;
  const p=apply(candidate,keyed);
  assert.match(p.source,/if \(sample0.a < 0.5\) discard;/);
  assert.match(p.source,/texture2D/); checks++;
}
const p=lower(colorless);
assert.deepEqual(apply(candidate,colorless,p,{stage:'pixel'}),p); checks++;
assert.deepEqual(apply(candidate,colorless,p,null,true),p); checks++;
assert.deepEqual(apply(candidate,colorless,p,null,false,{enabled:true}),p); checks++;
// Validate the prepared real-browser fixture without running its browser body.
const web=fs.readFileSync(path.join(root,'test/test-d3d9-stencil-web.js'),'utf8');
const baselineWeb=execFileSync('git',['show',
  '343befcb182f3582a3214df5636c49f1176b435e:test/test-d3d9-stencil-web.js'],{cwd:root,encoding:'utf8'});
const legacyStart=baselineWeb.indexOf('   for(const [func,expected]of [[1,false]');
const legacyEnd=baselineWeb.indexOf('   const error=g.getError()');
assert(legacyStart>=0&&legacyEnd>legacyStart);
assert(web.includes(baselineWeb.slice(legacyStart,legacyEnd)), 'original main stencil oracles preserved byte-for-byte'); checks++;
const fixture=web.match(/const colorVS=new Uint32Array\((\[[\s\S]*?\])\);/);
assert(fixture,'real browser VS fixture exists');
const compiled=require('../lib/d3d9-shader').compile(new Uint32Array(Function('return '+fixture[1])()));
assert.match(compiled.source,/vec4 (result\d+) = \(d3d_vs_c0.xyzw\);\s*d3d_color0.xyzw = \1.xyzw;/); checks++;
assert.match(compiled.source,/vec4 (result\d+) = \(d3d_vs_c1.xyzw\);\s*d3d_tex0.xyzw = \1.xyzw;/); checks++;
console.log(`PASS ${checks} source checks; held missing-texture RGB regression reproduced for SELECTARG1/2/MODULATE; adapted guard retains diffuse. GPU effects untested.`);
