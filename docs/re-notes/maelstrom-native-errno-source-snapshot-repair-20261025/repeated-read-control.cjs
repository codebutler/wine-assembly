'use strict';
// Reintroduce only the original read sequence in memory; never edit the tool.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Module = require('node:module');
const file = path.join(process.cwd(), 'tools/maelstrom-native-errno-latch.cjs');
const good = fs.readFileSync(file, 'utf8');
const anchor = "const source = sources[p];\n    if (typeof source !== 'string' || sha(source) !== pin) throw Error('source pin: ' + p);\n    input[p] = source;";
const broken = "if (typeof sources[p] !== 'string' || sha(sources[p]) !== pin) throw Error('source pin: ' + p);\n    input[p] = sources[p];";
assert.equal(good.split(anchor).length, 2, 'single applied mutation');
const mod = new Module(file, module); mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(good.replace(anchor, broken), file);
require.cache[file] = mod;
require(path.join(process.cwd(), 'test/maelstrom-native-errno-source-snapshot.test.cjs'));
