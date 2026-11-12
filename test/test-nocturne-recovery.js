'use strict';

// Verify reconstruction only; this does not launch or qualify gameplay.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const inventory = require('./candidate-corpus/nocturne-demo-files.json');
const root = path.join(__dirname, 'binaries/candidates/nocturne-demo/game');
if (!fs.existsSync(root)) {
  console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=nocturne-demo');
} else {
  for (const file of inventory.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.size, file.path + ' size');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256,
      file.path + ' original payload hash (use a freshly recovered fixture)');
  }
  assert(inventory.files.some(file => file.path === 'nocturne.exe'));
  assert(inventory.files.some(file => file.path === 'system/nocturne.ini'));
  console.log(`PASS ${inventory.files.length} recovered original Nocturne payload files`);
}
