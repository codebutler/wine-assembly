#!/usr/bin/env node
// Regression coverage for MCI compound device elements: "sequencer!file".
//
// Windows MCI lets an open pack the device type and the element file into
// one string, split at the first '!'. RichMan 4 opens all of its music as
// "sequencer!MIDI01.MID" through mciSendStringA; the host used to treat
// the whole string as a filename, read nothing back, parse zero notes and
// play silence (sound effects, a different path, kept working). This test
// pins the split for both open paths (command string and mci_open), and
// pins that ordinary filenames — including ones whose '!' prefix is not a
// device type — pass through untouched.

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');

const mem = new WebAssembly.Memory({ initial: 2 });
const u8 = new Uint8Array(mem.buffer);
let bump = 0x100;
function writeStr(s) {
  const ptr = bump;
  for (let i = 0; i < s.length; i++) u8[ptr + i] = s.charCodeAt(i);
  u8[ptr + s.length] = 0;
  bump += s.length + 16;
  return ptr;
}
function writeStrW(s) {
  const ptr = bump;
  const dv = new DataView(mem.buffer);
  for (let i = 0; i < s.length; i++) dv.setUint16(ptr + i * 2, s.charCodeAt(i), true);
  dv.setUint16(ptr + s.length * 2, 0, true);
  bump += s.length * 2 + 16;
  return ptr;
}

// Format 0, one track, 96 ticks/quarter: note-on middle C, note-off at 96.
const oneNoteMidi = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
  0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0d,
  0x00, 0x90, 0x3c, 0x64,
  0x60, 0x80, 0x3c, 0x00,
  0x00, 0xff, 0x2f, 0x00,
]);

function makePcmWave(rate = 8000, frames = 4000) {
  const out = new Uint8Array(44 + frames * 2);
  const dv = new DataView(out.buffer);
  const text = (off, value) => {
    for (let i = 0; i < value.length; i++) out[off + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  dv.setUint32(4, out.length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  text(36, 'data');
  dv.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    dv.setInt16(44 + frame * 2, Math.round(Math.sin(frame * Math.PI / 16) * 12000), true);
  }
  return out;
}
const halfSecondWave = makePcmWave();

class FakeAudioParam {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class FakeNode {
  constructor() { this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() {}
}
class FakeOscillator extends FakeNode {
  constructor(owner) {
    super();
    this.owner = owner;
    this.type = '';
    this.frequency = new FakeAudioParam();
    this.detune = new FakeAudioParam();
  }
  setPeriodicWave(wave) { this.periodicWave = wave; }
  start() { this.owner.started.push(this); }
  stop() {}
}
class FakeBufferSource extends FakeNode {
  constructor(owner) {
    super();
    this.owner = owner;
    this.playbackRate = new FakeAudioParam(1);
    this.detune = new FakeAudioParam();
    this.loop = false;
  }
  start() { this.owner.started.push(this); }
  stop() {}
}
class FakeAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = sampleRate ? length / sampleRate : 0;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(channel) { return this.channels[channel]; }
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.destination = new FakeNode();
    this.state = 'running';
    this.started = [];
    this.sampleRate = 44100;
  }
  createGain() { const g = new FakeNode(); g.gain = new FakeAudioParam(1); return g; }
  createOscillator() { return new FakeOscillator(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createBuffer(channels, length, sampleRate) { return new FakeAudioBuffer(channels, length, sampleRate); }
  createDynamicsCompressor() { return new FakeNode(); }
  createConvolver() { return new FakeNode(); }
  createStereoPanner() { const n = new FakeNode(); n.pan = new FakeAudioParam(0); return n; }
  createPeriodicWave(real, imag) { return { real, imag }; }
  resume() { this.state = 'running'; }
  close() { this.state = 'closed'; }
}

const oldAudioContext = globalThis.AudioContext;
const oldWindow = globalThis.window;
globalThis.AudioContext = FakeAudioContext;
globalThis.window = { addEventListener() {} };

try {
  const files = {
    'song.mid': oneNoteMidi,
    'sound.wav': halfSecondWave,
    'weird!song.mid': oneNoteMidi,
    'my!tune.mid': oneNoteMidi,
  };
  const readPaths = [];
  const ac = new FakeAudioContext();
  const ctx = {
    getMemory: () => mem.buffer,
    _audioCtx: ac,
    readFile: (p) => {
      readPaths.push(p);
      return Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null;
    },
  };
  const imports = createHostImports(ctx);

  // --- 1. Command-string open, the RichMan 4 form: "sequencer!song.mid".
  let mark = readPaths.length;
  assert.strictEqual(imports.host.mci_string(writeStr('open sequencer!song.mid alias bgm'), 0, 0), 0);
  assert(ctx._mci.aliases.has('bgm'), 'compound string open should register the alias');
  const bgmId = ctx._mci.aliases.get('bgm');
  const bgm = ctx._mci.devices.get(bgmId);
  assert(bgm, 'compound string open should register a device');
  assert.strictEqual(bgm.type, 'sequencer');
  assert.strictEqual(bgm.element, 'song.mid', 'element must be the part after the device prefix');
  assert(bgm.smf, 'compound-opened MIDI file should parse');
  assert.strictEqual(bgm.smf.notes.length, 1, 'compound-opened MIDI should have notes, not silence');
  const compoundReads = readPaths.slice(mark);
  assert(compoundReads.includes('song.mid'), 'host should read the stripped filename');
  assert(!compoundReads.some(p => p.includes('!')),
    `host must never fetch the whole compound string as a path, saw: ${compoundReads.join(', ')}`);
  const beforePlay = ac.started.length;
  assert.strictEqual(imports.host.mci_string(writeStr('play bgm'), 0, 0), 0);
  assert.strictEqual(ac.started.length, beforePlay + 1, 'play of a compound-opened song should schedule its note');
  assert.strictEqual(imports.host.mci_string(writeStr('close bgm'), 0, 0), 0);

  // --- 2. Command-string compound for waveaudio.
  assert.strictEqual(imports.host.mci_string(writeStr('open waveaudio!sound.wav alias wv'), 0, 0), 0);
  const wv = ctx._mci.devices.get(ctx._mci.aliases.get('wv'));
  assert(wv && wv.wave, 'waveaudio compound open should parse the WAV');
  assert.strictEqual(wv.type, 'waveaudio');
  assert.strictEqual(wv.element, 'sound.wav');
  assert.strictEqual(wv.wave.frames, 4000);
  assert.strictEqual(imports.host.mci_string(writeStr('close wv'), 0, 0), 0);

  // --- 3. Message open (ANSI + wide) with a compound element, no type.
  const msgId = imports.host.mci_open(0, writeStr('sequencer!song.mid'), 0x200);
  const msgDev = ctx._mci.devices.get(msgId);
  assert(msgDev && msgDev.smf, 'mci_open with compound element should parse the MIDI file');
  assert.strictEqual(msgDev.type, 'sequencer');
  assert.strictEqual(msgDev.element, 'song.mid');
  assert.strictEqual(msgDev.smf.notes.length, 1);
  assert.strictEqual(imports.host.mci_command(msgId, 0x0804, 0, 0), 0);

  const wideId = imports.host.mci_open_w(0, writeStrW('sequencer!song.mid'), 0x200);
  const wideDev = ctx._mci.devices.get(wideId);
  assert(wideDev && wideDev.smf, 'mci_open_w with compound element should parse the MIDI file');
  assert.strictEqual(wideDev.element, 'song.mid');
  assert.strictEqual(wideDev.smf.notes.length, 1);
  assert.strictEqual(imports.host.mci_command(wideId, 0x0804, 0, 0), 0);

  // --- 4. Message open with an explicit type AND a compound element.
  const typedId = imports.host.mci_open(writeStr('sequencer'), writeStr('sequencer!song.mid'), 0x2000);
  const typedDev = ctx._mci.devices.get(typedId);
  assert(typedDev && typedDev.smf, 'explicit type + compound element should still strip the prefix');
  assert.strictEqual(typedDev.element, 'song.mid');
  assert.strictEqual(imports.host.mci_command(typedId, 0x0804, 0, 0), 0);

  // --- 4b. The prefix names the device even when the extension disagrees:
  // MIDI bytes stored as song.wav still open a sequencer, on both paths.
  files['song.wav'] = oneNoteMidi;
  assert.strictEqual(imports.host.mci_string(writeStr('open sequencer!song.wav alias odd'), 0, 0), 0);
  const odd = ctx._mci.devices.get(ctx._mci.aliases.get('odd'));
  assert(odd, 'prefix/extension mismatch should still open');
  assert.strictEqual(odd.type, 'sequencer', 'compound prefix must win over the .wav extension');
  assert(odd.smf && odd.smf.notes.length === 1, 'prefix/extension mismatch should parse as MIDI');
  assert.strictEqual(odd.wave, null, 'a sequencer must not also try to parse the bytes as WAV');
  assert.strictEqual(imports.host.mci_string(writeStr('close odd'), 0, 0), 0);
  const oddId = imports.host.mci_open(0, writeStr('sequencer!song.wav'), 0x200);
  const oddDev = ctx._mci.devices.get(oddId);
  assert(oddDev && oddDev.type === 'sequencer' && oddDev.smf && oddDev.wave === null,
    'mci_open: compound prefix must win over the .wav extension');
  assert.strictEqual(imports.host.mci_command(oddId, 0x0804, 0, 0), 0);
  delete files['song.wav'];

  // --- 5. '!' whose prefix is NOT a device type is an ordinary filename.
  mark = readPaths.length;
  assert.strictEqual(imports.host.mci_string(writeStr('open weird!song.mid alias wd'), 0, 0), 0);
  const wd = ctx._mci.devices.get(ctx._mci.aliases.get('wd'));
  assert(wd && wd.smf, 'bang filename with unknown prefix should open by its full name');
  assert.strictEqual(wd.element, 'weird!song.mid', 'non-device bang filename must pass through untouched');
  assert(readPaths.slice(mark).includes('weird!song.mid'),
    'host should have read the full bang filename');
  assert.strictEqual(imports.host.mci_string(writeStr('close wd'), 0, 0), 0);

  const bangId = imports.host.mci_open(0, writeStr('my!tune.mid'), 0x200);
  const bangDev = ctx._mci.devices.get(bangId);
  assert(bangDev && bangDev.smf, 'mci_open bang filename with unknown prefix should open by its full name');
  assert.strictEqual(bangDev.element, 'my!tune.mid');
  assert.strictEqual(imports.host.mci_command(bangId, 0x0804, 0, 0), 0);

  // --- 6. Ordinary filename opens are unchanged.
  assert.strictEqual(imports.host.mci_string(writeStr('open song.mid type sequencer alias plain'), 0, 0), 0);
  const plain = ctx._mci.devices.get(ctx._mci.aliases.get('plain'));
  assert(plain && plain.smf, 'ordinary filename open should still parse');
  assert.strictEqual(plain.element, 'song.mid');
  assert.strictEqual(imports.host.mci_string(writeStr('close plain'), 0, 0), 0);

  console.log('PASS  MCI compound "sequencer!file" string open parses the element and plays notes');
  console.log('PASS  MCI compound "waveaudio!file" string open parses the element');
  console.log('PASS  mci_open/mci_open_w strip a known device prefix from the element');
  console.log('PASS  explicit type plus compound element still strips the prefix');
  console.log('PASS  filenames with a non-device "!" prefix pass through untouched');
  console.log('PASS  ordinary filename opens are unchanged');
} finally {
  if (oldAudioContext === undefined) delete globalThis.AudioContext;
  else globalThis.AudioContext = oldAudioContext;
  if (oldWindow === undefined) delete globalThis.window;
  else globalThis.window = oldWindow;
}
