#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const hostJs = fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const deployJs = fs.readFileSync(path.join(ROOT, 'tools/deploy-berrry.js'), 'utf8');
const rendererJs = fs.readFileSync(path.join(ROOT, 'lib/renderer.js'), 'utf8');

assert(hostJs.includes("build/wine-assembly.wasm"),
  'host should fetch prebuilt wine-assembly.wasm');
assert(hostJs.includes("build/wine-assembly.compat.wasm"),
  'host should fetch prebuilt compat wasm when tail calls unavailable');
assert(hostJs.includes('resolveWasmMode'),
  'host should expose wasm mode resolution');
assert(hostJs.includes("mode === 'compile'"),
  'host should support ?wasm=compile force path');
assert(hostJs.includes('beginLaunchTiming'),
  'host should expose launch timing helper');
assert(hostJs.includes("mark('wasm_ready')") || hostJs.includes("_markLaunch('wasm_ready')"),
  'host should mark wasm_ready');
assert(hostJs.includes('falling back to WAT compile'),
  'host should fall back to WAT compile when prebuilt missing');

assert(rendererJs.includes("first_composite"),
  'renderer should mark first_composite');
assert(rendererJs.includes("show_window"),
  'renderer should mark show_window');
assert(rendererJs.includes('run_start'),
  'renderer should ignore paint marks before run_start');

assert(indexHtml.includes('beginLaunchTiming'),
  'index.html should start launch timing on Launch');
assert(indexHtml.includes('window.launchApp = launchApp'),
  'index.html should export launchApp for CDP/autolaunch');
assert(indexHtml.includes('autolaunch'),
  'index.html should support ?autolaunch=1');

assert(deployJs.includes("build/wine-assembly.wasm"),
  'deploy should ship prebuilt wasm');
assert(deployJs.includes('collectPrebuiltWasm'),
  'deploy should collect prebuilt wasm from build/');

console.log('PASS  web prebuilt wasm + launch timing hooks present');
