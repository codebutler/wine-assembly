'use strict';
// Discover dependencies from valid, unexecuted source through the real walker.
const assert = require('assert'), fs = require('fs'), path = require('path');
const {createRequire} = require('module');
const {spawnSync} = require('child_process');
for (const k of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[k] = () => { throw Error('forbidden Wasm ' + k); };
}
const root = path.resolve(__dirname, '..');
const builderFile = path.join(root, 'tools/toyvm/bundle-browser.js');
const revision = process.argv.find(a => a.startsWith('--builder-revision='))?.split('=')[1];
let builder = fs.readFileSync(builderFile, 'utf8');
if (revision) {
  assert.match(revision, /^[0-9a-f]{40}$/);
  const read = spawnSync('git', ['cat-file', 'blob', revision + ':tools/toyvm/bundle-browser.js'],
    {cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 131072});
  assert.strictEqual(read.status, 0);
  builder = read.stdout;
}
builder = builder.replace(/^#![^\n]*\n/, '');
const realRequire = createRequire(builderFile);
function discover(source) {
  new Function(source); // Parse only; never call injected source.
  const mod = {exports: {}};
  const adapter = Object.assign({}, fs, {readFileSync(file, ...args) {
    return path.relative(root, file) === 'tools/toyvm/dos.js' ? source : fs.readFileSync(file, ...args);
  }});
  new Function('require', 'module', 'exports', '__dirname', builder)(
    id => id === 'fs' ? adapter : realRequire(id), mod, mod.exports, path.dirname(builderFile));
  return mod.exports.moduleList();
}
const baseline = discover('');
const real = "require('./missing-independent-catch')";
const regex = String.raw`/require('.\/missing-independent-catch')[/]/.test('');`;
let passed = 0, failed = 0;
const results = [];
function check(name, source, required) {
  try {
    if (required) assert.throws(() => discover(source), /requires missing literal dependency \.\/missing-independent-catch/);
    else assert.deepStrictEqual(discover(source), baseline);
    passed++; results.push({name, required, pass: true});
  } catch (e) { failed++; results.push({name, required, pass: false, error: e.message, source}); }
}
const bodies = [
  'try {} catch {}',
  'try {} catch /*line\ncomment*/ {}',
  'try {} catch (e) {}',
  'try {} catch ({x: renamed, ...rest}) {}',
  'try {} catch ([x = (() => {})]) {}',
  'try {} catch { try {} catch (e) {} finally {} }',
  'try { try {} catch {} finally {} } catch (e) {} finally {}',
  'try {} catch {} finally { try {} catch {} }',
];
for (const [n, body] of bodies.entries()) {
  check('regexp immediately after catch/finally ' + n, body + '\n/* boundary */' + regex, false);
  check('required after catch/finally ' + n, body + '\n' + real + ';', true);
  check('required inside catch/finally ' + n, body.replace('{}', '{' + real + ';}'), true);
}
for (const [n, expression] of [
  '(function () { try {} catch {} })',
  '(async function () { try {} catch {} finally {} })',
  '(() => { try {} catch {} finally {} })',
  '(class { method() { try {} catch {} } })',
  '({method() { try {} catch {} finally {} }})',
].entries()) {
  check('enclosing expression requires division ' + n, 'const value = ' + expression + ' / ' + real + ' / 2;', true);
}
check('regexp then division', 'try {} catch {} ' + regex + ' 8 / ' + real + ' / 2;', true);
check('division inside optional catch', 'try {} catch { 8 / ' + real + ' / 2; }', true);
check('default binding dependency', 'try {} catch ({x = ' + real + '}) {}', true);
check('regexp inside default binding', 'try {} catch ({x = /require(".\\/missing-independent-catch")/}) {}', false);
check('regexp after function declaration containing catch', 'function f(){ try {} catch {} } ' + regex, false);
check('regexp in template expression containing catch', 'void `${(() => {try {} catch {} ' + regex + '})()}`;', false);
check('real dependency in template expression containing catch', 'void `${(() => {try {} catch {} return ' + real + ';})()}`;', true);
check('binding object method call remains division', 'obj.catch({}) / ' + real + ' / 2;', true);
check('inert catch name in regexp', '/catch[{}]/; ' + regex, false);
console.log(JSON.stringify({passed, failed, results}, null, 2));
process.exitCode = failed ? 1 : 0;
