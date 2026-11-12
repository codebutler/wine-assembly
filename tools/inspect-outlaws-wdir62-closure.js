'use strict';

// Source-only reproduction. Never instantiates WASM or modifies guest files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {inspectNeDll} = require('../lib/ne-image');
const {prepareNeSources} = require('../lib/ne-sources');

const directory = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node tools/inspect-outlaws-wdir62-closure.js ORIGINAL_PAYLOAD_DIRECTORY');
const files = new Map(fs.readdirSync(directory).map(name => [name.toLowerCase(), name]));
const bytes = fs.readFileSync(path.join(directory, files.get('wdir62.dll')));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '722d1ecab96d80ae0f1ab9f71522b55841a43cf07277d233ccdfad6166e96ce9', 'requires verified original WDIR62');
const image = inspectNeDll(bytes);
const requests = [];
let failure;
try {
  prepareNeSources('C:\\OUTDEMO\\wdir62.dll', (name, fullPath) => {
    const file = files.get(name.toLowerCase());
    requests.push({name, fullPath, present: !!file});
    return file ? fs.readFileSync(path.join(directory, file)) : null;
  });
} catch (error) {
  failure = {name: error.name, message: error.message, guestCode: error.guestCode};
}
console.log(JSON.stringify({mode: 'source-only-directory-resolver', bytes: bytes.length, sha256,
  dependencies: image.dependencies,
  imports: [...new Set(image.imports.map(entry => entry.module + '.' + entry.symbol))],
  requests, failure: failure || null}, null, 2));
