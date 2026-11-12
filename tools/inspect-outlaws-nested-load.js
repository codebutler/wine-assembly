'use strict';

// Original-byte audit only; no emulator, guest writes, or extracted binaries.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {inspectNeDll} = require('../lib/ne-image');
if (!process.argv[2]) throw new Error('Usage: node tools/inspect-outlaws-nested-load.js ORIGINAL_WDIR62_DLL');
const b = fs.readFileSync(process.argv[2]);
const sha256 = crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha256, '722d1ecab96d80ae0f1ab9f71522b55841a43cf07277d233ccdfad6166e96ce9');
const image = inspectNeDll(b), ne = b.readUInt32LE(60);
const table = ne + b.readUInt16LE(ne + 0x22), shift = b.readUInt16LE(ne + 0x32) || 9;
const segments = Array.from({length:b.readUInt16LE(ne + 0x1c)}, (_, i) => {
  const p = table + i * 8;
  return {pos:b.readUInt16LE(p) * 2 ** shift, length:b.readUInt16LE(p+2) || 65536, flags:b.readUInt16LE(p+4)};
});
const calls = [];
for (const [index, segment] of segments.entries()) {
  if (!(segment.flags & 0x100)) continue;
  const count = b.readUInt16LE(segment.pos + segment.length);
  for (let i = 0; i < count; i++) {
    const r = segment.pos + segment.length + 2 + i * 8;
    if ((b[r+1] & 3) !== 1 || image.dependencies[b.readUInt16LE(r+4)-1] !== 'KERNEL' || b.readUInt16LE(r+6) !== 95) continue;
    assert.equal(b[r] & 15, 3); // far-address relocation
    assert.equal(b[r+1] & 4, 0); // ordinary linked chain
    for (let site = b.readUInt16LE(r+2); site !== 65535; site = b.readUInt16LE(segment.pos+site))
      calls.push({segment:index+1, site, relocationFileOffset:r});
  }
}
assert.deepEqual(calls, [{segment:1, site:0x1a0d, relocationFileOffset:11621}]);
const code = segments[0].pos;
// cmp [003f],0; je +10; push ds; mov ax,083e; push ax; call far.
assert.equal(b.subarray(code+0x1a00,code+0x1a11).toString('hex'), '833e3f0000740a1eb83e08509affff0000');
assert.equal(b.readUInt16LE(ne+14), 3);
const data = segments[2].pos, pointer = b.readUInt16LE(code+0x1a09);
const end = b.indexOf(0, data+pointer);
assert.ok(end >= data+pointer && end < data+segments[2].length);
const name = b.subarray(data+pointer,end).toString('ascii');
assert.equal(name, 'WIN87EM');
console.log(JSON.stringify({mode:'source-only', sha256, calls, callOpcode:'1:1a0c',
  argument:'DS:083e', autoDataSegment:3, stringFileOffset:data+pointer, name,
  limitation:'Static unique import call and original bytes; runtime stack/name was not captured.'}, null, 2));
