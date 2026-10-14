#!/usr/bin/env node

'use strict';

// D3D7 vertex fog for vertices the pipeline transforms (ProcessVertices,
// DrawPrimitive with untransformed vertices): FOGENABLE with FOGTABLEMODE
// NONE and FOGVERTEXMODE LINEAR/EXP/EXP2 puts the fog factor in the specular
// alpha, 255 meaning no fog. We wrote 0 -- 100% fog -- and Giants: Citizen
// Kabuto drew its whole world in the flat fog colour.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $tf_state (mut i32) (i32.const 0))
  (global $tf_tl (mut i32) (i32.const 0))
  (func (export "tf_init")
    (global.set $tf_state (call $heap_alloc (i32.const 1024)))
    (global.set $tf_tl (call $heap_alloc (i32.const 32)))
    (call $zero_memory (call $g2w (global.get $tf_state)) (i32.const 1024)))
  (func (export "tf_rs") (param $rs i32) (param $v i32)
    (i32.store (i32.add (call $g2w (global.get $tf_state))
      (i32.add (i32.const 256) (i32.shl (local.get $rs) (i32.const 2)))) (local.get $v)))
  (func (export "tf_fog") (param $rhw f32) (result i32)
    (f32.store offset=12 (call $g2w (global.get $tf_tl)) (local.get $rhw))
    (call $d3dim_vertex_fog_alpha (global.get $tf_state) (call $g2w (global.get $tf_tl))))
`;

const f32bits = x => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x, true); return b.getInt32(0, true); };

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const FOGENABLE = 28, FOGTABLEMODE = 35, FOGSTART = 36, FOGEND = 37, FOGDENSITY = 38, FOGVERTEXMODE = 140;
  e.tf_init();

  assert.strictEqual(e.tf_fog(1 / 60), 255, 'fog disabled: no fog');
  e.tf_rs(FOGENABLE, 1);
  assert.strictEqual(e.tf_fog(1 / 60), 255, 'FOGVERTEXMODE NONE: no fog');

  // Linear, start 10, end 110: depth 60 is half fogged; nearer is clear,
  // beyond the end is fully fogged.
  e.tf_rs(FOGVERTEXMODE, 3);
  e.tf_rs(FOGSTART, f32bits(10));
  e.tf_rs(FOGEND, f32bits(110));
  assert.strictEqual(e.tf_fog(1 / 60), 128, 'linear midpoint');
  assert.strictEqual(e.tf_fog(1 / 5), 255, 'nearer than FOGSTART');
  assert.strictEqual(e.tf_fog(1 / 500), 0, 'beyond FOGEND');

  // EXP / EXP2 with density 0.01 at depth 100: e^-1 and e^-1.
  e.tf_rs(FOGDENSITY, f32bits(0.01));
  e.tf_rs(FOGVERTEXMODE, 1);
  assert.strictEqual(e.tf_fog(1 / 100), Math.round(Math.exp(-1) * 255), 'EXP');
  e.tf_rs(FOGVERTEXMODE, 2);
  assert.strictEqual(e.tf_fog(1 / 50), Math.round(Math.exp(-0.25) * 255), 'EXP2');

  // Table fog owns the factor: the vertex alpha stays at no fog.
  e.tf_rs(FOGTABLEMODE, 3);
  assert.strictEqual(e.tf_fog(1 / 60), 255, 'table fog: vertex alpha is not the factor');

  console.log('PASS  D3D7 vertex fog factor for pipeline-transformed vertices');
})().catch(error => { console.error(error); process.exit(1); });
