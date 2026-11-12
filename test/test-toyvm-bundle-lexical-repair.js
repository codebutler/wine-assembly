'use strict';
// Exercise the actual exported source walker over the real dos.js dependency
// closure. The adapter changes reads only; it never executes the injected code.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
for (const name of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[name] = () => { throw Error('forbidden Wasm ' + name); };
}
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'tools/toyvm/bundle-browser.js');
const builder = fs.readFileSync(filename, 'utf8').replace(/^#![^\n]*\n/, '');
const realRequire = createRequire(filename);
function list(prefix = '', transform = s => s) {
  const mod = { exports: {} };
  const adapter = Object.assign({}, fs, { readFileSync(file, ...args) {
    const bytes = fs.readFileSync(file, ...args);
    return path.relative(root, file) === 'tools/toyvm/dos.js' ? prefix + '\n' + transform(bytes) : bytes;
  } });
  new Function('require', 'module', 'exports', '__dirname', builder)(
    id => id === 'fs' ? adapter : realRequire(id), mod, mod.exports, path.dirname(filename));
  return mod.exports.moduleList();
}
const ordinary = list();
let count = 0;
function inert(code) { new Function(code); assert.deepStrictEqual(list(code), ordinary, code); count++; }
function required(code) {
  new Function(code);
  assert.throws(() => list(code), error => error.message.includes('tools/toyvm/dos.js requires missing literal dependency ./missing-lexical') &&
    error.message.includes('resolved tools/toyvm/missing-lexical.js'), code);
  count++;
}
for (const code of [
  "/* require('./missing-lexical') */ void 0; // require('./missing-lexical')",
  String.raw`void 'escaped \' quote require("./missing-lexical")';`,
  String.raw`void "escaped \" quote require('./missing-lexical')";`,
  "// require('./missing-lexical')\u2028void 0;",
  "void `require('./missing-lexical') ${1 + 2} tail`;",
  "void `outer ${`inner require('./missing-lexical') ${2}`} tail`;",
  String.raw`void /require\('.\/missing-lexical'\)/;`,
  String.raw`void /[/'"\\]require\('.\/missing-lexical'\)/;`,
  String.raw`if (true) /require\('.\/missing-lexical'\)/.test('');`,
  String.raw`while (false) /require\('.\/missing-lexical'\)/.test('');`,
  String.raw`if (true) {} /require\('.\/missing-lexical'\)/.test('');`,
  String.raw`function unused() {} /require\('.\/missing-lexical'\)/.test('');`,
  String.raw`const prior = 1
function unusedASI() {} /require\('.\/missing-lexical'\)/.test('');`,
  String.raw`class Unused {} /require\('.\/missing-lexical'\)/.test('');`,
  "object.require('./missing-lexical'); object?.require('./missing-lexical');",
  "require('./missing-lexical' + suffix); require(path.join('.', 'missing-lexical'));",
  "require(`./missing-lexical`);",
]) inert(code);
for (const code of [
  "require ( './missing-lexical' );",
  "require /* before */ (/* argument */ './missing-lexical' /* after */);",
  "require // comment\n ( // argument\n './missing-lexical' // close\n );",
  String.raw`require('.\x2fmissing-lexical');`,
  String.raw`require('\u002e\u{2f}missing-lexical');`,
  "require('./missing-\\\nlexical');",
  "void `text ${require('./missing-lexical')} tail`;",
  "void `outer ${`inner ${require('./missing-lexical')}`} tail`;",
  "void `raw ${ {key: require('./missing-lexical')} } tail`;",
  "void 42 / require('./missing-lexical') / 2;",
  "void ({}) / require('./missing-lexical') / 2;",
  "const f = function () {} / require('./missing-lexical') / 2;",
  "const f = (() => {}) / require('./missing-lexical') / 2;",
  "const C = class {} / require('./missing-lexical') / 2;",
  "object.return / require('./missing-lexical') / 2;",
  "object.if() / require('./missing-lexical') / 2;",
  String.raw`void /[/'"\\]x/.test(''); require('./missing-lexical');`,
]) required(code);
// An escaped real font path must resolve to the same complete closure. Moving
// its discovery ahead of another dependency may change postorder, not the set.
assert.deepStrictEqual(list('', s => s.replace("require('../fnt-read')", String.raw`require /*font*/ ('..\x2ffnt-read')`)).slice().sort(), ordinary.slice().sort());
count++;
// Unsupported lexical-goal ambiguities fail closed with the importer, rather
// than skipping a possible real dependency. These forms are absent in the
// shipped module closure; this walker is deliberately not a full JS parser.
for (const code of [String.raw`requ\u0069re('./missing-lexical');`,
  "const object = {key: {} / require('./missing-lexical') / 2};"]) {
  new Function(code);
  assert.throws(() => list(code), /tools\/toyvm\/dos.js: unsupported or unterminated JavaScript token/);
  count++;
}
console.log(`PASS ${count} actual-source lexical controls (inert text, escapes, formatted imports, templates, regexp/division, importer diagnostics)`);
