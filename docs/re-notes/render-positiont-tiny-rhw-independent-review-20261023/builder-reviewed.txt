'use strict';
// This module imports no compiler, host, canvas or renderer until an explicit
// build/qualification entry point has passed its input checks.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '../..');
const CANDIDATE = '5427a9e2e7d20984249cadcf67f1cb33cc9d85c0';
const ACCEPTANCE = '6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754';
const pins = require('./positiont-com-source-pins.json');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pinsHash = sha256(JSON.stringify(pins));
const calls = [
  ['CreateDevice', 'IDirect3D9'],
  ...['CreateVertexDeclaration','SetVertexDeclaration','SetStreamSource',
    'CreateVertexBuffer','CreateIndexBuffer','SetIndices','DrawPrimitive',
    'DrawIndexedPrimitive','DrawPrimitiveUP','Clear','Present','SetRenderState',
    'CreateTexture','SetTexture','SetTextureStageState','SetSamplerState','Release']
    .map(n => [n, 'IDirect3DDevice9']),
  ...['Lock','Unlock'].map(n => [`Buffer_${n}`, 'IDirect3DBuffer9', n]),
  ['Buffer_Release','IDirect3DShader9','Release'],
  ...['LockRect','UnlockRect','Release'].map(n => [`Texture_${n}`, 'IDirect3DTexture9', n]),
  ['Declaration_Release', 'IDirect3DShader9', 'Release'],
];
// Same guest-facing stdcall handlers as multi-stream/depth-release tests.
// All arguments, including those past the five register parameters, are on
// the authentic guest stack. No renderer logic or allocator is replaced.
const extraWat = calls.map(([name, type, method = name]) => `
(func (export "q_${name}") ${Array.from({length:9}, (_,i)=>`(param $a${i} i32)`).join(' ')} (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
 ${Array.from({length:9}, (_,i)=>`(call $gs32 (i32.const ${0x07000004+i*4}) (local.get $a${i}))`).join('\n')}
 (call $handle_${type}_${method} ${Array.from({length:5},(_,i)=>`(local.get $a${i})`).join(' ')} (i32.const 0))
 (i32.load (global.get $reg_base)))`).join('\n') + `
(func (export "q_heap_allocs") (result i32) (global.get $heap_stat_allocs))
(func (export "q_heap_frees") (result i32) (global.get $heap_stat_frees))
(func (export "q_heap_payload") (param $p i32) (result i32)
 (call $heap_payload_size_unchecked (local.get $p)))
(func (export "q_w2g") (param $p i32) (result i32) (call $w2g (local.get $p)))
`;
const requiredExports = [
  ...calls.map(([n])=>`q_${n}`), 'q_heap_allocs','q_heap_frees','q_heap_payload','q_w2g',
  'init_dx_com_thunks','heap_init','guest_alloc','guest_free','guest_map_alloc','guest_map_free',
  'guest_to_wasm','guest_read32','guest_write32','d3d_fixed_compile_positiont',
  'd3d_shader_ir_compile','d3d_shader_ir_free','d3d_shader_vm_compile','d3d_shader_vm_free',
  'd3d_fixed_compile','d3d_fixed_compile_vertex','d3d_fixed_compile_pixel','d3d_fixed_free',
  'd3d_fixed_cache_create','d3d_fixed_cache_free','d3d_fixed_compile_cached','d3d_fixed_light_cached',
  'd3d_render_coalesce_heap','d3d_software_samples','d3d_software_allocation_bound',
  'd3d_software_retained_bound','d3d_software_bind_texture_mips','d3d_software_bind_scissor',
  'd3d_software_bind_depth_format','d3d_software_quantize_depth','d3d_software_bind_stencil',
  'd3d_software_clear_stencil','d3d_software_bind_fill','d3d_software_bind_points',
  'd3d_software_create','d3d_software_step','d3d_software_free','d3d_software_cancel',
  'd3d_software_clear','d3d_software_bind_texture','d3d_software_bind_projection',
  'd3d_software_bind_bump','d3d_software_bind_blend','d3d_software_bind_alpha',
];
function verifySources(root = ROOT) {
  for (const [file, expected] of Object.entries(pins)) {
    const bytes = fs.readFileSync(path.join(root,file));
    const actual = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.strictEqual(actual, expected, `candidate source mismatch: ${file}`);
  }
}
function provenance(bytes) {
  return {schema:'positiont-com-diagnostic-v1', candidate:CANDIDATE, acceptance:ACCEPTANCE,
    sourcePinsSha256:pinsHash, extraWatSha256:sha256(extraWat), moduleSha256:sha256(bytes),
    moduleBytes:bytes.length, sourceEntry:'src/main.watx', transform:'append extraWat to 13-exports.wat only',
    tailCalls:true, initialPages:8192, maximumPages:8192, shared:true,
    qualification:'NOT EXECUTED', argv:process.argv, node:process.version};
}
function validateProvenance(p, bytes) {
  const expected = provenance(bytes);
  for (const key of ['schema','candidate','acceptance','sourcePinsSha256','extraWatSha256',
    'moduleSha256','moduleBytes','sourceEntry','transform','tailCalls','initialPages','maximumPages','shared'])
    assert.deepStrictEqual(p[key], expected[key], `provenance mismatch: ${key}`);
  assert(bytes.length >= 8 && bytes.length <= 32*1024*1024, 'module size outside [8,33554432]');
}
function validateExports(module) {
  const names = new Set(WebAssembly.Module.exports(module).filter(e=>e.kind==='function').map(e=>e.name));
  for (const name of requiredExports) assert(names.has(name), `missing diagnostic/native export: ${name}`);
  const imports = WebAssembly.Module.imports(module);
  assert(imports.some(i=>i.module==='host'&&i.name==='memory'&&i.kind==='memory'), 'missing canonical host.memory');
}
function loadPrebuilt(modulePath, provenancePath) {
  assert(modulePath && provenancePath, 'explicit --module and --provenance are mandatory; compilation is disabled');
  assert(fs.statSync(modulePath).size<=32*1024*1024, 'module exceeds 32 MiB read limit');
  assert(fs.statSync(provenancePath).size<=65536, 'provenance exceeds 64 KiB read limit');
  const bytes=fs.readFileSync(modulePath), p=JSON.parse(fs.readFileSync(provenancePath,'utf8'));
  validateProvenance(p,bytes);
  const module=new WebAssembly.Module(bytes);
  validateExports(module);
  verifySources();
  return {module, provenance:p};
}
// A separate future operation, never reached by the fixture or its tests.
// Requires a complete exact-candidate checkout and separately admitted build resources.
function buildDiagnostic(modulePath, provenancePath) {
  assert(modulePath && provenancePath, 'build requires output module and provenance paths');
  assert(!fs.existsSync(modulePath) && !fs.existsSync(provenancePath), 'refuse to overwrite build evidence');
  verifySources();
  const {compileSrcWasm}=require('../compile-src');
  const bytes=compileSrcWasm((file,source)=>file==='13-exports.wat'?`${source}\n${extraWat}`:source,{tailCalls:true});
  assert(bytes.length<=32*1024*1024, 'diagnostic module exceeds 32 MiB');
  validateExports(new WebAssembly.Module(bytes));
  fs.writeFileSync(modulePath,bytes,{flag:'wx'});
  fs.writeFileSync(provenancePath,JSON.stringify(provenance(bytes),null,2)+'\n',{flag:'wx'});
}
module.exports={CANDIDATE,ACCEPTANCE,sha256,pinsHash,extraWat,requiredExports,
  verifySources,provenance,validateProvenance,validateExports,loadPrebuilt,buildDiagnostic};
if(require.main===module) {
  try {
    assert.strictEqual(process.argv[2],'--build-diagnostic',
      'no default compilation; future admitted build requires --build-diagnostic MODULE PROVENANCE');
    assert.strictEqual(process.argv.length,5,'usage: --build-diagnostic MODULE PROVENANCE');
    buildDiagnostic(process.argv[3],process.argv[4]);
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
