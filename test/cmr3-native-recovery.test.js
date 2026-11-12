'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { verifyIdentity, selectExact, selectDirectOrCabinet } = require('../tools/cmr3-native-recovery');
test('native identity rejects same-name same-size replacement and accepts exact nested bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-native-'));
  try {
    const pin = { path: 'qedit.dll', bytes: 4, sha256: crypto.createHash('sha256').update('good').digest('hex') };
    const bad = path.join(root, 'qedit.dll'); fs.writeFileSync(bad, 'evil');
    assert.throws(() => verifyIdentity(bad, pin), /Hash mismatch/);
    assert.throws(() => selectExact(root, pin), /No exact native identity/);
    fs.mkdirSync(path.join(root, 'original'));
    const good = path.join(root, 'original/QEDIT.DLL'); fs.writeFileSync(good, 'good');
    assert.equal(selectExact(root, pin), good); verifyIdentity(good, pin);
    fs.writeFileSync(good, 'goo'); assert.throws(() => verifyIdentity(good, pin), /Size mismatch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('archive metadata SHA1 pin is checked before extraction', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-package-'));
  try {
    const p = path.join(root, 'package'); fs.writeFileSync(p, 'original');
    const pin = { bytes: 8, sha1: crypto.createHash('sha1').update('original').digest('hex') };
    verifyIdentity(p, pin); fs.writeFileSync(p, 'modified');
    assert.throws(() => verifyIdentity(p, pin), /Hash mismatch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('direct and nested cabinet payload selection preserve exact identity requirement', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-layout-'));
  try {
    const pin = { path: 'qedit.dll', bytes: 4, sha256: crypto.createHash('sha256').update('good').digest('hex') };
    const direct = path.join(root, 'direct'), nested = path.join(root, 'nested'), extracted = path.join(root, 'extracted');
    for (const p of [direct,nested,extracted]) fs.mkdirSync(p);
    fs.writeFileSync(path.join(direct,'qedit.dll'),'good');
    assert.equal(selectDirectOrCabinet(direct,pin,()=>{throw Error('Unexpected extraction');}),path.join(direct,'qedit.dll'));
    fs.writeFileSync(path.join(nested,'DirectX.cab'),'cab marker');
    fs.writeFileSync(path.join(extracted,'QEDIT.DLL'),'good');
    let calls=0;
    const extract = p => { assert.equal(p,path.join(nested,'DirectX.cab'));calls++;return extracted; };
    assert.equal(selectDirectOrCabinet(nested,pin,extract),path.join(extracted,'QEDIT.DLL'));assert.equal(calls,1);
    fs.writeFileSync(path.join(direct,'qedit.dll'),'evil');
    assert.throws(()=>selectDirectOrCabinet(direct,pin,extract),/No exact native identity/);assert.equal(calls,1);
    fs.writeFileSync(path.join(extracted,'QEDIT.DLL'),'evil');
    assert.throws(()=>selectDirectOrCabinet(nested,pin,extract),/No exact native identity/);
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});
