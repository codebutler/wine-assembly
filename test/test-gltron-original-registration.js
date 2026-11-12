'use strict';

// Source/loader acceptance only. Never instantiate WASM or execute the guest.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APPS, DESKTOP_APPS } = require('../lib/apps');
const { normalizeLazyFiles } = require('../lib/app-files');
const { VirtualFS } = require('../lib/filesystem');
const { stageGltron, sha256 } = require('../tools/stage-gltron-original');

async function main() {
  const [source, destination, inventoryPath] = process.argv.slice(2);
  const app = APPS.gltron;
  assert(app && !DESKTOP_APPS.some(row => row[0] === 'gltron'), 'Local candidate stays out of the public desktop');
  assert.equal(app.exe, 'binaries/gltron-0.70/gltron.exe');
  assert.equal(app.exeGuestPath, 'c:\\games\\gltron\\gltron.exe');
  assert.equal(app.workingDirectory, 'c:\\games\\gltron');
  assert.equal(app.files.length, 92);
  assert.equal(new Set(app.files.map(file => file.vfsPath.toLowerCase())).size, 92);
  assert.equal(app.files.reduce((sum, file) => sum + file.size, 0), 4968893);
  for (const file of app.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.equal(file.loadMode, 'required');
  }
  if (!source && !destination && !inventoryPath) {
    console.log('PASS GLTron registry structure; retained-media loader acceptance requires three explicit paths (see recipe)');
    return;
  }
  assert(source && destination && inventoryPath, 'Pass extracted app directory, task-owned destination, accepted inventory');
  const inventoryBytes = fs.readFileSync(inventoryPath);
  assert.equal(sha256(inventoryBytes), '0f5c45647ac8d26104d01d4e052913382aaa9d73a3c6bc31339529a60508b341');
  const inventory = JSON.parse(inventoryBytes);
  assert.equal(app.files.length, inventory.count);
  for (const input of inventory.files) {
    const relative = input.path.slice(4);
    const item = app.files.find(file => file.url === 'binaries/gltron-0.70/' + relative);
    assert(item, relative);
    assert.equal(item.size, input.bytes);
    assert.equal(item.sha256, input.sha256);
    assert.equal(item.vfsPath, app.workingDirectory + '\\' + relative.replace(/\//g, '\\'));
    assert.equal(item.loadMode, 'required');
  }
  const policy = normalizeLazyFiles(app, app.files);
  assert.equal(policy.summary.lazyFiles, 0);

  // Evaluate the complete checked-out production host without transforming it.
  // Exporting the lexical class in a second script leaves its source unchanged.
  const context = vm.createContext({ console, Uint8Array, ArrayBuffer, AbortController, URL, URLSearchParams, setTimeout, clearTimeout });
  const hostPath = path.resolve(__dirname, '../host.js');
  const hostBytes = fs.readFileSync(hostPath);
  vm.runInContext(hostBytes.toString(), context, { filename: hostPath });
  const Host = vm.runInContext('WineAssembly', context);
  const vfs = new VirtualFS();
  const host = Object.create(Host.prototype);
  host._helpCtx = { vfs };
  Host.fetchAssetBytes = async url => {
    try { return new Uint8Array(fs.readFileSync(path.join(destination, url.slice('binaries/gltron-0.70/'.length)))); }
    catch { throw new Error('HTTP 404'); }
  };
  // The first behavioral boundary is the actual production loadFiles method:
  // missing original payload must reject required loading before any staging.
  await assert.rejects(host.loadFiles(policy.files, { required: true, concurrency: 1 }), /failed to load/);
  const staged = stageGltron(source, destination);
  assert.equal(staged.files, 92);
  assert.equal(staged.bytes, 4968893);
  await host.loadFiles(policy.files, { required: true, concurrency: 1 });
  assert(vfs.setCurrentDirectory(app.workingDirectory));
  for (const file of app.files) {
    const mounted = vfs.files.get(file.vfsPath.toLowerCase());
    assert(mounted, file.vfsPath);
    assert.equal(mounted.data.length, file.size);
    assert.equal(sha256(mounted.data), file.sha256);
  }
  assert.equal(sha256(fs.readFileSync(path.join(destination, 'gltron.exe'))), app.files.find(file => file.url === app.exe).sha256);

  // Independent missing/corrupt controls for executable, bundled DLL and data.
  const rejectedDestination = destination + '-must-not-exist';
  for (const relative of ['gltron.exe', 'SDL.dll', 'art/classic/artpack.lua']) {
    const item = path.join(destination, relative);
    const original = fs.readFileSync(item);
    fs.unlinkSync(item);
    assert.throws(() => stageGltron(destination, rejectedDestination));
    assert(!fs.existsSync(rejectedDestination));
    fs.writeFileSync(item, original);
    const corrupt = Buffer.from(original); corrupt[0] ^= 1;
    fs.writeFileSync(item, corrupt);
    assert.throws(() => stageGltron(destination, rejectedDestination), /input mismatch/);
    assert(!fs.existsSync(rejectedDestination));
    fs.writeFileSync(item, original);
  }
  assert.throws(() => stageGltron(source, destination), /already exists/);
  assert.throws(() => stageGltron(source, source), /separate trees/);
  console.log(JSON.stringify({ PASS: true, registeredFiles: 92, bytes: staged.bytes, productionHostSHA256: sha256(hostBytes), negativeControls: 9, guestExecuted: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
