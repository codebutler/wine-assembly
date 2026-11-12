#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { APPS, DESKTOP_APPS, LOCAL_CANDIDATE_APPS } = require('../lib/apps');
const { desktopAssetPaths, shipsAsSiteText } = require('../tools/deploy-berrry');
const root = path.join(__dirname, '..');
const app = APPS.quake3_demo;
assert(DESKTOP_APPS.some(([id]) => id === 'quake3_demo'));
assert(!LOCAL_CANDIDATE_APPS.some(([id]) => id === 'quake3_demo'));
assert(require('../lib/app-icon-manifest.json').icons.includes('quake3_demo'));
assert(fs.existsSync(path.join(root, 'icons/apps/quake3_demo.png')));
const deployed = desktopAssetPaths();
assert(deployed.has(app.exe));
const dir = path.posix.dirname(app.localFileManifest);
const haveAssets = fs.existsSync(path.join(root, app.localFileManifest));
if (haveAssets) {
  assert(deployed.has(app.localFileManifest));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, app.localFileManifest)));
  for (const file of manifest.files) {
    assert(deployed.has(dir + '/' + file.url), file.url);
    const stat = fs.statSync(path.join(root, dir, file.url));
    assert.strictEqual(stat.size, file.size, file.url + ' installed size');
  }
  assert(manifest.files.some(f => /q3a eula.htm$/i.test(f.url)), 'complete demo includes original EULA');
  assert(deployed.has(dir + '/demoq3/pak0.pk3'));
}
assert(!deployed.has(path.posix.dirname(dir) + '/Q3ADemo.exe'), 'installer is not deployed');
for (const f of app.files) assert(shipsAsSiteText(f.url), f.url + ' must ship');
assert.strictEqual(app.relativeMouse, true);
assert.deepStrictEqual(app.touchControls.dpad.vks, {up:38, down:40, left:65, right:68});
assert(app.persistFiles.includes('c:\\demoq3\\q3config.cfg'));
console.log('PASS Quake III desktop, complete original demo assets, saved controls and relative input policy' +
  (haveAssets ? '' : ' (local payload absent: manifest checks skipped)'));
