#!/usr/bin/env node
'use strict';

// Exercise the original VB1 form through ordinary renderer input. A title
// change is the game's own acceptance of the text, not a test-written level.
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const args = ['--app=wep16_rodent', '--no-close', '--batch-size=2000',
  '--max-batches=1900', '--max-seconds=20', '--quiet-api', '--quiet-blocks',
  '--input=200:click:300:55,500:click:253:71,520:click:270:92,' +
  '900:dump-windows,1000:click:320:185,1010:keydown:36,1011:keyup:36,' +
  '1020:keydown:46,1021:keyup:46,1050:keypress:50,1060:keypress:53,' +
  '1100:click:275:217,1200:dump-windows,' +
  '1300:click:253:71,1320:click:270:92,1450:dump-windows,' +
  '1500:click:320:185,1510:keypress:49,1600:click:365:217,1800:dump-windows'];
if (process.env.WINE_ASSEMBLY_WASM) args.push('--no-build', `--wasm=${process.env.WINE_ASSEMBLY_WASM}`);
const output = execFileSync(process.execPath, [path.join(root, 'test/run.js'), ...args],
  { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
assert.doesNotMatch(output, /\*\*\* CRASH|UNIMPLEMENTED API|RuntimeError|Overflow/);
assert.match(output, /class="ThunderTextBox" ctrlClass=2[^\n]*title="1" at batch 900/,
  'the original level textbox must acquire native EDIT state');
assert.match(output, /title="Rodent's Revenge \[25\]" at batch 1200/,
  'OK must pass the typed level to the real game');
assert.match(output, /class="ThunderTextBox" ctrlClass=2[^\n]*title="25" at batch 1450/,
  'reopening must initialize the textbox from the accepted level');
assert.match(output, /title="Rodent's Revenge \[25\]" at batch 1800/,
  'Cancel must retain the accepted level');
console.log('PASS original Rodent level: type 25, OK, reopen 25, edit and Cancel');
