'use strict';

// Verify reconstruction only; this does not launch or qualify gameplay.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const inventory = require('./candidate-corpus/urban-chaos-demo-files.json');
const root = path.join(__dirname, 'binaries/candidates/urban-chaos-demo/game');
if (!fs.existsSync(root)) {
  console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=urban-chaos-demo');
} else {
  for (const file of inventory.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.size, file.path + ' size');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256,
      file.path + ' recovery hash (use a freshly recovered fixture)');
  }
  assert(inventory.files.some(file => file.path === 'Fallen.exe'));
  assert(inventory.files.some(file => file.path === 'config.ini'));
  console.log(`PASS ${inventory.files.length} recovered Urban Chaos files (config.ini is reconstructed)`);
}
