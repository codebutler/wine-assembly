'use strict';
// Exercise the actual source walker with read-only missing-file fault injection.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const filename = path.resolve(__dirname, '../tools/toyvm/bundle-browser.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(filename, 'utf8').replace(/^#![^\n]*\n/, '');
const roots = ['tools/toyvm/live.js', 'tools/toyvm/region-prepare.js', 'lib/compile-wat.js'];
function walker(fsImpl, text = source) {
  const mod = { exports: {} }, realRequire = createRequire(filename);
  const req = id => id === 'fs' ? fsImpl : realRequire(id);
  new Function('require', 'module', 'exports', '__dirname', text)(req, mod, mod.exports, path.dirname(filename));
  return mod.exports.moduleList;
}
function checkRequired(text = source) {
  for (const missing of ['tools/fnt-read', 'tools/ne-dump']) {
    const masked = Object.assign({}, fs, {
      existsSync: file => ![missing, missing + '.js'].includes(path.relative(root, file)) && fs.existsSync(file),
    });
    assert.throws(() => walker(masked, text)(roots), error =>
      error.message.includes('requires missing literal dependency') &&
      error.message.includes(missing + '.js') &&
      error.message.includes(missing.endsWith('fnt-read') ? 'tools/toyvm/dos.js' : 'tools/fnt-read.js'));
  }
}
checkRequired();
const modules = walker(fs)(roots);
assert.ok(modules.includes('tools/fnt-read.js'));
assert.ok(modules.includes('tools/ne-dump.js'));
const virtual = new Map([
  ['test/entry.js', "// Example: require('./missing-example');\nrequire('./dep'); require('optional-package'); require(path.join(__dirname, 'optional-cli'));"],
  ['test/dep.js', 'module.exports = {};'],
]);
const virtualFS = { existsSync: f => virtual.has(path.relative(root, f)),
  readFileSync: f => virtual.get(path.relative(root, f)) };
assert.deepStrictEqual(walker(virtualFS)(['test/entry.js']), ['test/dep.js', 'test/entry.js']);
console.log('PASS required font-loader closure, importer diagnostics, optional bare/computed dependencies');
const mutant = source.replace(/throw new Error\(`bundle: \$\{id\} requires missing literal dependency[^\n]+/, 'continue;');
assert.notStrictEqual(mutant, source);
assert.throws(() => checkRequired(mutant), /Missing expected exception/);
console.log('REJECTED silent required-dependency omission');
