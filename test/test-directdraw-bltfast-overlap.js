#!/usr/bin/env node
'use strict';

// Pure JS execution of the production no-color-key WAT row-copy body.
// No compiler, VM boot, game fixture, canvas or binary output. This deliberately
// does NOT validate COM dispatch, surface metadata loading, HRESULT or present.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
// Optional source path allows a read-only baseline comparison with git show.
const source = fs.readFileSync(process.argv[2] ||
  path.join(root, 'src/09a8-handlers-directx.wat'), 'utf8');
const handler = source.split('(func $handle_IDirectDrawSurface_BltFast ')[1]
  .split(';; DeleteAttachedSurface')[0];
const body = handler.split(';; No color key — fast row copies')[1]
  .split(';; If dest is primary, present')[0];
assert(body, 'production row-copy body must be present');
const helpers = fs.readFileSync(path.join(root, 'src/10-helpers.wat'), 'utf8');
assert.match(helpers.split('(func $memcpy ')[1].split('(func $zero_memory')[0],
  /\(memory\.copy \(local\.get \$dst\) \(local\.get \$src\) \(local\.get \$len\)\)/,
  'the row-copy primitive must retain overlap-safe memory.copy semantics');

// Parse only the extracted folded WAT forms. Closing parentheses belonging to
// the enclosing if/else are outside this body. Unsupported operations fail.
const tokens = body.replace(/;;[^\n]*/g, '').match(/\(|\)|[^\s()]+/g);
let cursor = 0;
function parse() {
  const token = tokens[cursor++];
  if (token !== '(') return token;
  const node = [];
  while (tokens[cursor] !== ')') {
    assert(cursor < tokens.length, 'balanced row-copy expression');
    node.push(parse());
  }
  cursor++;
  return node;
}
const program = [];
while (cursor < tokens.length && tokens[cursor] !== ')') program.push(parse());
assert(program.some(n => n[0] === 'block'), 'must execute the production loop');

function execute(bytes, locals) {
  let budget = 100000;
  function run(n) {
    assert(--budget > 0, 'bounded WAT evaluation');
    const [op, ...a] = n;
    const value = i => run(a[i]);
    switch (op) {
      case 'local.get':
        assert(a[0] in locals, `initialized local ${a[0]}`);
        return locals[a[0]];
      case 'local.set': locals[a[0]] = run(a[1]); return;
      case 'i32.const': return Number(a[0]) | 0;
      case 'i32.add': return (value(0) + value(1)) | 0;
      case 'i32.sub': return (value(0) - value(1)) | 0;
      case 'i32.mul': return Math.imul(value(0), value(1));
      case 'i32.and': return value(0) & value(1);
      case 'i32.eq': return +(value(0) === value(1));
      case 'i32.ge_u': return +((value(0) >>> 0) >= (value(1) >>> 0));
      case 'i32.gt_u': return +((value(0) >>> 0) > (value(1) >>> 0));
      case 'i32.lt_u': return +((value(0) >>> 0) < (value(1) >>> 0));
      case 'select': {
        const yes = value(0), no = value(1);
        return value(2) ? yes : no;
      }
      case 'br': throw a[0];
      case 'br_if': if (run(a[1])) throw a[0]; return;
      case 'block':
      case 'loop':
        do {
          try { a.slice(1).forEach(run); return; }
          catch (label) {
            if (label !== a[0]) throw label;
            if (op === 'block') return;
          }
        } while (true);
      case 'call': {
        assert.equal(a[0], '$memcpy');
        const [dst, src, length] = a.slice(1).map(run);
        assert(dst >= 0 && src >= 0 && length >= 0);
        assert(dst + length <= bytes.length && src + length <= bytes.length);
        bytes.copyWithin(dst, src, src + length);
        return;
      }
      default: throw new Error(`Unsupported WAT operation ${op}`);
    }
  }
  program.forEach(run);
}

// Expected bytes always come from an immutable pre-call snapshot, using pixel
// coordinates rather than the production traversal/copy primitive.
function expected(before, c) {
  const after = before.slice();
  for (let y = 0; y < c.rect[3] - c.rect[1]; y++) {
    for (let x = 0; x < c.rect[2] - c.rect[0]; x++) {
      for (let b = 0; b < c.bps; b++) {
        after[c.base + (c.dy + y) * c.pitch + (c.dx + x) * c.bps + b] =
          before[c.base + (c.rect[1] + y) * c.pitch + (c.rect[0] + x) * c.bps + b];
      }
    }
  }
  return after;
}
function actual(before, c) {
  const after = before.slice();
  execute(after, {
    $dst_dib: c.base, $src_dib: c.base, $dst_pitch: c.pitch, $src_pitch: c.pitch,
    $arg1: c.dx, $arg2: c.dy, $sx: c.rect[0], $sy: c.rect[1],
    $sw: c.rect[2] - c.rect[0], $sh: c.rect[3] - c.rect[1], $bps: c.bps,
  });
  return after;
}
function seed(c) {
  const bytes = new Uint8Array(c.base + c.pitch * c.height + 32).fill(0xa7);
  let state = 0x12345678;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width * c.bps; x++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    bytes[c.base + y * c.pitch + x] = state & 255;
  }
  return bytes;
}
let cases = 0;
function check(c, before = seed(c)) {
  const got = actual(before, c), want = expected(before, c);
  // Includes every pixel, row padding, and both allocation guards.
  const mismatch = got.findIndex((v, i) => v !== want[i]);
  assert.equal(mismatch, -1, `${c.name}: first differing byte ${mismatch}` +
    (mismatch < 0 ? '' : ` actual=${got[mismatch]} expected=${want[mismatch]}`));
  cases++;
  return got;
}

// Hand-written independent expected-pixel controls for the oracle itself.
const tiny = { base: 0, width: 4, height: 3, pitch: 5, bps: 1 };
const pixels = Uint8Array.from([1,2,3,4,99, 5,6,7,8,99, 9,10,11,12,99]);
assert.deepEqual([...expected(pixels, { ...tiny, dx: 1, dy: 0, rect: [0,0,3,3] })],
  [1,1,2,3,99, 5,5,6,7,99, 9,9,10,11,99]);
assert.deepEqual([...expected(pixels, { ...tiny, dx: 0, dy: 1, rect: [0,0,4,2] })],
  [1,2,3,4,99, 1,2,3,4,99, 5,6,7,8,99]);

// Literal observations from review.json: flags=0x10, same surface 0x08221080.
// Dimensions/bpp/pitches below are synthetic; none were captured by the trace.
const trace = [
  [0,0,3,1,640,386], [0,0,4,1,640,386], [0,0,5,1,640,386],
  [0,0,4,2,640,386], [0,0,3,2,640,386], [0,0,2,2,640,386],
  [0,0,1,3,640,386], [1,0,0,3,639,386],
];
for (const bps of [1,2,3,4]) for (const pad of [0,4,28]) {
  const surface = { base: 32, width: 640, height: 386, bps, pitch: 640 * bps + pad };
  let sequence = seed(surface);
  trace.forEach(([dx,dy,...rect], i) => {
    const c = { ...surface, dx, dy, rect, name: `trace${i + 1}/${bps}/${pad}` };
    check(c);
    sequence = check({ ...c, name: `${c.name}/sequence` }, sequence);
  });
}
console.log(`PASS ${cases} traced-geometry cases (isolated and synthetic sequence)`);
for (const bps of [1,2,3,4]) for (const pad of [0,4,28]) {
  const surface = { base: 32, width: 640, height: 386, bps, pitch: 640 * bps + pad };
  for (const [name, dx, dy, rect] of [
    ['left', 0, 0, [1,0,640,8]], ['right', 1, 0, [0,0,639,8]],
    ['down', 0, 1, [0,0,640,8]], ['down-right', 1, 1, [0,0,639,8]],
    ['down-left', 0, 1, [1,0,640,8]], ['identity', 0, 0, [0,0,640,8]],
    ['disjoint', 0, 12, [0,0,640,8]],
  ]) check({ ...surface, dx, dy, rect, name: `${name}/${bps}/${pad}` });
}
console.log(`PASS ${cases} source-executed BltFast snapshot cases; 2 literal oracle controls`);
