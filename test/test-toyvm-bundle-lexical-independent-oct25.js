'use strict';
// Independent source-walker acceptance: no source writes, VM or Wasm execution.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
for (const name of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[name] = () => { throw Error('forbidden Wasm ' + name); };
}
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'tools/toyvm/bundle-browser.js');
const override = process.argv.find(arg => arg.startsWith('--builder='));
const text = fs.readFileSync(override ? override.slice('--builder='.length) : filename, 'utf8').replace(/^#![^\n]*\n/, '');
function list(transform, builder = text) {
  const module = { exports: {} }, realRequire = createRequire(filename);
  const fakeFS = Object.assign({}, fs, {
    readFileSync(file, ...args) {
      const bytes = fs.readFileSync(file, ...args);
      return path.relative(root, file) === 'tools/toyvm/dos.js' ? transform(bytes) : bytes;
    },
  });
  new Function('require', 'module', 'exports', '__dirname', builder)(
    id => id === 'fs' ? fakeFS : realRequire(id), module, module.exports, path.dirname(filename));
  return module.exports.moduleList(['tools/toyvm/live.js', 'lib/compile-wat.js']);
}
const ordinary = list(s => s);
let failures = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failures++; console.log('FAIL ' + name + ': ' + error.message); }
}
check('actual tracked font closure includes both required loaders', () => {
  assert(ordinary.includes('tools/fnt-read.js'));
  assert(ordinary.includes('tools/ne-dump.js'));
});
check('block documentation comment cannot create a required import', () => {
  assert.deepStrictEqual(list(s => "/* Documentation: require('./not-an-import') */\n" + s), ordinary);
});
check('inline documentation comment cannot create a required import', () => {
  assert.deepStrictEqual(list(s => "void 0; // Documentation: require('./not-an-import')\n" + s), ordinary);
});
check('quoted documentation cannot create a required import', () => {
  assert.deepStrictEqual(list(s => 'void "Documentation: require(\'./not-an-import\')";\n' + s), ordinary);
});
check('same actual required font import with legal spacing remains in closure', () => {
  assert.deepStrictEqual(list(s => {
    assert(s.includes("require('../fnt-read')"));
    return s.replace("require('../fnt-read')", "require ('../fnt-read')");
  }).sort(), ordinary.slice().sort());
});
check('required font import after block comment remains in closure', () => {
  assert.deepStrictEqual(list(s => s.replace("require('../fnt-read')", "require /* loader */ ('../fnt-read')")).sort(), ordinary.slice().sort());
});
check('missing actual literal dependency must still reject', () => {
  assert.throws(() => list(s => s.replace("require('../fnt-read')", "require('../missing-required-font')")), /requires missing literal dependency/);
});
check('full-line documentation and computed optional require retain established behavior', () => {
  assert.deepStrictEqual(list(s => "// require('./not-an-import')\nif (false) require(path.join(__dirname, 'optional-cli'));\n" + s), ordinary);
});
console.log(JSON.stringify({ failures, scope: 'read-only actual module graph with lexical equivalent source transformations' }));
process.exitCode = failures ? 1 : 0;
