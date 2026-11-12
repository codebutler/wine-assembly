'use strict';
// In-memory source mutation; checkout bytes and census never change.
const fs = require('fs');
const path = require('path');
const controls = {
  'omit-normalization': ['launchOpts = launchOpts ?? {};', ''],
  'truthy-showcmd': ['showCmd: launchOpts.showCmd,', 'showCmd: launchOpts.showCmd || 1,'],
  'lose-queued-owner': ['pendingAppLaunches.push({ key, waitForExit, options });',
    'pendingAppLaunches.push({ key, waitForExit });'],
  'lose-restart-owner': ['options: launchOpts || {}, intent: null', 'options: {}, intent: null'],
};
const [before, after] = controls[process.argv[2]] || [];
if (!before) throw new Error('unknown control');
const target = path.resolve('lib/browser-shell.js');
const original = fs.readFileSync;
let hits = 0;
fs.readFileSync = function(file, ...args) {
  const data = original.call(this, file, ...args);
  if (path.resolve(String(file)) !== target) return data;
  const source = data.toString();
  if (source.split(before).length !== 2) throw new Error('mutation must be unique');
  hits++;
  const changed = source.replace(before, after);
  return typeof data === 'string' ? changed : Buffer.from(changed);
};
process.on('exit', () => { if (!hits) throw new Error('control never applied'); });
require(path.resolve('test/test-browser-launch-options.js'));
