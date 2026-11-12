'use strict';
module.exports = require('./palette-gpu-wat') + String.raw`
  (func (export "pw_init")
    (global.set $image_base (i32.const 0x400000))
    (call $heap_init (i32.const 0x2000000)))
  (func (export "pw_refs") (param $obj i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
  (func (export "pw_type") (param $obj i32) (result i32)
    (i32.load (call $dx_from_this (local.get $obj))))
  (func (export "pw_dib") (param $obj i32) (result i32)
    (load.field DxObject misc1 (call $dx_from_this (local.get $obj))))
  (func (export "pw_release") (param $obj i32) (result i32)
    (call $handle_IDirectDrawPalette_Release (local.get $obj) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "pw_exhaust") (result i32)
    (local $n i32)
    (block $done (loop $fill
      (br_if $done (i32.eqz (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br_if $fill (i32.lt_u (local.get $n) (global.get $DX_MAX)))))
    (local.get $n))
  (func (export "pw_fence") (call $d3dim_worker_fence))
`;
