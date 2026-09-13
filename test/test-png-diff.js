#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { PNG } = require('pngjs');
const { diffPng } = require('../tools/png-diff');

function image(width, height, bytes) {
  const png = new PNG({ width, height });
  png.data.set(bytes);
  return png;
}

const base = image(2, 2, [
  10, 20, 30, 40,   50, 60, 70, 80,
  90, 100, 110, 120, 130, 140, 150, 160,
]);
const changed = image(2, 2, [
  10, 20, 30, 41,   50, 62, 70, 80,
  90, 100, 110, 120, 130, 140, 150, 160,
]);

let result = diffPng(base, changed);
assert.strictEqual(result.sizeMismatch, false);
assert.strictEqual(result.changed, 2, 'RGBA comparison must include alpha');
assert.strictEqual(result.maxDelta, 2);
assert.deepStrictEqual(result.box, { x: 0, y: 0, w: 2, h: 1 });

result = diffPng(base, changed, { includeAlpha: false });
assert.strictEqual(result.changed, 1, 'RGB comparison must ignore alpha');
assert.strictEqual(result.maxDelta, 2);
assert.deepStrictEqual(result.box, { x: 1, y: 0, w: 1, h: 1 });

result = diffPng(base, changed, {
  includeAlpha: false,
  tolerance: 2,
  region: { x: 1, y: 0, w: 1, h: 1 },
});
assert.strictEqual(result.changed, 0, 'tolerance and region must compose');
assert.strictEqual(result.compared, 1);

result = diffPng(base, image(1, 1, [0, 0, 0, 0]));
assert.strictEqual(result.sizeMismatch, true);
assert.deepStrictEqual(result.a, { width: 2, height: 2 });
assert.deepStrictEqual(result.b, { width: 1, height: 1 });

console.log('png-diff helper: PASS');
