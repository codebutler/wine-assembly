'use strict';
// Test-only substitution in this process; candidate files are never edited.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../repo');
const filename = path.join(root, 'tools/maelstrom-select-frozen-record.cjs');
const source = fs.readFileSync(filename, 'utf8');
const anchor = "if (accepted.kind === 'rejected') return fail('select record rejected (identity/counter gap)');";
if (source.split(anchor).length !== 2) throw Error('mutant anchor');
const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(source.replace(anchor, "if (false) return fail('mutant removed rejection');"), filename);
require.cache[filename] = m;
require(path.join(root, 'test/test-maelstrom-select-frozen-independent.cjs'));
