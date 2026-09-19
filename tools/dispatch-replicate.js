#!/usr/bin/env node
// Rewrite a source tree ON DISK with dispatch replication.
//
//   node tools/dispatch-replicate.js [--root=DIR] [--dry]
//
// The build does not need this: tools/watx-closure.js and lib/watx-launcher.js
// apply lib/dispatch-replicate.js to the closure text in memory, so src/ stays
// the one-site source and the compiled bytes carry the copies. This CLI is
// for a tree that must hold the replicated text on disk — a benchmark arm
// built by an older driver, or a diff of exactly what the transform emits.
// Idempotent: a second run finds the $nx_fn locals already there and stops.
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const root = (argv.find(a => a.startsWith('--root=')) || '').slice(7) || path.join(__dirname, '..');
const dry = argv.includes('--dry');
const { WAT_FILES } = require(path.join(root, 'lib', 'wat-manifest'));
const { replicateSources } = require(path.join(__dirname, '..', 'lib', 'dispatch-replicate.js'));
const SRC = path.join(root, 'src');

const cache = new Map();
const r = replicateSources(
  WAT_FILES,
  name => { if (!cache.has(name)) cache.set(name, fs.readFileSync(path.join(SRC, name), 'utf8')); return cache.get(name); },
  (name, text) => { if (!dry) fs.writeFileSync(path.join(SRC, name), text); });
console.log(`dispatch-replicate: ${r.sites} site(s) in ${r.funcs} function(s) across ${r.files} file(s)${dry ? ' (dry)' : ''}`);
