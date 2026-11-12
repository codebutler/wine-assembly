'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const source = require('./candidate-corpus/gallinelle-xxl-files.json');
const root = path.join(__dirname, 'binaries/candidates/gallinelle-xxl');
if (!fs.existsSync(root)) console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=gallinelle-xxl');
else {
  for (const file of source.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.size, file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
  console.log(`PASS ${source.files.length} Gallinelle XXL files from the pinned original disc`);
}
