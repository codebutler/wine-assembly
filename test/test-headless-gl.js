// Headless WebGL: does a Node canvas hand out a real GL context, and do the
// pixels it draws come back out through the ordinary 2D read paths?
//
// That second half is the whole risk. The frame lives in the driver's drawing
// buffer, not in the canvas's byte array, so every reader in the compositor --
// drawImage, toBuffer, getImageData -- would see an empty surface unless the
// read pulls it back. A test that only checks `getContext('webgl') !== null`
// passes while the screen is black.
//
// Skips cleanly when the optional native deps are absent: they are
// optionalDependencies precisely so a machine without them still runs the
// suite.

const assert = require('assert');
const hgl = require('../lib/headless-gl');
const { createCanvas } = require('../lib/canvas-compat');

if (!hgl.available()) {
  console.log(`SKIP test-headless-gl: ${hgl.unavailableReason()}`);
  process.exit(0);
}

const W = 32, H = 16;
const canvas = createCanvas(W, H);
const gl = canvas.getContext('webgl');
assert.ok(gl, 'canvas.getContext("webgl") returned null with the deps installed');
assert.strictEqual(canvas.getContext('webgl'), gl, 'getContext must be idempotent');

// A 2D context is still available on the same canvas object; asking for one
// must not disturb the GL context.
assert.ok(canvas.getContext('2d'), '2d context unavailable after webgl');
assert.strictEqual(canvas.getContext('webgl'), gl, 'gl context lost after asking for 2d');

console.log('renderer:', gl.getParameter(gl.RENDERER),
  '| version:', gl.getParameter(gl.VERSION));

// --- the pixels must reach the byte array the compositor reads -------------
// Green, and NOT the colour a zeroed buffer would be, so a no-op read cannot
// pass by accident.
gl.viewport(0, 0, W, H);
gl.clearColor(0, 1, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.finish();

// Before present, the canvas still holds the previous frame -- that is the
// contract, not a bug: readPixels mid-frame would hand over a half-drawn scene.
assert.strictEqual(canvas._data[1], 0, 'canvas showed GL pixels before present()');

canvas.markGlPresented();
const px = canvas._data;
assert.strictEqual(px[0], 0, `R: expected 0, got ${px[0]}`);
assert.strictEqual(px[1], 255, `G: expected 255, got ${px[1]} -- readPixels never reached the canvas`);
assert.strictEqual(px[2], 0, `B: expected 0, got ${px[2]}`);
assert.strictEqual(px[3], 255, `A: expected 255, got ${px[3]}`);

// --- the flip must be right ------------------------------------------------
// GL's origin is bottom-left and a canvas's is top-left. Draw a scissored band
// across the BOTTOM of the GL viewport and assert it lands at the BOTTOM of the
// canvas. Without the flip in readPixelsInto this is off by the full height,
// which a solid-colour test cannot see at all.
gl.enable(gl.SCISSOR_TEST);
gl.scissor(0, 0, W, 4);            // GL y=0..4 == bottom
gl.clearColor(0, 0, 1, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.disable(gl.SCISSOR_TEST);
gl.finish();
canvas.markGlPresented();

const rowAt = y => { const p = canvas._data, o = y * W * 4; return [p[o], p[o + 1], p[o + 2]]; };
assert.deepStrictEqual(rowAt(0), [0, 255, 0], `top row should be green, got ${rowAt(0)} -- image is flipped`);
assert.deepStrictEqual(rowAt(H - 1), [0, 0, 255], `bottom row should be blue, got ${rowAt(H - 1)} -- image is flipped`);

// --- it must survive being used as a drawImage source ----------------------
// This is how the compositor actually consumes a GL layer.
const screen = createCanvas(W, H);
screen.getContext('2d').drawImage(canvas, 0, 0);
const sp = screen._data;
assert.strictEqual(sp[1], 255, `composited top row lost the frame: ${[sp[0], sp[1], sp[2]]}`);

// --- and a PNG encode must see it too --------------------------------------
const png = canvas.toBufferSync();
assert.ok(png && png.length > 100, 'toBufferSync produced no PNG');

// --- resize must not leave the drawing buffer at the old size --------------
canvas.width = 64;
assert.strictEqual(canvas.width, 64);
const gl2 = canvas.getContext('webgl');
assert.ok(gl2, 'no GL context after resize');
gl2.viewport(0, 0, 64, canvas.height);
gl2.clearColor(1, 0, 1, 1);
gl2.clear(gl2.COLOR_BUFFER_BIT);
gl2.finish();
canvas.markGlPresented();
const rp = canvas._data;
assert.strictEqual(rp.length, 64 * canvas.height * 4, 'pixel buffer not resized');
assert.strictEqual(rp[0], 255, 'R after resize');
assert.strictEqual(rp[2], 255, 'B after resize');
// The far end of the widened row is the part that stays stale if the drawing
// buffer was never resized.
const last = (64 * 1 - 1) * 4;
assert.strictEqual(rp[last + 2], 255, 'right edge stale: drawing buffer was not resized');

hgl.destroyContext(gl2);
console.log('PASS test-headless-gl');
