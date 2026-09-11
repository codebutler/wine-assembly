#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $test_psp_cleanup (mut i32) (i32.const 0))

  (func (export "test_create_property_sheet_page") (param $psp i32) (result i32)
    (local $before i32)
    (global.set $esp (call $w2g (region.addr $GUEST_STACK 524288)))
    (local.set $before (global.get $esp))
    (call $handle_CreatePropertySheetPageA
      (local.get $psp) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_psp_cleanup
      (i32.sub (global.get $esp) (local.get $before)))
    (global.get $eax))

  (func (export "test_destroy_property_sheet_page") (param $page i32) (result i32)
    (local $before i32)
    (global.set $esp (call $w2g (region.addr $GUEST_STACK 524288)))
    (local.set $before (global.get $esp))
    (call $handle_DestroyPropertySheetPage
      (local.get $page) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_psp_cleanup
      (i32.sub (global.get $esp) (local.get $before)))
    (global.get $eax))

  (func (export "test_psp_cleanup") (result i32)
    (global.get $test_psp_cleanup))

  (func (export "test_psp_is_live") (param $page i32) (result i32)
    (i32.ne (call $propsheet_page_record (local.get $page)) (i32.const 0)))

  (func (export "test_psp_use_handle_array") (param $pages i32) (param $count i32)
    (global.set $propsheet_pages (local.get $pages))
    (global.set $propsheet_page_count (local.get $count))
    (global.set $propsheet_pages_are_handles (i32.const 1))
    (global.set $propsheet_owns_page_handles (i32.const 0)))

  (func (export "test_psp_use_inline_array") (param $pages i32) (param $count i32)
    (global.set $propsheet_pages (local.get $pages))
    (global.set $propsheet_page_count (local.get $count))
    (global.set $propsheet_pages_are_handles (i32.const 0))
    (global.set $propsheet_owns_page_handles (i32.const 0)))

  (func (export "test_psp_resolve") (param $index i32) (result i32)
    (call $propsheet_resolve_page (local.get $index)))

  (func (export "test_psp_transfer_and_release")
    (global.set $propsheet_owns_page_handles (i32.const 1))
    (call $propsheet_release_page_handles))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(0, 0, 0, 0, 0, 0, 0, 0x1000);

  const allocPage = (size = 40, flags = 0) => {
    // Invalid dwSize values only need the fixed Win98 prefix to be readable;
    // do not ask the fixture allocator for the untrusted claimed extent.
    const bytes = Math.min(Math.max(size, 40), 64);
    const page = e.guest_alloc(bytes) >>> 0;
    for (let offset = 0; offset < bytes; offset += 4) {
      e.guest_write32(page + offset, (0x11000000 + offset) >>> 0);
    }
    e.guest_write32(page, size);
    e.guest_write32(page + 4, flags);
    e.guest_write32(page + 8, 0x00400000);
    e.guest_write32(page + 12, 101);
    e.guest_write32(page + 24, 0x00401234);
    return page;
  };

  assert.strictEqual(e.test_create_property_sheet_page(0), 0,
    'NULL is rejected');
  assert.strictEqual(e.test_psp_cleanup(), 8,
    'CreatePropertySheetPageA pops return address plus one argument');

  for (const size of [0, 39, 4097, 0xFFFFFFFF]) {
    assert.strictEqual(e.test_create_property_sheet_page(allocPage(size)), 0,
      `invalid page size ${size >>> 0} is rejected`);
  }
  assert.strictEqual(e.test_create_property_sheet_page(allocPage(40, 0x10000)), 0,
    'Win98 rejects page flag bits above bit 15');
  assert.strictEqual(e.test_create_property_sheet_page(allocPage(40, 0x80)), 0,
    'callback pages fail explicitly until PSPCB_CREATE/RELEASE is modeled');

  const source = allocPage(48);
  e.guest_write32(source + 28, 0x12345678);
  e.guest_write32(source + 44, 0x89ABCDEF);
  const page1 = e.test_create_property_sheet_page(source) >>> 0;
  assert(page1, 'a valid Win98 PROPSHEETPAGEA produces a handle');
  assert.strictEqual(e.test_psp_is_live(page1), 1);
  assert.notStrictEqual(page1, source,
    'the opaque handle refers to an owned copy, not caller storage');
  assert.deepStrictEqual([0, 4, 8, 12, 24, 28, 44].map(offset =>
    e.guest_read32(page1 + offset) >>> 0),
  [48, 0, 0x00400000, 101, 0x00401234, 0x12345678, 0x89ABCDEF],
  'the complete caller-declared structure is copied');
  e.guest_write32(source + 12, 999);
  e.guest_write32(source + 44, 0);
  assert.strictEqual(e.guest_read32(page1 + 12), 101,
    'later caller mutation cannot alter the owned page');
  assert.strictEqual(e.guest_read32(page1 + 44) >>> 0, 0x89ABCDEF);

  const page2 = e.test_create_property_sheet_page(allocPage(40)) >>> 0;
  assert(page2 && page2 !== page1, 'each call creates a distinct owned page');
  const handles = e.guest_alloc(8) >>> 0;
  e.guest_write32(handles, page1);
  e.guest_write32(handles + 4, page2);
  e.test_psp_use_handle_array(handles, 2);
  assert.strictEqual(e.test_psp_resolve(0) >>> 0, page1,
    'HPROPSHEETPAGE array resolves its first owned page');
  assert.strictEqual(e.test_psp_resolve(1) >>> 0, page2,
    'HPROPSHEETPAGE array resolves its next owned page');
  assert.strictEqual(e.test_psp_resolve(2), 0,
    'page indexes are bounded by nPages');

  e.test_psp_transfer_and_release();
  assert.strictEqual(e.test_psp_is_live(page1), 0,
    'sheet teardown releases the first transferred page');
  assert.strictEqual(e.test_psp_is_live(page2), 0,
    'sheet teardown releases every transferred page');
  assert.strictEqual(e.test_destroy_property_sheet_page(page1), 0,
    'a stale page handle is rejected instead of double-freed');
  assert.strictEqual(e.test_psp_cleanup(), 8,
    'DestroyPropertySheetPage uses the one-argument stdcall frame');

  const foreign = e.guest_alloc(40) >>> 0;
  assert.strictEqual(e.test_destroy_property_sheet_page(foreign), 0,
    'an unrelated heap allocation is not accepted as HPROPSHEETPAGE');

  const inline = e.guest_alloc(80) >>> 0;
  for (let i = 0; i < 2; i++) {
    const p = inline + i * 40;
    e.guest_write32(p, 40);
    e.guest_write32(p + 4, 0);
    e.guest_write32(p + 12, 200 + i);
    e.guest_write32(p + 24, 0x00402000 + i * 0x100);
  }
  e.test_psp_use_inline_array(inline, 2);
  assert.strictEqual(e.test_psp_resolve(0) >>> 0, inline,
    'PSH_PROPSHEETPAGE still resolves the inline first page');
  assert.strictEqual(e.test_psp_resolve(1) >>> 0, inline + 40,
    'inline page addressing uses the declared Win98 structure size');
  e.guest_write32(inline + 40, 44);
  assert.strictEqual(e.test_psp_resolve(1), 0,
    'a malformed inline array member is rejected');

  const apiTable = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'api_table.json'), 'utf8'));
  const destroyApi = apiTable.find(api => api.name === 'DestroyPropertySheetPage');
  assert(destroyApi && destroyApi.nargs === 1,
    'DestroyPropertySheetPage is registered as a one-argument API');

  console.log('PASS  property-sheet pages are copied, validated, consumed, and destroyed');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
