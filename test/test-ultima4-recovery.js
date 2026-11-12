'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const inventory = require('./candidate-corpus/gog-free-ultima-iv-files.json');
const root = path.join(__dirname, 'binaries/candidates/gog-free-ultima-iv/installed');
if (!fs.existsSync(root)) console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=gog-free-ultima-iv');
else {
  for (const file of inventory.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.size, file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
  console.log(`PASS ${inventory.files.length} original Ultima IV files, including original save templates`);
}
