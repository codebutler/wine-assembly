#!/usr/bin/env node

'use strict';

// D3D7 stage-0 texture-coordinate generation for vertices the pipeline
// transforms. Giants: Citizen Kabuto's terrain is XYZ|DIFFUSE with no texture
// coordinates: it sets D3DTSS_TEXCOORDINDEX to TCI_CAMERASPACEPOSITION,
// TEXTURETRANSFORMFLAGS to COUNT2 and a planar TEXTURE0 matrix, then
// ProcessVertices into an XYZRHW|DIFFUSE|TEX1 buffer. Nothing generated the
// coordinates, so every ground vertex sampled texel (0,0); and TEXTURE0 itself
// was stored over the composite world*view*projection scratch.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $tg_state (mut i32) (i32.const 0))
  (global $tg_src (mut i32) (i32.const 0))
  (global $tg_dst (mut i32) (i32.const 0))
  (func (export "tg_init")
    (local $sw i32)
    (global.set $tg_state (call $heap_alloc (i32.const 4096)))
    (global.set $tg_src (call $heap_alloc (i32.const 32)))
    (global.set $tg_dst (call $heap_alloc (i32.const 32)))
    (local.set $sw (call $g2w (global.get $tg_state)))
    (call $zero_memory (local.get $sw) (i32.const 4096))
    (call $test_mat4_identity (local.get $sw))
    (call $test_mat4_identity (i32.add (local.get $sw) (i32.const 64)))
    (call $test_mat4_identity (i32.add (local.get $sw) (i32.const 128)))
    (call $test_mat4_identity (i32.add (local.get $sw) (i32.const 192))))
  ;; Store one f32 into the view matrix (+64) or stage 0's texture matrix.
  (func (export "tg_view") (param $i i32) (param $v f32)
    (f32.store (i32.add (call $g2w (global.get $tg_state))
      (i32.add (i32.const 64) (i32.shl (local.get $i) (i32.const 2)))) (local.get $v)))
  (func (export "tg_tex") (param $i i32) (param $v f32)
    (f32.store (i32.add (call $d3dim_tex_matrix (global.get $tg_state) (i32.const 16))
      (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
  (func (export "tg_tex_addr") (param $xtype i32) (result i32)
    (call $d3dim_tex_matrix (global.get $tg_state) (local.get $xtype)))
  (func (export "tg_tss") (param $type i32) (param $v i32)
    (call $gs32 (call $d3dim_tss_addr (global.get $tg_state) (i32.const 0) (local.get $type))
      (local.get $v)))
  (func (export "tg_tss_load") (param $stage i32) (param $type i32) (result i32)
    (call $d3dim_tss_load (global.get $tg_state) (local.get $stage) (local.get $type)))
  ;; A D3DLVERTEX {x,y,z,reserved,colour,specular,tu,tv} through the draw path.
  (func (export "tg_draw") (param $x f32) (param $y f32) (param $z f32)
    (local $s i32)
    (local.set $s (call $g2w (global.get $tg_src)))
    (call $zero_memory (local.get $s) (i32.const 32))
    (f32.store (local.get $s) (local.get $x))
    (f32.store offset=4 (local.get $s) (local.get $y))
    (f32.store offset=8 (local.get $s) (local.get $z))
    (i32.store offset=16 (local.get $s) (i32.const 0xFFFFFFFF))
    (i32.store offset=20 (local.get $s) (i32.const 0xFF000000))
    (f32.store offset=24 (local.get $s) (f32.const 7))
    (f32.store offset=28 (local.get $s) (f32.const 9))
    (call $d3dim_prepare_draw_vertex (global.get $tg_state) (i32.const 2)
      (local.get $s) (call $g2w (global.get $tg_dst))))
  (func (export "tg_u") (result f32) (f32.load offset=24 (call $g2w (global.get $tg_dst))))
  (func (export "tg_v") (result f32) (f32.load offset=28 (call $g2w (global.get $tg_dst))))
`;

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-5, `${msg}: ${a} != ${b}`);

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const TCI = 11, TTFF = 24, CAMERASPACEPOSITION = 0x20000, CAMERASPACENORMAL = 0x10000;
  e.tg_init();
  // View translates z by 10: camera space of (2,4,6) is (2,4,16).
  e.tg_view(14, 10);

  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 7, 'no generation: supplied u');
  near(e.tg_v(), 9, 'no generation: supplied v');

  e.tg_tss(TCI, CAMERASPACEPOSITION);
  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 2, 'camera-space position, no transform: u = x');
  near(e.tg_v(), 4, 'camera-space position, no transform: v = y');

  // TEXTURE0 is its own matrix (identity until set), not slot 3's composite.
  const tex0 = e.tg_tex_addr(16);
  assert.ok(tex0, 'TEXTURE0 has storage');
  assert.strictEqual(e.tg_tex_addr(1), 0, 'WORLD is not a texture matrix');
  assert.strictEqual(e.tg_tex_addr(24), 0, 'TEXTURE7 is the last texture matrix');
  assert.strictEqual(e.tg_tex_addr(23) - e.tg_tex_addr(16), 7 * 64, 'eight matrices');

  // Planar mapping: u = 0.5x + 1, v = 0.25y + 2 (translation in row 3).
  e.tg_tex(0, 0.5); e.tg_tex(5, 0.25); e.tg_tex(12, 1); e.tg_tex(13, 2);
  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 2, 'TTFF disabled: texture matrix not applied (u)');
  e.tg_tss(TTFF, 2);
  assert.strictEqual(e.tg_tss_load(0, TTFF), 2, 'TEXTURETRANSFORMFLAGS reads back');
  assert.strictEqual(e.tg_tss_load(1, TTFF), 0, 'other stages keep their own flags');
  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 2, 'COUNT2: u = 0.5*2 + 1');
  near(e.tg_v(), 3, 'COUNT2: v = 0.25*4 + 2');

  // PROJECTED divides by the last counted element (here v).
  e.tg_tss(TTFF, 0x102);
  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 2 / 3, 'PROJECTED: u / v');
  near(e.tg_v(), 1, 'PROJECTED: v / v');

  // A D3DLVERTEX has no normal: camera-space normal keeps the supplied pair.
  e.tg_tss(TCI, CAMERASPACENORMAL);
  e.tg_draw(2, 4, 6);
  near(e.tg_u(), 7, 'normal generation without a normal: supplied u');

  console.log('PASS  D3D7 camera-space texture-coordinate generation and TEXTURE0..7 storage');
})().catch(error => { console.error(error); process.exit(1); });
