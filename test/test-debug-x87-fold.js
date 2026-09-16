#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
const exportsWat = fs.readFileSync(path.join(root, 'src', '13-exports.wat'), 'utf8');

const toggle = html.match(/<input id="x87-fold-toggle"[^>]*>/);
assert(toggle, 'debug toolbar exposes the x87 fold toggle');
assert(!/(?:^|\s)checked(?:\s|>)/.test(toggle[0]), 'x87 fold remains default off');
assert(toggle[0].includes('onchange="setX87Fusion(this.checked)"'),
  'the toolbar updates the launch-time x87 setting');
assert(html.includes("has('x87-fold')"), 'the x87-fold URL opt-in is available to browser probes');

for (const setter of ['set_x87_pipeline4_fusion', 'set_x87_affine_fusion']) {
  assert(exportsWat.includes(`(export "${setter}")`), `${setter} is exported by the guest`);
  assert(host.includes(`this.instance.exports.${setter}(x87Fusion)`),
    `${setter} configures the browser-thread instance before decode`);
  assert(host.includes(`await this.guestWorker.callExport('${setter}', x87Fusion)`),
    `${setter} configures the live slot-0 Worker instance`);
  assert(host.includes(`recordInheritedWasmGlobal('${setter}', x87Fusion)`),
    `${setter} is inherited by future guest-thread instances`);
}

console.log('PASS  debug x87 fold is explicit, default-off, and process-wide');
