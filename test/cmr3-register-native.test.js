'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { ORDER, WMV_PROFILE, assess, runnerArgs, verifyCommonDirectory } = require('../tools/cmr3-register-native');
test('common DLL search permits tracked documentation only and rejects files or symlinks', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-common-'));
  try {
    fs.writeFileSync(path.join(dir, 'SOURCES.md'), 'provenance');
    verifyCommonDirectory(dir);
    fs.writeFileSync(path.join(dir, 'ole32.dll'), 'native');
    assert.throws(() => verifyCommonDirectory(dir));
    fs.unlinkSync(path.join(dir, 'ole32.dll'));
    fs.unlinkSync(path.join(dir, 'SOURCES.md'));
    fs.symlinkSync('/dev/null', path.join(dir, 'SOURCES.md'));
    assert.throws(() => verifyCommonDirectory(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('source handoff supplies the authenticated original registration tool', () => {
  const pin = require('../docs/cmr3-native-recovery-plan-20261015.json').registry.registrationTool;
  assert(pin, 'Required registration-tool handoff is missing from this checkout');
  assert.equal(pin.bytes, 30720);
  assert.equal(pin.sha256, 'ea8bb5cb31357ee2866e0fce651a29694cb286be9b5e2f96508a92b5f4b3dfeb');
  assert.equal(pin.matchesHistoricalSupportReceipt, true);
  assert.equal(pin.localPath, '/tmp/wa-recovery-20261014/test/binaries/candidates/outcast-demo/disc/Demos/Outcast/DIRECTX/REGSVR32.EXE');
});
const snapshot = { 'reg:HKCR\\CLSID\\{example}\\InprocServer32': JSON.stringify({ values: { '': { type: 1, data: 'C:\\quartz.dll' } } }) };
const good = '[TRACE-AT #1] batch=10 EIP=0x00401341 EAX=0x00000000 ECX=0x00000000\n[Exit] code=0\n';
test('WMVCORE requires its real profile effect, not an invented COM class', () => {
  const effects = { before: snapshot, files: [{ ...WMV_PROFILE }] };
  assert.equal(assess(good, 0, snapshot, 'WMVCORE.DLL', effects).registryUnchanged, true);
  // Same evidence under the former universal native-class rule fails.
  assert.throws(() => assess(good, 0, snapshot, 'WMVCORE.DLL.unrecognized', effects));
  for (const files of [[], [WMV_PROFILE, WMV_PROFILE], [{ ...WMV_PROFILE, path: 'wmsyspr9.prx' }], [{ ...WMV_PROFILE, bytes: 1 }], [{ ...WMV_PROFILE, sha256: '0'.repeat(64) }]]) {
    assert.throws(() => assess(good, 0, snapshot, 'WMVCORE.DLL', { before: snapshot, files }));
  }
  assert.throws(() => assess(good, 0, snapshot, 'WMVCORE.DLL'));
  assert.throws(() => assess(good, 0, {}, 'WMVCORE.DLL', effects));
  assert.throws(() => assess(good.replace('code=0', 'code=5'), 0, snapshot, 'WMVCORE.DLL', effects));
  assert.throws(() => assess(good.replace('EAX=0x00000000', 'EAX=0x80004005'), 0, snapshot, 'WMVCORE.DLL', effects));
  for (const dll of ['WMADMOD.DLL', 'WMVDMOD.DLL', 'qasf.dll', 'MLANG.DLL']) assert.throws(() => assess(good, 0, snapshot, dll, effects));
});
test('production VFS exporter preserves Windows profile path and actual bytes', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { saveVfsToHost } = require('../lib/vfs-export');
  const { inventory } = require('../tools/cmr3-assemble-original');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-vfs-'));
  try {
    saveVfsToHost({ dirs: new Set(), files: new Map([
      ['c:\\windows\\wmsyspr9.prx', { data: Buffer.from('wrong profile') }],
      ['c:\\wmvcore.dll', { data: Buffer.from('not exported') }],
    ]) }, dir, { suffix: '.prx' });
    const files = inventory(dir);
    assert.equal(files.length, 1); assert.equal(files[0].path, WMV_PROFILE.path);
    assert.equal(fs.readFileSync(path.join(dir, WMV_PROFILE.path), 'utf8'), 'wrong profile');
    assert.throws(() => assess(good, 0, snapshot, 'WMVCORE.DLL', { before: snapshot, files }));
    const args = runnerArgs('/stage', 'WMVCORE.DLL', '/before', '/after', '/capture');
    assert(args.includes('--save-vfs=/capture')); assert(args.includes('--save-vfs-suffix=.prx'));
    assert.throws(() => runnerArgs('/stage', 'WMVCORE.DLL', '/before', '/after'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('host zero cannot hide absent HRESULT, guest failure, trap, timeout or missing native registration', () => {
  assert.equal(assess(good, 0, snapshot, 'quartz.dll').hresult, '0x00000000');
  for (const log of ['', '[Exit] code=0', good.replace('EAX=0x00000000', 'EAX=0x80004005'), good.replace('code=0', 'code=5'), good + '[eip-zero]', good + 'UNIMPLEMENTED API', good + 'RuntimeError: unreachable', good + 'timed out', good + good]) {
    assert.throws(() => assess(log, 0, snapshot, 'quartz.dll'));
  }
  assert.throws(() => assess(good, null, snapshot, 'quartz.dll'));
  assert.throws(() => assess(good, 0, {}, 'quartz.dll'));
  assert.throws(() => assess(good, 0, snapshot, 'qedit.dll'));
});
test('historical ordered chain and bounded read-only HRESULT trace', () => {
  assert.deepEqual(ORDER, ['devenum.dll', 'quartz.dll', 'qedit.dll', 'qasf.dll', 'WMVCORE.DLL', 'WMADMOD.DLL', 'WMVDMOD.DLL', 'qasf.dll', 'MLANG.DLL']);
  const args = runnerArgs('/stage', ORDER[0], '/before.json', '/after.json');
  for (const flag of ['--max-seconds=45', '--max-batches=20000', '--no-build', '--trace-at=0x401341', '--reg-import=/before.json', '--reg-export=/after.json', '--args=/s devenum.dll']) assert(args.includes(flag));
  assert.equal(args.find(a => a.startsWith('--dlls=')), '--dlls=/stage/msvcrt.dll,/stage/msdmo.dll,/stage/WMASF.DLL');
});
