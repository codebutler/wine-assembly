#!/usr/bin/env node

// msvcrt reads of a streamed (lazy) file park on IO_WAIT instead of failing.
//
// Dark Reign's demo loads its cursor with _open + _read of mouse.crs. In the
// browser that file is provider-backed, and _read used the BOOL host read,
// which reports a nonresident chunk as a failed read: _read returned -1 and
// the game stopped with "Invalid cursor file [.\dark\graphics\intface\
// mouse.crs]" -- in the browser only, since the CLI mounts files eager. The
// CRT readers (_read, fread, fgets, getc/fgetc) now park the call the way
// ReadFile does and run it again after the host fills the chunk.
//
// The file is a real provider-backed VFS entry with 4-byte chunks and no
// read-ahead or prefetch, so every chunk boundary parks. Each call must
// restore its cdecl frame and point EIP back at its thunk when it parks, pop
// its return address exactly once when it completes, and return exactly the
// bytes of the file -- fgets in particular, which reads a byte at a time and
// has to give back what it took before it parks. Retries run on the frame the
// parked call left: getc reads its byte into its own FILE* slot, and once
// left zeroed by a park the retry was getc(NULL) = EOF (Anno 1602's
// haeuser.cod, ANNO-LAZY-BLACK-20261011).

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bp = require('../lib/byte-provider');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const THUNK = 0x0013579b;
// t_<name> builds the cdecl frame and makes the call. r_<name> is the retry
// after a park: it runs the handler again on the frame exactly as the parked
// call left it, reading its arguments back from the stack the way the thunk
// does -- a real guest never pushes them twice, so a handler that wrote over
// its own argument slot before parking must have put it back.
const call = (name, params) => {
  const args = params.map(p => `(local.get $${p})`);
  while (args.length < 5) args.push('(i32.const 0)');
  const reread = params.map((p, i) => `(call $gl32 (i32.const ${STACK + 4 + 4 * i}))`);
  while (reread.length < 5) reread.push('(i32.const 0)');
  return String.raw`
  (func (export "r_${name}") (result i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x7e7e7e7e))
    (global.set $eip (i32.const 0))
    (global.set $handler_set_eip (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (call $handle_${name} ${reread.join(' ')} (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))` + String.raw`
  (func (export "t_${name}") ${params.map(p => `(param $${p} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x7e7e7e7e))
    (global.set $current_thunk_eip (i32.const ${THUNK}))
    (global.set $eip (i32.const 0))
    (global.set $handler_set_eip (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    ${params.map((p, i) => `(call $gs32 (i32.const ${STACK + 4 + 4 * i}) (local.get $${p}))`).join('\n    ')}
    (call $handle_${name} ${args.join(' ')} (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))`;
};

const extraWat = String.raw`
  (func (export "t_init")
    (global.set $image_base (i32.const 0))
    (global.set $thunk_guest_base (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  ${call('fopen', ['path', 'mode'])}
  ${call('fclose', ['f'])}
  ${call('_open', ['path', 'flags'])}
  ${call('_close', ['fd'])}
  ${call('_read', ['fd', 'buf', 'count'])}
  ${call('getc', ['f'])}
  ${call('fread', ['buf', 'size', 'count', 'f'])}
  ${call('fgets', ['buf', 'n', 'f'])}
  ${call('feof', ['f'])}
`;

const CONTENT = Buffer.from('CRS1\nline two\nxy');
const GUEST = 'c:\\dark\\graphics\\intface\\mouse.crs';

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-crt-lazy-'));
  const hostFile = path.join(tmp, 'mouse.crs');
  fs.writeFileSync(hostFile, CONTENT);

  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  const vfs = harness.hostCtx.vfs;
  e.t_init();
  const provider = bp.cached(new bp.NodeFileProvider(hostFile, { sync: false }),
    { chunkSize: 4, maxChunks: 8, readAhead: 0, prefetch: 0 });
  vfs.ensureParentDirs(GUEST);
  vfs.setProviderFile(GUEST, { provider });

  const ascii = (p, s) => [...s, '\0'].forEach((c, i) => e.guest_write8(p + i, c.charCodeAt(0)));
  const bytes = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i) & 0xff));
  const PATH = 0x1000, MODE = 0x1100, BUF = 0x2000;
  ascii(PATH, GUEST);
  ascii(MODE, 'rb');

  // Run one CRT call to completion the way the host loop does: every park
  // must leave the frame for a retry, and the host fills before the retry.
  let fills = 0;
  const run = async (name, ...args) => {
    for (let parks = 0; ; parks++) {
      assert(parks < 32, `${name} keeps parking`);
      const r = parks ? e[`r_${name}`]() : e[`t_${name}`](...args);
      if (e.get_yield_reason() !== 12) {
        assert.strictEqual(e.get_esp() >>> 0, STACK + 4, `${name} pops its return address exactly once`);
        return { r, parks };
      }
      assert.strictEqual(e.get_esp() >>> 0, STACK, `a parked ${name} leaves its cdecl frame for the retry`);
      assert.strictEqual(e.get_eip() >>> 0, THUNK, `a parked ${name} retries through its thunk`);
      assert(vfs.pendingRead, `a parked ${name} has a pending read for the host to fill`);
      assert.strictEqual(await vfs.fillPendingRead(vfs.pendingRead), true, 'the host fill succeeds');
      fills++;
    }
  };

  // _open + _read: Dark Reign's cursor loader.
  const fd = (await run('_open', PATH, 0x8000)).r;
  assert(fd > 0, '_open of a lazy file returns a descriptor without fetching');
  let out = await run('_read', fd, BUF, 4);
  assert.strictEqual(out.r, 4, '_read returns the byte count once the chunk is in, never -1');
  assert(out.parks >= 1, '_read parked on the nonresident chunk');
  assert.strictEqual(bytes(BUF, 4).toString(), 'CRS1');
  out = await run('_read', fd, BUF, 64);
  assert.strictEqual(out.r, CONTENT.length - 4, 'a read across several chunks returns them all');
  assert.strictEqual(bytes(BUF, out.r).toString(), CONTENT.subarray(4).toString());
  assert.strictEqual((await run('_read', fd, BUF, 4)).r, 0, '_read at end of file is 0');
  assert.strictEqual((await run('_close', fd)).r, 0);

  // A fresh cache, so the FILE* paths park too.
  const provider2 = bp.cached(new bp.NodeFileProvider(hostFile, { sync: false }),
    { chunkSize: 4, maxChunks: 8, readAhead: 0, prefetch: 0 });
  vfs.setProviderFile(GUEST, { provider: provider2 });
  const f = (await run('fopen', PATH, MODE)).r >>> 0;
  assert.notStrictEqual(f, 0, 'fopen of a lazy file succeeds');

  out = await run('getc', f);
  assert.strictEqual(out.r, 0x43, "getc returns 'C' after parking, not EOF");
  assert(out.parks >= 1, 'getc parked');
  out = await run('fread', BUF, 1, 3, f);
  assert.strictEqual(out.r, 3, 'fread returns the full count');
  assert.strictEqual(bytes(BUF, 3).toString(), 'RS1');

  // fgets crosses chunk boundaries one byte at a time: "\n", then "line two\n"
  // spans chunks 1..3. A park in the middle must not lose the bytes before it.
  out = await run('fgets', BUF, 64, f);
  assert.strictEqual(out.r >>> 0, BUF, 'fgets returns its buffer');
  assert.strictEqual(bytes(BUF, 2).toString('latin1'), '\n\0', 'the first line is the bare newline');
  out = await run('fgets', BUF, 64, f);
  assert(out.parks >= 1, 'fgets parked in the middle of a line');
  assert.strictEqual(bytes(BUF, 10).toString('latin1'), 'line two\n\0',
    'a parked fgets gives back the bytes it took, so the retry reads the whole line');
  out = await run('fgets', BUF, 64, f);
  assert.strictEqual(bytes(BUF, 3).toString('latin1'), 'xy\0', 'the last line has no newline');
  assert.notStrictEqual((await run('feof', f)).r, 0, 'and fgets latched _IOEOF at the real end');
  assert.strictEqual((await run('getc', f)).r, -1, 'getc at the real end is EOF');
  assert.strictEqual((await run('fclose', f)).r, 0);
  assert(fills >= 4, `the host filled chunks for the parked calls (${fills})`);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`PASS  msvcrt _read/fread/fgets/getc park on a lazy chunk and retry (${fills} fills)`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
