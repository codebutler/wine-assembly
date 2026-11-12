'use strict';
// Exercise discovery against valid source without executing injected code.
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
function list(code) {
  // Syntax validation only; never invoke the constructed function.
  new Function(code);
  const mod = { exports: {} };
  const adapter = Object.assign({}, fs, { readFileSync(file, ...args) {
    const text = fs.readFileSync(file, ...args);
    return path.relative(root, file) === 'tools/toyvm/dos.js' ? code + '\n' + text : text;
  } });
  new Function('require', 'module', 'exports', '__dirname', builder)(
    id => id === 'fs' ? adapter : realRequire(id), mod, mod.exports, path.dirname(filename));
  return mod.exports.moduleList();
}
const baseline = list('');
const regexp = String.raw`/require('.\/missing-optional-catch')/.test('');`;
const required = "require('./missing-optional-catch')";
let passed = 0;
function inert(code) { assert.deepStrictEqual(list(code), baseline, code); passed++; }
function dependency(code) {
  assert.throws(() => list(code), /requires missing literal dependency \.\/missing-optional-catch/, code);
  passed++;
}
for (const body of [
  'try {} catch {}',
  'try {} catch /* binding omitted */ {}',
  'try {} catch\n{}',
  'try {} catch (error) {}',
  'try {} catch ({message}) {}',
  'try {} catch { try {} catch {} }',
  'try { try {} catch {} } catch {}',
  'try {} catch {} finally {}',
  'try {} catch (error) {} finally {}',
  'try {} finally { try {} catch {} }',
]) {
  inert(body + ' ' + regexp);
  dependency(body + ' ' + required + ';');
}
inert('try {} catch { ' + regexp + ' }');
inert('try {} catch (error) { ' + regexp + ' }');
inert('function outer() { try {} catch {} ' + regexp + ' }');
inert('void `outer ${(() => { try {} catch {} ' + regexp + ' })()}`;');
// Returning from the surrounding expression must still select division.
for (const expression of [
  '(function () { try {} catch {} })',
  'function () { try {} catch {} }',
  '(() => { try {} catch {} })',
  '(class { catch() { try {} catch {} } })',
  '({catch() { try {} catch {} }})',
]) dependency('const value = ' + expression + ' / ' + required + ' / 2;');
// The same path in inert text and a real division operand must not be swallowed.
dependency('try {} catch {} ' + regexp + ' 42 / ' + required + ' / 2;');
dependency('try {} catch {} (' + required + ') / 2;');
console.log('PASS optional/bound/nested catch, finally and division controls: ' + passed);
