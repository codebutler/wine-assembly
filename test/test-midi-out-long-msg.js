#!/usr/bin/env node
'use strict';

// The old test invented a handle and required silent SysEx completion.
// The companion lifecycle test executes the production WAT wrapper/stdcall.
const assert = require('assert/strict');
const { createAudioHost } = require('../lib/host-audio');
const memory = new ArrayBuffer(65536), dv = new DataView(memory);
const ctx = { getMemory: () => memory };
const { imports: host } = createAudioHost(ctx, {
  getHost: () => ({}), profileNow: () => 0, profileEvent: () => {},
});
const h = host.midi_out_open(0, 0, 0, 0);
assert(h);
assert.equal(host.midi_header(123, 1024, 1024, 2048, 64, 3), 5);
assert.equal(host.midi_header(h, 0, 0, 0, 64, 3), 11);
assert.equal(host.midi_header(h, 1024, 1024, 2048, 64, 3), 64);
dv.setUint32(1024, 2048, true);
dv.setUint32(1028, 4, true);
new Uint8Array(memory, 2048, 4).set([0xf0, 0x7e, 0x7f, 0xf7]);
assert.equal(host.midi_header(h, 1024, 1024, 2048, 64, 0), 0);
assert.throws(() => host.midi_header(h, 1024, 1024, 2048, 64, 3),
  /SysEx transport unsupported/);
assert.equal(dv.getUint32(1040, true), 2, 'rejected buffer stays prepared, never falsely DONE');
assert.equal(ctx._midiOut.pending.size, 0);
assert.equal(host.midi_out_close(h), 0);
console.log('PASS real MIDI handle/header ownership and explicit unsupported SysEx transport');
