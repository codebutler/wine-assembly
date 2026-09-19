#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DESKTOP_APPS, DEBUG_ONLY_APPS, APPS, appFileUrl } = require('../lib/apps');
const { desktopAssetPaths, SERVER_MAX_FILE_SIZE } = require('../tools/deploy-berrry');
const iconManifest = require('../lib/app-icon-manifest.json');

const id = 'diablo_shareware';
assert(DESKTOP_APPS.some(([name]) => name === id), 'Diablo Shareware must appear on the desktop');
assert(!DEBUG_ONLY_APPS.some(([name]) => name === id), 'Diablo Shareware must not be debug-only');
assert(iconManifest.icons.includes(id), 'Diablo Shareware must have a desktop icon');
assert(fs.existsSync(path.join(__dirname, '..', 'icons', 'apps', `${id}.png`)),
  'Diablo Shareware icon is missing');

const app = APPS[id];
const required = [app.exe, ...app.dlls, ...app.files.map(appFileUrl)];
const deployed = desktopAssetPaths();
for (const file of required) {
  assert(deployed.has(file), `Diablo Shareware deploy is missing ${file}`);
  assert(fs.existsSync(path.join(__dirname, '..', file)), `local asset is missing: ${file}`);
}
const mpq = app.files.find(file => appFileUrl(file).endsWith('/spawn.mpq'));
assert(mpq && !mpq.httpRange,
  'Diablo needs a resident MPQ before synchronous dialog art reads');
assert(fs.statSync(path.join(__dirname, '..', appFileUrl(mpq))).size > SERVER_MAX_FILE_SIZE,
  'the release deployer must split the MPQ into parts');

console.log('PASS  Diablo Shareware desktop entry and release assets');
