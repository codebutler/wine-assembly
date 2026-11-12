'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const source = require('./candidate-corpus/gog-free-elder-scrolls-arena-files.json');
const root = path.join(__dirname, 'binaries/candidates/gog-free-elder-scrolls-arena/installed');
if (!fs.existsSync(root)) console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=gog-free-elder-scrolls-arena');
else {
  for (const file of source.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.size, file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
  console.log(`PASS ${source.files.length} Arena files from the pinned installer, excluding temporary installation files`);
}
