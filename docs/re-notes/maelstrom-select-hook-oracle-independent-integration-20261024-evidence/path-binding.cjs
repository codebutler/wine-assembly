'use strict';
// Only replace the original absolute module root; no assertions or test logic change.
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const original = process.argv[2];
const oldRoot = '/tmp/maelstrom-select-hook-independent-closeout-oct24/repo';
const newRoot = path.resolve(__dirname, '../repo');
const text = fs.readFileSync(original, 'utf8');
if (!text.includes(oldRoot)) throw Error('expected original path binding absent');
const m = new Module(original, module);
m.filename = original; m.paths = Module._nodeModulePaths(path.dirname(original));
m._compile(text.split(oldRoot).join(newRoot), original);
