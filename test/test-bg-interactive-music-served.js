#!/usr/bin/env node
'use strict';

// BG-FETCH-IS5-20261011: the Baldur's Gate interactive demo's browser file
// list left out its adaptive-music ACM stems as "optional". The .mus
// playlists it does serve name them, and with them absent the game asserts at
// character generation (ChVidPal.cpp line 1095) and exits -- in every browser,
// while the CLI, which mounts the whole tree, never saw it. The stems are
// served now, and eagerly: streamed (httpRange) the assertion came back on the
// WebKit phone route, so they must be resident before character generation.

const assert = require('assert');
const { APPS } = require('../lib/apps');
const { normalizeLazyFiles } = require('../lib/app-files');

const app = APPS.baldurs_gate_interactive_demo;
const stems = app.files.filter(f => /^c:\\music\\[^\\]+\\[^\\]+\.acm$/i.test(f.vfsPath || ''));
assert.strictEqual(stems.length, 215, 'every Music/<folder>/*.ACM stem of the install is served');
assert.strictEqual(new Set(stems.map(f => f.vfsPath.toLowerCase())).size, stems.length, 'no stem is listed twice');
assert.ok(stems.every(f => f.httpRange === undefined && f.loadMode === undefined), 'no stem opts into streaming');
for (const playlist of ['Theme', 'Chapter', 'CDay1']) {
  assert.ok(app.files.some(f => f.vfsPath.toLowerCase() === `c:\\music\\${playlist.toLowerCase()}.mus`),
    `${playlist}.mus is still served`);
}

// The lazy-file policy keeps them eager: '.acm' is an eager extension.
const { files } = normalizeLazyFiles(app, app.files, { sizeOf: () => 1 << 20 });
const normalizedStems = files.filter(f => /\.acm$/i.test(f.url));
assert.strictEqual(normalizedStems.length, 215);
assert.ok(normalizedStems.every(f => f.httpRange !== true && f.loadMode !== 'lazy'), 'the lazy-file policy loads the stems eagerly');

console.log('PASS  BG interactive demo serves its 215 music stems, eagerly');
