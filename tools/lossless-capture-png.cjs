'use strict';
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_BYTES = 131072;
const PROFILES = Object.freeze({
  default: Object.freeze({ maxBytes: MAX_BYTES, cumulativeBytes: 393216, maxFrames: 3 }),
  'single-frame': Object.freeze({ maxBytes: 2097152, cumulativeBytes: 2097152, maxFrames: 1 }),
});
function profileLimits(name = 'default') {
  assert(typeof name === 'string' && Object.hasOwn(PROFILES, name), 'capture profile');
  return PROFILES[name];
}
const STRATEGIES = Object.freeze([3, 0]);

// Canvas capture contract: bounded, non-interlaced 8-bit RGBA. No palette,
// rescale, gamma correction, alpha conversion or lossy pixel operation.
function decode(PNG, buf) {
  assert(Buffer.isBuffer(buf) && buf.length >= 33 && buf.length <= 2097152 &&
    buf.subarray(0, 8).equals(signature), 'real bounded PNG required');
  assert.equal(buf.readUInt32BE(8), 13, 'PNG IHDR length');
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', 'PNG IHDR required');
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  assert(width > 0 && height > 0 && width <= 800 && height <= 600 && width * height <= 480000,
    'capture dimensions');
  assert(buf[24] === 8 && buf[25] === 6 && buf[26] === 0 && buf[27] === 0 && buf[28] === 0,
    'capture requires non-interlaced RGBA8');
  let offset = 8, ended = false;
  const idat = [];
  while (offset < buf.length) {
    assert(offset + 12 <= buf.length && !ended, 'PNG chunk bounds');
    const length = buf.readUInt32BE(offset), end = offset + 12 + length;
    assert(end <= buf.length, 'PNG chunk bounds');
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, end - 4));
    if (type === 'IEND') { assert.equal(length, 0, 'PNG IEND length'); ended = true; }
    offset = end;
  }
  assert(ended && idat.length, 'complete PNG required');
  // pngjs's synchronous non-interlaced decoder truncates excess inflation.
  // Reject it explicitly, using Node's bounded inflater before the real decode.
  const rawBytes = (width * 4 + 1) * height;
  assert.equal(zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: rawBytes }).length,
    rawBytes, 'PNG inflated size');
  const image = PNG.sync.read(buf, { checkCRC: true });
  assert.equal(image.width, width); assert.equal(image.height, height);
  assert.equal(image.data.length, width * height * 4);
  return image;
}

function encode(PNG, buf, profile = 'default') {
  const limits = profileLimits(profile);
  const candidateBytes = [];
  const image = decode(PNG, buf);
  // At most two level-9 encodes, in stable order; never retain all candidates.
  for (const deflateStrategy of STRATEGIES) {
    const result = PNG.sync.write({ width: image.width, height: image.height, data: image.data },
      { deflateLevel: 9, deflateStrategy, colorType: 6, inputColorType: 6, inputHasAlpha: true });
    candidateBytes.push(result.length);
    if (result.length > limits.maxBytes) continue;
    const decoded = decode(PNG, result);
    assert.deepEqual(decoded.data, image.data, 'capture pixel identity');
    assert.equal(decoded.width, image.width); assert.equal(decoded.height, image.height);
    return result;
  }
  try { assert.fail('capture byte limit'); }
  catch (error) {
    // Sizes only: never attach a rejected encoded or decoded pixel payload.
    Object.defineProperty(error, 'captureDiagnostic', { value: Object.freeze({
      profile, candidateBytes: Object.freeze(candidateBytes),
    }) });
    throw error;
  }
}
module.exports = { encode, MAX_BYTES, STRATEGIES, profileLimits };
