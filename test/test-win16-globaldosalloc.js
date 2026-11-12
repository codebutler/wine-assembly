#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// Call the ordinal dispatcher with real Pascal frames, including DX:AX and
// callee cleanup. No JS allocator model: all observations are production WAT.
const extraWat = String.raw`
  (global $td_stack (mut i32) (i32.const 0))
  (global $td_sel (mut i32) (i32.const 0))
  (func (export "td_init")
    (global.set $image_base (i32.const 0x100000))
    (call $win16_next_seg_set (i32.const 1))
    (global.set $td_sel (call $win16_global_alloc (i32.const 65536)))
    (global.set $td_stack (i32.add (call $win16_far_to_guest (global.get $td_sel) (i32.const 0)) (i32.const 32768))))
  (func (export "td_call") (param $ord i32) (param $arg i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $td_stack))
    (call $gs16 (global.get $td_stack) (i32.const 256))
    (call $gs16 (i32.add (global.get $td_stack) (i32.const 2)) (global.get $td_sel))
    (call $gs32 (i32.add (global.get $td_stack) (i32.const 4)) (local.get $arg))
    (drop (call $win16_kernel (local.get $ord)))
    (i32.or (i32.and (i32.load (global.get $reg_base)) (i32.const 65535))
      (i32.shl (i32.load offset=8 (global.get $reg_base)) (i32.const 16))))
  (func (export "td_cleanup") (result i32)
    (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $td_stack)))
  (func (export "td_base") (param $s i32) (result i32)
    (call $win16_far_to_guest (local.get $s) (i32.const 0)))
  (func (export "td_limit") (param $s i32) (result i32)
    (call $win16_seg_limit (call $win16_sel_to_index (local.get $s))))
  (func (export "td_write") (param $a i32) (param $v i32) (call $gs8 (local.get $a) (local.get $v)))
  (func (export "td_read") (param $a i32) (result i32) (call $gl8 (local.get $a)))
  (func (export "td_galloc") (result i32) (call $win16_global_alloc (i32.const 32)))
  (func (export "td_alias") (param $s i32) (result i32) (call $win16_alias_of (local.get $s)))
  (func (export "td_reserve") (param $a i32) (param $n i32)
    (call $virtual_reserve_record (local.get $a) (local.get $n) (i32.const 4)))
  (func (export "td_release") (param $a i32) (result i32) (call $virtual_map_release (local.get $a)))
  (func (export "td_exhaust_selectors") (result i32)
    (local $old i32) (local.set $old (call $win16_next_seg_get))
    (call $win16_next_seg_set (global.get $WIN16_SEG_MAX)) (local.get $old))
  (func (export "td_restore_selectors") (param $n i32) (call $win16_next_seg_set (local.get $n)))
  (func (export "td_map_full") (param $on i32)
    (i32.store (global.get $VIRTUAL_MAP_STATE)
      (select (global.get $MAX_VIRTUAL_MAPS) (i32.const 0) (local.get $on))))
  (func (export "td_reserves_full") (param $on i32)
    (i32.store offset=16 (global.get $VIRTUAL_MAP_STATE)
      (select (global.get $MAX_VIRTUAL_RESERVES) (i32.const 0) (local.get $on))))
  (func (export "td_reserves") (result i32) (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
  (func (export "td_direct_collision") (result i32)
    (local $r i32)
    (global.set $image_base (i32.const 0x10000))
    (local.set $r (call $win16_dos_alloc (i32.const 16)))
    (global.set $image_base (i32.const 0x100000)) (local.get $r))
  (func (export "td_decode") (param $a i32) (result i32)
    (global.set $code16 (i32.const 0))
    (drop (call $decode_block (local.get $a)))
    (call $page_probe (local.get $a)))
  (func (export "td_probe") (param $a i32) (result i32) (call $page_probe (local.get $a)))
  (func (export "td_realloc") (param $s i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $td_stack))
    (call $gs16 (i32.add (global.get $td_stack) (i32.const 4)) (i32.const 0))
    (call $gs32 (i32.add (global.get $td_stack) (i32.const 6)) (i32.const 64))
    (call $gs16 (i32.add (global.get $td_stack) (i32.const 10)) (local.get $s))
    (drop (call $win16_kernel (i32.const 16))))
  ;; A synthetic live mapping lease exercises the same production refusal as
  ;; a bridge-owned stack. No guest execution occurs with this fixture ledger.
  (func (export "td_lease") (param $a i32) (param $on i32)
    (i32.atomic.store (region.addr $WIN16_PROCESS_ARENA 0) (global.get $WIN16_ARENA))
    (i64.store (call $virtual_map_lease_record (i32.const 0))
      (i64.extend_i32_u (local.get $on)))
    (i32.store offset=8 (call $virtual_map_lease_record (i32.const 0)) (local.get $a))
    (if (i32.eqz (local.get $on))
      (then (i32.atomic.store (region.addr $WIN16_PROCESS_ARENA 0) (i32.const 0)))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.td_init();
  const alloc = n => {
    const r = e.td_call(184, n) >>> 0;
    assert.equal(e.td_cleanup(), 8, 'DWORD Pascal argument plus far return');
    return { r, sel: r & 65535, base: (r >>> 16) * 16 };
  };
  const free = (s, ord = 185) => {
    const r = e.td_call(ord, s) & 65535;
    assert.equal(e.td_cleanup(), 6, 'WORD Pascal argument plus far return');
    return r;
  };
  for (const n of [0, 0x90001, 0xffffffff, 0xfffffff1]) assert.equal(alloc(n).r, 0);
  // No preexisting free arena slots: descriptor exhaustion must not reserve
  // a low-memory extent before failing.
  const next = e.td_exhaust_selectors();
  assert.equal(alloc(16).r, 0);
  e.td_restore_selectors(next);
  assert.equal(e.td_direct_collision(), 0, 'direct image window cannot alias DOS backing');
  e.td_reserves_full(1);
  assert.equal(alloc(16).r, 0);
  e.td_reserves_full(0);
  e.td_map_full(1);
  assert.equal(alloc(16).r, 0, 'commit failure after acquiring selectors rolls back');
  e.td_map_full(0);
  assert.equal(e.td_reserves(), 0, 'failed commit does not leak reservation');
  e.td_reserve(0x10000, 0x10000); // uncommitted memory is also owned
  const a = alloc(17), b = alloc(0x10001);
  assert(a.r && b.r);
  assert(a.base >= 0x20000 && b.base + 0x10010 <= 0xa0000);
  assert.equal(e.td_base(a.sel), a.base);
  assert.equal(e.td_limit(a.sel), 32);
  assert.equal(e.td_base(b.sel + 8), b.base + 65536);
  assert.equal(e.td_limit(b.sel + 8), 16);
  e.td_write(a.base + 16, 0xa5);
  assert.equal(e.td_read(e.td_base(a.sel) + 16), 0xa5);
  e.td_write(b.base + 65536, 0x5a);
  assert.equal(e.td_read(e.td_base(b.sel + 8)), 0x5a);
  e.td_lease(a.base, 1);
  assert.equal(free(a.sel), a.sel, 'leased backing refuses DOSFree');
  assert.equal(free(a.sel, 17), a.sel, 'GlobalFree propagates lease refusal');
  assert.equal(e.td_base(a.sel), a.base);
  assert.equal(e.td_read(a.base + 16), 0xa5, 'failed release preserves bytes and descriptor');
  e.td_lease(a.base, 0);
  for (const s of [0xffff, a.sel - 1, b.sel + 8, e.td_alias(a.sel), e.td_galloc()]) {
    assert.equal(free(s), s, 'foreign/alias/tail/invalid selector cannot free DOS ownership');
  }
  e.td_write(a.base, 0xc3); // RET: decode a real instruction from the DOS page
  assert.notEqual(e.td_decode(a.base), 0, 'low-address decode is cached');
  assert.equal(free(a.sel), 0);
  assert.equal(e.td_probe(a.base), 0, 'free retires decoded low pages, not only high arena slots');
  assert.equal(free(a.sel), a.sel, 'double free fails');
  assert.equal(e.td_read(b.base + 65536), 0x5a, 'adjacent allocation survives release');
  const c = alloc(17);
  assert.equal(c.base, a.base, 'freed conventional extent reused');
  assert.equal(free(c.sel, 17), 0, 'GlobalFree also releases DOS ownership');
  assert.equal(free(b.sel), 0);
  assert.equal(e.td_release(0x10000), 1);
  const whole = alloc(0x90000);
  assert(whole.r, 'all conventional space recovered');
  assert.equal(alloc(1).r, 0, 'finite conventional memory exhaustion');
  assert.equal(free(whole.sel), 0);
  const ordinary = e.td_galloc();
  assert(e.td_base(ordinary) >= 0x100000, 'reused arena descriptor regains ordinary high backing');
  const unsupported = alloc(32);
  assert.throws(() => e.td_realloc(unsupported.sel), WebAssembly.RuntimeError,
    'unsupported DOS realloc must fail loudly before moving backing');
  assert.equal(e.td_base(unsupported.sel), unsupported.base);
  assert.equal(free(unsupported.sel), 0);
  console.log('Win16 GlobalDOSAlloc/GlobalDOSFree: PASS');
})().catch(err => { console.error(err); process.exitCode = 1; });
