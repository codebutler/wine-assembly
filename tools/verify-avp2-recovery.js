#!/usr/bin/env node
'use strict';

// Verify original cabinet bytes only; launcher-generated state is separate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const inventory = require('../test/candidate-corpus/avp2-demo-files.json');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../test/binaries/candidates/avp2-demo/game'));
for (const file of inventory.files) {
  const bytes = fs.readFileSync(path.join(root, file.path));
  assert.equal(bytes.length, file.size, file.path + ' size');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path + ' SHA256');
}
console.log(`PASS ${inventory.files.length} original AVP2 cabinet files; launcher handoff/gameplay not verified`);
