#!/usr/bin/env node

// imagehlp ReBaseImage: MDK2's demo rebases its OpenGL driver file below
// 0x64500000 before loading it and ignores the result. Our opengl32 is built
// in, so the file does not exist: imagehlp answers FALSE with
// ERROR_FILE_NOT_FOUND and leaves the caller's output slots alone. The call is
// stdcall with 11 arguments. Rebasing an image that does exist is not
// implemented and must still stop at the fail-fast stub.

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const extraWat = String.raw`
  (func (export "t_init")
    (global.set $image_base (i32.const 0))
    (global.set $thunk_guest_base (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (func (export "t_rebase") (param $name i32) (param $out i32) (result i32)
    (local $i i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x7e7e7e7e))
    (global.set $last_error (i32.const 0))
    ;; name, symbol path, fReBase, fRebaseSysfileOk, fGoingDown, CheckImageSize,
    ;; then four output pointers into $out and a time stamp.
    (call $gs32 (i32.const ${STACK + 4}) (local.get $name))
    (call $gs32 (i32.const ${STACK + 8}) (i32.const 0))
    (call $gs32 (i32.const ${STACK + 12}) (i32.const 1))
    (call $gs32 (i32.const ${STACK + 16}) (i32.const 1))
    (call $gs32 (i32.const ${STACK + 20}) (i32.const 1))
    (call $gs32 (i32.const ${STACK + 24}) (i32.const 0))
    (block $done (loop $outs
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (call $gs32 (i32.add (i32.const ${STACK + 28}) (i32.shl (local.get $i) (i32.const 2)))
        (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $outs)))
    (call $gs32 (i32.const ${STACK + 44}) (i32.const 0))
    (call $handle_ReBaseImage (local.get $name) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 1) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_last_error") (result i32) (global.get $last_error))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  const vfs = harness.hostCtx.vfs;
  e.t_init();
  const ascii = (p, s) => [...s, '\0'].forEach((c, i) => e.guest_write8(p + i, c.charCodeAt(0)));
  const NAME = 0x1000, OUT = 0x2000;
  const outs = () => [0, 4, 8, 12].map(o => e.guest_read32(OUT + o) >>> 0);

  // MDK2's case: the driver image is not a file.
  ascii(NAME, 'c:\\windows\\system\\opengl32.dll');
  [0x11, 0x22, 0x64500000, 0x44].forEach((v, i) => e.guest_write32(OUT + 4 * i, v));
  assert.strictEqual(e.t_rebase(NAME, OUT), 0, 'a missing image cannot be rebased: FALSE');
  assert.strictEqual(e.t_last_error(), 2, 'with ERROR_FILE_NOT_FOUND');
  assert.deepStrictEqual(outs(), [0x11, 0x22, 0x64500000, 0x44], 'the output slots keep the caller values');
  assert.strictEqual(e.get_esp() >>> 0, STACK + 48, 'stdcall: 11 arguments and the return address are popped');

  assert.strictEqual(e.t_rebase(0, OUT), 0, 'a NULL image name is FALSE');
  assert.strictEqual(e.t_last_error(), 87, 'with ERROR_INVALID_PARAMETER');

  // An image that exists would have to be rewritten on disk: not implemented,
  // so the call stops at the fail-fast stub rather than pretending.
  const h = vfs.createFile('c:\\game\\real.dll', 0xc0000000, 2);
  vfs.writeFile(h, Uint8Array.from([0x4d, 0x5a]), 2);
  vfs.closeHandle ? vfs.closeHandle(h) : harness.host.fs_close_handle(h);
  ascii(NAME, 'c:\\game\\real.dll');
  assert.throws(() => e.t_rebase(NAME, OUT), /unreachable|RuntimeError/,
    'rebasing an existing image is not implemented and traps');

  console.log('PASS  ReBaseImage: a missing image is FALSE/ERROR_FILE_NOT_FOUND; an existing one fails fast');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
