#!/usr/bin/env node
'use strict';
// Error-code regression plus bounded diagnostic, NOT empty-drive conformance.
// No invented TOC/media or mocked MCI success. Compile the actual A/W handlers
// against actual host imports; g2w/gs8 use a small identity-mapped test arena.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseSource } = require('../tools/watx');
const { compileClosure } = require('../tools/watx-closure');
const { createAudioHost } = require('../lib/host-audio');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/09a3-handlers-audio.wat'), 'utf8');
const names = ['$mci_slot_addr', '$mci_alloc_slot', '$handle_mciSendCommandA',
  '$handle_mciSendCommandW', '$handle_mciGetErrorStringA'];
const render = n => Array.isArray(n) ? `(${n.slice(1).map(render).join(' ')})` : n;
const forms = parseSource(source, 'audio.wat').filter(n => n[1] === 'func' && names.includes(n[2]));
assert.equal(forms.length, names.length);
const compiled = compileClosure({ source: `
  (import "host" "memory" (memory 1))
  (import "host" "mci_open" (func $host_mci_open (param i32 i32 i32) (result i32)))
  (import "host" "mci_open_w" (func $host_mci_open_w (param i32 i32 i32) (result i32)))
  (import "host" "mci_command" (func $host_mci_command (param i32 i32 i32 i32) (result i32)))
  (global $reg_base i32 (i32.const 0))
  (global $MCI_DEVICE_TABLE i32 (i32.const 256))
  (func $g2w (param $p i32) (result i32) (local.get $p))
  (func $gs8 (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
  ${forms.map(render).join('\n')}
  ${names.slice(2).map(n => `(export "${n.slice(8)}" (func ${n}))`).join('\n')}
`, vfs: new Map() }, { tailCalls: true });
assert(compiled.success, compiled.error);
const mod = new WebAssembly.Module(compiled.wasmBinary);
function fixture(vfs) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const u8 = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const read = (p, wide = false) => {
    let s = '';
    for (; p && dv.getUint8(p); p += wide ? 2 : 1)
      s += String.fromCharCode(wide ? dv.getUint16(p, true) : dv.getUint8(p));
    return s;
  };
  const put = (p, s, wide = false) => {
    for (let i = 0; i <= s.length; i++)
      wide ? dv.setUint16(p + i * 2, s.charCodeAt(i) || 0, true)
        : dv.setUint8(p + i, s.charCodeAt(i) || 0);
  };
  const ctx = { vfs, getMemory: () => memory.buffer, sharedAudio: {}, sharedMixer: {} };
  const { imports } = createAudioHost(ctx, {
    readStr: p => read(p), readStrW: p => read(p, true),
    readVfsFile: () => null, profileNow: () => 0, profileEvent: () => {},
    getHost: () => imports,
  });
  const x = new WebAssembly.Instance(mod, { host: { memory, ...imports } }).exports;
  function call(wide, id, command, flags, params) {
    dv.setUint32(0, 0xcccccccc, true);
    dv.setUint32(16, 4096, true);
    x[wide ? 'mciSendCommandW' : 'mciSendCommandA'](id, command, flags, params, 0, 0);
    assert.equal(dv.getUint32(16, true), 4116, 'actual stdcall cleanup');
    return dv.getUint32(0, true);
  }
  return { ctx, imports, x, dv, u8, put, call };
}
const rows = [];
for (const topology of ['no-drive', 'empty-disc-map', 'drive-type-only']) {
  const vfs = topology === 'no-drive' ? {} : topology === 'empty-disc-map'
    ? { cdAudioDrives: new Map() } : { driveTypes: new Map([['d', 5]]) };
  const f = fixture(vfs);
  for (const wide of [false, true]) {
    for (const numeric of [false, true]) {
      f.put(1024, 'cdaudio', wide);
      f.dv.setUint32(2052, 0xa5a5a5a5, true);
      f.dv.setUint32(2056, numeric ? 516 : 1024, true);
      f.dv.setUint32(2060, 0, true);
      const error = f.call(wide, 0, 0x803, numeric ? 0x3000 : 0x2000, 2048);
      assert.notEqual(error, 0, 'absent backing must not silently succeed');
      assert.equal(f.dv.getUint32(2052, true), 0xa5a5a5a5, 'no invented device ID');
      assert(f.u8.slice(256, 512).every(v => v === 0), 'no slot allocation');
      assert.equal(f.ctx._mci.devices.size, 0);
      rows.push({ topology, wide, numeric, openError: error });
    }
  }
  f.put(1024, 'open cdaudio alias cd');
  const stringError = f.imports.mci_string(1024, 0, 0);
  assert.equal(stringError, 0x114, 'MCIERR_DEVICE_NOT_READY = MCIERR_BASE + 20');
  assert.equal(f.ctx._mci.aliases.size, 0, 'failed string open installs no alias');
  const statuses = [];
  // These are INVALID-ID controls, not successful empty-drive status results.
  for (const id of [0, 1, 16, 0xffffffff]) {
    for (const item of [5, 7, 3]) { // MEDIA_PRESENT, READY, NUMBER_OF_TRACKS
      f.dv.setUint32(2052, 0xa5a5a5a5, true);
      f.dv.setUint32(2056, item, true);
      const error = f.call(false, id, 0x814, 0x100, 2048);
      assert.equal(error, 0x101, 'MCIERR_INVALID_DEVICE_ID = MCIERR_BASE + 1');
      assert.equal(f.dv.getUint32(2052, true), 0xa5a5a5a5);
      statuses.push({ id, item, error });
    }
    assert.equal(f.call(false, id, 0x806, 0, 0), 0x101, 'invalid play must fail');
    assert.equal(f.call(false, id, 0x804, 0, 0), 0x101, 'invalid close must fail');
    assert.equal(f.call(true, id, 0x814, 0x100, 2048), 0x101, 'wide invalid status');
    assert.equal(f.imports.mci_command(id, 0x814, 0x100, 2048), 0x101,
      'host boundary must return the same INVALID_DEVICE_ID');
  }
  f.u8.fill(0xa5, 3072, 3104);
  f.dv.setUint32(16, 4096, true);
  f.x.mciGetErrorStringA(rows.at(-1).openError, 3073, 30, 0, 0, 0);
  assert.equal(f.dv.getUint32(16, true), 4112);
  assert.equal(f.u8[3072], 0xa5);
  assert.equal(f.u8[3103], 0xa5);
  rows.push({ topology, stringError, statuses,
    errorTextReturned: f.dv.getUint32(0, true), errorTextFirstByte: f.u8[3073] });
}
console.log(JSON.stringify({
  kind: 'error-regression-and-diagnostic', sourceSHA256: crypto.createHash('sha256').update(source).digest('hex'),
  moduleSHA256: crypto.createHash('sha256').update(compiled.wasmBinary).digest('hex'),
  rows, conclusion: 'No media/device invented. Empty-drive conformance and Messiah causal trace unresolved.',
}, null, 2));
