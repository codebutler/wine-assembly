#!/usr/bin/env node
'use strict';

// BG-FETCH-IS5-20261011: tools/is5-extract.js guessed the header name by
// lower-casing the extension ("DATA1.CAB" -> "DATA1.hdr"). The Baldur's Gate
// demo CD names it DATA1.HDR, so on a case-sensitive filesystem the guess
// missed, the 209 MB cab was read as its own header and the fetch failed with
// ERR_OUT_OF_RANGE. The header is matched case-insensitively, like volumes.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { headerPath } = require('../tools/is5-extract');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'is5-hdr-'));
try {
  for (const name of ['DATA1.CAB', 'DATA1.HDR']) fs.writeFileSync(path.join(dir, name), 'x');
  assert.strictEqual(headerPath(path.join(dir, 'DATA1.CAB')), path.join(dir, 'DATA1.HDR'),
    'an upper-case CD header is found for an upper-case cab');
  fs.writeFileSync(path.join(dir, 'data2.cab'), 'x');
  fs.writeFileSync(path.join(dir, 'Data2.Hdr'), 'x');
  assert.strictEqual(headerPath(path.join(dir, 'data2.cab')), path.join(dir, 'Data2.Hdr'),
    'any spelling of the header matches');
  fs.writeFileSync(path.join(dir, 'data3.cab'), 'x');
  assert.strictEqual(headerPath(path.join(dir, 'data3.cab')), null,
    'no header: null, and the caller reads the cab itself');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('PASS  is5-extract finds a cab\'s header whatever its case');
