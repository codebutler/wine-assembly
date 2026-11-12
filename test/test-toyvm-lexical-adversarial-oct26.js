'use strict';
// Independent lexical contexts; injected source is parsed but never executed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
for (const key of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[key] = () => { throw Error('forbidden Wasm ' + key); };
}
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'tools/toyvm/bundle-browser.js');
const builder = fs.readFileSync(filename, 'utf8').replace(/^#![^\n]*\n/, '');
const realRequire = createRequire(filename);
function list(prefix, replace = false) {
  const mod = { exports: {} };
  const adapter = Object.assign({}, fs, { readFileSync(file, ...args) {
    const text = fs.readFileSync(file, ...args);
    return path.relative(root, file) === 'tools/toyvm/dos.js' ? (replace ? prefix : prefix + '\n' + text) : text;
  } });
  new Function('require', 'module', 'exports', '__dirname', builder)(
    id => id === 'fs' ? adapter : realRequire(id), mod, mod.exports, path.dirname(filename));
  return mod.exports.moduleList();
}
const baseline = list('');
let failures = 0, passed = 0;
function check(name, code, expectation) {
  try {
    if (expectation !== 'malformed') new Function(code);
    else assert.throws(() => new Function(code), SyntaxError);
    if (expectation === 'inert') assert.deepStrictEqual(list(code), baseline);
    else if (expectation === 'required') assert.throws(() => list(code), /requires missing literal dependency \.\/missing-adversarial/);
    else assert.throws(() => list(code, expectation === 'malformed'), /unsupported or unterminated JavaScript token/);
    passed++; console.log('PASS ' + name);
  } catch (error) { failures++; console.log('FAIL ' + name + ': ' + error.message); }
}
for (const [name, code] of [
  ['comment', "/* require('./missing-adversarial') */"],
  ['escaped string', String.raw`void 'escaped \' require("./missing-adversarial")';`],
  ['template raw and escaped interpolation', String.raw`void \`require('./missing-adversarial') \${text}\`;`.replace(/\\`/g, '`')],
  ['regexp character class', String.raw`void /[/'"]require('.\/missing-adversarial')/;`],
  ['regexp after optional catch binding', String.raw`try {} catch {} /require('.\/missing-adversarial')/.test('');`],
  ['regexp after try body', String.raw`try { /require('.\/missing-adversarial')/.test(''); } catch {}`],
  ['regexp after finally', String.raw`try {} finally {} /require('.\/missing-adversarial')/.test('');`],
  ['regexp after for control', String.raw`for (;;) /require('.\/missing-adversarial')/.test('');`],
]) check(name, code, 'inert');
for (const [name, code] of [
  ['real import with trivia', "require /*x*/ ( './missing-adversarial' );"],
  ['nested template expression', "void `raw ${`nested ${require('./missing-adversarial')}`}`;"],
  ['escaped real path', String.raw`require('.\x2fmissing-adversarial');`],
  ['numeric division', "42 / require('./missing-adversarial') / 2;"],
  ['object division', "({}) / require('./missing-adversarial') / 2;"],
  ['function expression division', "const f = function() {} / require('./missing-adversarial') / 2;"],
  ['class expression division', "const C = class {} / require('./missing-adversarial') / 2;"],
  ['required after optional catch', "try {} catch {} require('./missing-adversarial');"],
]) check(name, code, 'required');
for (const [name, code] of [
  ['unterminated string', "void 'require(\"./missing-adversarial\")"],
  ['unterminated template', "void `require('./missing-adversarial')"],
  ['unterminated comment', "/* require('./missing-adversarial')"],
  ['unterminated regex', "void /require('./missing-adversarial')"],
]) check(name, code, 'malformed');
console.log(JSON.stringify({passed, failures, scope: 'source lexical contexts only; no injected code execution'}));
process.exitCode = failures ? 1 : 0;
