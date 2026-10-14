#!/usr/bin/env node
'use strict';

// DISPDIB is the Video for Windows full-screen DIB driver, and it is not an
// API a program calls: a caller LoadModule()s DISPDIB.DLL and then talks to
// the window class it registers, "DisplayDibWindow". So the emulated surface
// is two recognitions and a wndproc, and all three have to agree or the
// program falls off at a different step each time -- Pitfall (1994) exits with
// "Bad or missing dispdib.dll" when the load is refused and would sit on a
// window that answers nothing if the class were not claimed.
//
// What is deliberately NOT tested here is a fourth private message, because
// there is no evidence for one: the wndproc traps on anything in the private
// range it has not seen, so the first program that needs one names it.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const WM_COPYDATA = 0x004A;
const DISPDIB_SETMODE = 0x400;
const DISPDIB_START = 0x403;
const DISPDIB_STOP = 0x404;
const DISPDIB_CLOSE = 0x402;
// Every send answers a dispdib.h DISPLAYDIB_* code.
const NOERROR = 0, INVALIDDIB = 2;

// $DISPDIB_STATE: hwnd, running, width, height, bpp, palette, available.
const ST_HWND = 0, ST_RUNNING = 4, ST_WIDTH = 8, ST_HEIGHT = 12;
const ST_BPP = 16, ST_PALETTE = 20, ST_AVAILABLE = 24;
const ST_BMI = 28, ST_FB_SIZE = 32, ST_SHOWN = 36;

const extraWat = String.raw`
  (func (export "test_dispdib_is_class") (param $p i32) (result i32)
    (call $dispdib_is_class_name (local.get $p)))
  (func (export "test_dispdib_is_module") (param $p i32) (result i32)
    (call $dispdib_is_module_path (local.get $p)))
  (func (export "test_dispdib_wndproc")
        (param $hwnd i32) (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (call $dispdib_wndproc (local.get $hwnd) (local.get $msg) (local.get $wp) (local.get $lp)))
  (func (export "test_dispdib_popup") (param $hwnd i32) (param $owner i32)
    (call $wnd_table_set (local.get $owner) (i32.const 0x00401000))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DISPDIB))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x80000000)))
    (call $wnd_set_owner (local.get $hwnd) (local.get $owner)))
  (func (export "test_dispdib_present") (call $dispdib_present))
  (func (export "test_dispdib_state") (param $off i32) (result i32)
    (i32.load (i32.add (global.get $DISPDIB_STATE) (local.get $off))))
  (func (export "test_call_LoadModule") (param $path i32) (param $block i32) (param $api i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0))
    (call $handle_LoadModule
      (local.get $path) (local.get $block) (i32.const 0) (i32.const 0) (i32.const 0)
      (call $g2w (local.get $api)))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dispdib_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
`;

async function main() {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  const str = (text) => {
    const ptr = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(ptr + i, text.charCodeAt(i));
    e.guest_write8(ptr + text.length, 0);
    return ptr;
  };
  const state = off => e.test_dispdib_state(off) >>> 0;

  // --- the two recognitions -------------------------------------------------
  // Pitfall builds the path from GetSystemDirectory, so the match has to be on
  // the basename and case-insensitive; a program that asks for another module
  // must still get the ordinary file answer.
  assert.strictEqual(e.test_dispdib_is_module(str('C:\\WINDOWS\\SYSTEM\\DISPDIB.DLL')), 1,
    'the path a caller actually builds is recognized');
  assert.strictEqual(e.test_dispdib_is_module(str('dispdib.dll')), 1,
    'and so is the bare lower-case name');
  assert.strictEqual(e.test_dispdib_is_module(str('C:\\WINDOWS\\SYSTEM\\DDRAW.DLL')), 0,
    'another module is not DISPDIB');

  assert.strictEqual(e.test_dispdib_is_class(str('DisplayDibWindow')), 1,
    'the class name DISPDIB registers is claimed');
  assert.strictEqual(e.test_dispdib_is_class(str('displaydibwindow')), 1,
    'class names are case-insensitive in Windows');
  assert.strictEqual(e.test_dispdib_is_class(str('DisplayDibWindowEx')), 0,
    'a longer name that starts the same is a different class');
  assert.strictEqual(e.test_dispdib_is_class(0x8002), 0,
    'a class atom is not a pointer and must not be dereferenced');

  // --- LoadModule -----------------------------------------------------------
  // Above 32 is "loaded" to every caller; 2 is ERROR_FILE_NOT_FOUND, which is
  // what the file test underneath would still answer for a module that is not
  // on the disk, and DISPDIB never is.
  const api = str('LoadModule');
  const loaded = e.test_call_LoadModule(str('C:\\WINDOWS\\SYSTEM\\DISPDIB.DLL'), 0, api) >>> 0;
  assert.ok(loaded >= 32, `LoadModule(DISPDIB.DLL) answers a module handle, got ${loaded}`);
  assert.strictEqual(e.test_dispdib_esp(), 12,
    'LoadModule pops its two stdcall arguments');
  const missing = e.test_call_LoadModule(str('C:\\WINDOWS\\SYSTEM\\NOSUCH.DLL'), 0, api) >>> 0;
  assert.strictEqual(missing, 2,
    'a module that really is not there still answers ERROR_FILE_NOT_FOUND');

  // --- the mode message -----------------------------------------------------
  // One WM_COPYDATA carries both the mode and the palette: cbData is 0x428,
  // the 0x28-byte BITMAPINFOHEADER plus 256 RGBQUADs.
  const bits = e.guest_alloc(0x428) >>> 0;
  e.guest_write32(bits + 0, 0x28);
  e.guest_write32(bits + 4, 320);
  e.guest_write32(bits + 8, 200);
  e.guest_write16(bits + 12, 1);
  e.guest_write16(bits + 14, 8);
  const cds = e.guest_alloc(12) >>> 0;
  e.guest_write32(cds + 0, DISPDIB_SETMODE);
  e.guest_write32(cds + 4, 0x428);
  e.guest_write32(cds + 8, bits);

  const hwnd = 0x00010009;
  assert.strictEqual(state(ST_AVAILABLE), 0, 'no mode is set before anyone asks for one');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), NOERROR,
    'the mode message is accepted with DISPLAYDIB_NOERROR, which Monster Truck Madness 2 tests for');
  assert.strictEqual(state(ST_HWND), hwnd, 'the display window is remembered');
  assert.strictEqual(state(ST_WIDTH), 320, 'biWidth is read from the header');
  assert.strictEqual(state(ST_HEIGHT), 200, 'and biHeight');
  assert.strictEqual(state(ST_BPP), 8, 'and biBitCount, which is a word, not a dword');
  assert.strictEqual(state(ST_PALETTE), 1,
    'cbData past the header is the palette the same message carries');
  assert.strictEqual(state(ST_AVAILABLE), 1, 'the display is now configured');

  // A header with no palette behind it is still a valid mode; what must not
  // happen is reading 256 RGBQUADs the caller did not send.
  e.guest_write32(cds + 4, 0x28);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), NOERROR,
    'a bare BITMAPINFOHEADER is accepted');
  assert.strictEqual(state(ST_PALETTE), 0, 'and reports no palette with it');

  // Short or absent data is a malformed send, not a mode change.
  e.guest_write32(cds + 4, 8);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), INVALIDDIB,
    'a cbData too small to hold a header is refused');
  e.guest_write32(cds + 4, 0x428);
  e.guest_write32(cds + 8, 0);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), INVALIDDIB,
    'and so is a null lpData');

  // --- start / stop ---------------------------------------------------------
  assert.strictEqual(state(ST_RUNNING), 0, 'the display does not start by itself');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_START, 0, 0), NOERROR,
    '0x403 starts the full-screen display');
  assert.strictEqual(state(ST_RUNNING), 1, 'and the state says so');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_STOP, 0, 0), NOERROR,
    '0x404 stops it again');
  assert.strictEqual(state(ST_RUNNING), 0, 'and takes the state back down');
  e.test_dispdib_wndproc(hwnd, DISPDIB_START, 0, 0);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_CLOSE, 0, 0), NOERROR,
    '0x402 (DDM_CLOSE) leaves the display, which Monster Truck Madness 2 sends on exit');
  assert.strictEqual(state(ST_RUNNING), 0, 'and stops it');

  // An ordinary window message is not part of the protocol and must fall
  // through rather than trap: the window still gets WM_PAINT, WM_DESTROY and
  // the rest from the default dispatch around it.
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, 0x000F /* WM_PAINT */, 0, 0), 0,
    'an ordinary window message is handled by the default path');

  // --- the VGA window ---------------------------------------------------------
  // Real DISPDIB puts the card in mode 13h and a Win9x program writes its
  // frames to linear 0xA0000 itself (Monster Truck Madness 2, rep movsd at
  // 0x543cba). 0x403 maps that window; the presenter shows it through the
  // mode's palette, and only once something has been drawn there.
  e.guest_write32(cds + 4, 0x428);
  e.guest_write32(cds + 8, bits);
  e.guest_write32(bits + 0x28 + 4 * 7, 0x00112233);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), NOERROR, 'mode with a palette');
  const bmi = state(ST_BMI) >>> 0;
  assert.ok(bmi, 'the mode is kept as a BITMAPINFO of its own');
  assert.deepStrictEqual([e.guest_read32(bmi) >>> 0, e.guest_read32(bmi + 4), e.guest_read32(bmi + 8) | 0,
    e.guest_read32(bmi + 0x28 + 4 * 7) >>> 0],
    [0x28, 320, -200, 0x00112233], 'top-down, since 0xA0000 is the top scanline, with the palette');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_START, 0, 0), NOERROR, 'start');
  assert.strictEqual(state(ST_FB_SIZE), 0x10000, 'start maps the 64 KB VGA window');
  // MTM2's header is already top-down: biHeight -200, which is still 200 rows.
  e.guest_write32(bits + 8, -200);
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, WM_COPYDATA, 0, cds), NOERROR, 'a top-down mode');
  assert.strictEqual(e.guest_read32(bmi + 8) | 0, -200, 'stays top-down');
  e.test_dispdib_present();
  assert.strictEqual(state(ST_SHOWN), 0, 'an untouched framebuffer does not cover the screen (Pitfall)');
  e.guest_write32(0xA0000 + 320 * 100, 0x07070707);
  assert.strictEqual(e.guest_read32(0xA0000 + 320 * 100) >>> 0, 0x07070707, '0xA0000 is ordinary memory now');
  e.test_dispdib_present();
  assert.strictEqual(state(ST_SHOWN), 1, 'the first drawn frame shows the display');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_STOP, 0, 0), NOERROR, 'stop');
  assert.strictEqual(state(ST_SHOWN), 0, 'stopping takes the display down');
  assert.strictEqual(e.test_dispdib_wndproc(hwnd, DISPDIB_START, 0, 0), NOERROR, 'start again');
  assert.strictEqual(state(ST_FB_SIZE), 0x10000, 'the window is mapped once');

  // --- input -----------------------------------------------------------------
  // The display hands keyboard and mouse input to its parent: MTM2 focuses it
  // for the race and steers from WM_KEYDOWN in its own view's wndproc.
  const popup = 0x0001000A, owner = 0x0001000B;
  e.test_dispdib_popup(popup, owner);
  const before = e.get_post_queue_count();
  assert.strictEqual(e.test_dispdib_wndproc(popup, 0x0100 /* WM_KEYDOWN */, 0x26, 0x01480001), 0, 'keydown');
  assert.strictEqual(e.get_post_queue_count(), before + 1, 'is passed on');
  const last = e.get_post_queue_count() - 1;
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.post_queue_peek(last, i) >>> 0),
    [owner, 0x0100, 0x26, 0x01480001], 'to the owner, unchanged');

  console.log('test-dispdib-window: ok');
}

main().catch((err) => { console.error(err); process.exit(1); });
