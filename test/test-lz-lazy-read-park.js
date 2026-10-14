#!/usr/bin/env node

// LZ32 reads of a streamed (lazy) file park on IO_WAIT instead of failing.
//
// The Trespasser demo opens its level, data\DEMO.SCN, with LZOpenFileA and
// checks a 0x30-byte header with LZRead. In the browser that file is
// provider-backed; LZRead used the BOOL host read, which reports a
// nonresident chunk as a failed read, so it returned -1 and the game said
// "Scene File Invalid." -- in the browser only, since the CLI mounts files
// eager. LZOpenFileA/LZInit read an SZDD header (and body) the same way, and
// a parked header read must not be taken for "not compressed".
//
// The files are real provider-backed VFS entries with 4-byte chunks and no
// read-ahead, so every chunk boundary parks. A parked stdcall call must leave
// its whole frame and point EIP back at its thunk; a completed one pops its
// return address and arguments exactly once.

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bp = require('../lib/byte-provider');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const THUNK = 0x0013579b;
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
  ${call('LZOpenFileA', ['path', 'of', 'style'])}
  ${call('LZSeek', ['h', 'off', 'origin'])}
  ${call('LZRead', ['h', 'buf', 'n'])}
  ${call('LZClose', ['h'])}
`;

// Trespasser's scene header is 0x30 bytes; the file is longer than that.
const PLAIN = Buffer.from('TPASS-SCENE-HEADER-0123456789abcdefghijklmnopqrstuvwxyz-tail');
// An SZDD stream whose LZSS body is all literals: control byte 0xFF, then 8
// literal bytes, repeated.
const EXPANDED = Buffer.from('HELLO LAZY SZDD!');
const SZDD = Buffer.concat([
  Buffer.from([0x53, 0x5A, 0x44, 0x44, 0x88, 0xF0, 0x27, 0x33, 0x41, 0x00]),
  Buffer.from(Uint32Array.of(EXPANDED.length).buffer),
  Buffer.from([0xFF]), EXPANDED.subarray(0, 8),
  Buffer.from([0xFF]), EXPANDED.subarray(8, 16),
]);

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-lz-lazy-'));
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  const vfs = harness.hostCtx.vfs;
  e.t_init();
  const mount = (guest, name, content) => {
    const hostFile = path.join(tmp, name);
    fs.writeFileSync(hostFile, content);
    const provider = bp.cached(new bp.NodeFileProvider(hostFile, { sync: false }),
      { chunkSize: 4, maxChunks: 8, readAhead: 0, prefetch: 0 });
    vfs.ensureParentDirs(guest);
    vfs.setProviderFile(guest, { provider });
  };
  mount('c:\\demo\\data\\demo.scn', 'demo.scn', PLAIN);
  mount('c:\\demo\\data\\packed.sz_', 'packed.sz_', SZDD);

  const ascii = (p, s) => [...s, '\0'].forEach((c, i) => e.guest_write8(p + i, c.charCodeAt(0)));
  const bytes = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i) & 0xff));
  const PATH = 0x1000, PATH2 = 0x1100, OF = 0x1200, BUF = 0x2000;
  ascii(PATH, 'c:\\demo\\data\\DEMO.SCN');
  ascii(PATH2, 'c:\\demo\\data\\packed.sz_');

  let fills = 0;
  const run = async (name, nargs, ...args) => {
    for (let parks = 0; ; parks++) {
      assert(parks < 64, `${name} keeps parking`);
      const r = parks ? e[`r_${name}`]() : e[`t_${name}`](...args);
      if (e.get_yield_reason() !== 12) {
        assert.strictEqual(e.get_esp() >>> 0, STACK + 4 + 4 * nargs,
          `${name} pops its return address and ${nargs} arguments exactly once`);
        return { r: r | 0, parks };
      }
      assert.strictEqual(e.get_esp() >>> 0, STACK, `a parked ${name} leaves its stdcall frame for the retry`);
      assert.strictEqual(e.get_eip() >>> 0, THUNK, `a parked ${name} retries through its thunk`);
      assert(vfs.pendingRead, `a parked ${name} has a pending read for the host to fill`);
      assert.strictEqual(await vfs.fillPendingRead(vfs.pendingRead), true, 'the host fill succeeds');
      fills++;
    }
  };

  // Trespasser's sequence on a plain file.
  const open = await run('LZOpenFileA', 3, PATH, OF, 0);
  assert(open.r !== -1 && (open.r >>> 0) >= 0x410, `a plain file opens as a file handle, not an LZ one (got ${open.r >>> 0})`);
  assert.strictEqual((await run('LZSeek', 3, open.r, 0, 0)).r, 0, 'LZSeek to the start');
  for (let i = 0; i < 0x40; i++) e.guest_write8(BUF + i, 0xcc);
  const read = await run('LZRead', 3, open.r, BUF, 0x30);
  assert(read.parks > 0, 'the header read waits for the streamed bytes');
  assert.strictEqual(read.r, 0x30, 'LZRead returns the 0x30 bytes asked for, not -1');
  assert.deepStrictEqual(bytes(BUF, 0x30), PLAIN.subarray(0, 0x30), 'and they are the file');
  assert.strictEqual(e.guest_read8(BUF + 0x30) & 0xff, 0xcc, 'nothing written past the request');
  await run('LZClose', 1, open.r);

  // An SZDD file whose header and body are streamed still opens expanded.
  const packed = await run('LZOpenFileA', 3, PATH2, OF, 0);
  assert(packed.parks > 0, 'the SZDD header read waits for the streamed bytes');
  assert(packed.r >= 0x400 && packed.r < 0x410, `a compressed file opens as an LZ handle (got ${packed.r >>> 0})`);
  const out = await run('LZRead', 3, packed.r, BUF, 0x40);
  assert.strictEqual(out.r, EXPANDED.length, 'LZRead returns the expanded length');
  assert.deepStrictEqual(bytes(BUF, EXPANDED.length), EXPANDED, 'and the expanded bytes');
  await run('LZClose', 1, packed.r);

  assert(fills > 0, 'the host filled at least one chunk');
  console.log(`PASS test-lz-lazy-read-park (${fills} fills)`);
})().catch(err => { console.error(err); process.exit(1); });
