'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { validateConfig, registrationConfig } = require('../tools/cmr3-build-register');
const config = { checkout: '/owned/checkout', output: '/evidence/registration', controllerOutput: '/evidence/controller',
  nativeRoot: '/native', gameRoot: '/game', regsvr32: '/input/regsvr32.exe',
  commit: 'a'.repeat(40), gameInventorySha256: 'b'.repeat(64), moduleSha256: null };
test('fresh-build request rejects stale module pins and evidence in source checkout', () => {
  validateConfig(config);
  assert.throws(() => validateConfig({ ...config, moduleSha256: 'd463bdae09d9a4e8926c31f0a594535331a2a85d39d494c0e281b920ce9f0fa5' }));
  assert.throws(() => validateConfig({ ...config, output: '/owned/checkout/output' }));
  assert.throws(() => validateConfig({ ...config, controllerOutput: config.output }));
  assert.throws(() => validateConfig({ ...config, commit: 'main' }));
});
test('registration config is derived only after successful build and a fresh regular module', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-build-gate-')), wasm = path.join(dir, 'module.wasm');
  try {
    assert.throws(() => registrationConfig(config, { status: 0 }, wasm));
    const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]); fs.writeFileSync(wasm, bytes);
    for (const result of [{ status: 1 }, { status: 124 }, { status: null, signal: 'SIGKILL' }, { status: 0, error: 'spawn failed' }])
      assert.throws(() => registrationConfig(config, result, wasm));
    const generated = registrationConfig(config, { status: 0 }, wasm);
    assert.equal(generated.moduleSha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal(generated.commit, config.commit); assert.equal(generated.output, config.output);
    assert.equal(generated.controllerOutput, undefined);
    fs.writeFileSync(wasm, 'not wasm'); assert.throws(() => registrationConfig(config, { status: 0 }, wasm));
    fs.unlinkSync(wasm); fs.symlinkSync('/dev/null', wasm); assert.throws(() => registrationConfig(config, { status: 0 }, wasm));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
