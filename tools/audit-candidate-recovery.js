#!/usr/bin/env node
'use strict';

// Static recipe inventory, never a claim of source availability or game recovery.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'test/candidate-corpus/manifest.json');
const bytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(bytes);
const ids = new Set(manifest.candidates.map(candidate => candidate.id));
const errors = [];
if (ids.size !== manifest.candidates.length) errors.push('Duplicate candidate IDs');
const candidates = manifest.candidates.map(candidate => {
  const shared = candidate.fixture && candidate.fixture !== candidate.id;
  const packages = candidate.packages || [];
  if (shared && !ids.has(candidate.fixture)) errors.push(`${candidate.id}: unknown shared fixture ${candidate.fixture}`);
  for (const [index, pkg] of packages.entries()) {
    if (!/^https?:\/\//.test(pkg.url || '') || !/^[a-f0-9]{40}$/.test(pkg.sha1 || '')) {
      errors.push(`${candidate.id}: package ${index + 1} lacks HTTP(S) URL or pinned SHA-1`);
    }
  }
  return {
    id: candidate.id,
    recovery: shared ? 'shared-fixture' : packages.length ? 'package-recipe' : 'manual-preparation',
    fixture: candidate.fixture || candidate.id,
    sourcePage: candidate.sourcePage || null,
    packageCount: packages.length,
    postExtractSteps: (candidate.postExtract || []).length,
    outputInventory: fs.existsSync(path.join(root, 'test/candidate-corpus', `${candidate.id}-files.json`))
      ? `test/candidate-corpus/${candidate.id}-files.json` : null,
    manual: candidate.manual || null,
  };
});
const counts = { total: candidates.length };
for (const candidate of candidates) counts[candidate.recovery] = (counts[candidate.recovery] || 0) + 1;
console.log(JSON.stringify({
  schemaVersion: 1,
  scope: 'candidate manifest only; excludes unmapped registry/DOS fixtures',
  limitation: 'Static metadata only: no downloads, entitlement checks, installed-tree reconstruction or gameplay validation. Output inventory presence is not a fresh verification receipt.',
  manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  counts, errors, candidates,
}, null, 2));
if (errors.length) process.exitCode = 1;
