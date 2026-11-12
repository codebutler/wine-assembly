'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto');
const { admit, inventory, validateConfig } = require('../tools/ne-local-admission');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-admission-'));
try {
  const file = path.join(dir, 'fixture'); fs.writeFileSync(file, 'test-only configuration bytes');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const infra = { pid: 123, startTime: '42', role: 'dashboard', command: 'node ops/server.js --port=8098' };
  const config = { version: 1, dependencies: dir, donors: [{ path: file, sha256: hash }], infrastructure: [infra] };
  validateConfig(config, [hash]);
  assert.throws(() => validateConfig(config, []), /unreviewed donor/);
  assert.throws(() => validateConfig({ ...config, donors: [] }, [hash]), /donor inventory/);
  assert.throws(() => validateConfig({ ...config, infrastructure: [{ ...infra, command: 'node test/run.js' }] }, [hash]), /unrecognized infrastructure/);
  const rows = [{ pid: 123, comm: 'MainThread', command: infra.command }];
  admit(rows, [infra], 999, () => infra);
  assert.throws(() => admit(rows, [], 999), /sole runtime lane/);
  assert.throws(() => admit(rows, [infra], 999, () => ({ ...infra, startTime: '43' })), /sole runtime lane/);
  assert.throws(() => admit(rows, [infra], 999, () => ({ ...infra, command: 'node test/run.js' })), /sole runtime lane/);
  for (const [comm, command] of [['bash', 'bash tools/build.sh'], ['node', 'node tools/build-compile-wat.js'], ['chrome', '/opt/chrome --headless'], ['MainThread', 'node test/run.js']]) {
    assert.throws(() => admit([{ pid: 123, comm, command }], [infra], 999, () => infra), /sole runtime lane/);
  }
  const before = inventory(dir); fs.writeFileSync(file, 'changed');
  assert.notDeepEqual(inventory(dir), before);
  assert.throws(() => validateConfig(config, [hash]));
  fs.symlinkSync('/etc/hostname', path.join(dir, 'escape'));
  assert.throws(() => inventory(dir), /escapes supplied directory/);
  console.log('PASS local admission: identity, competing processes, donors, dependency mutation and escape');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
