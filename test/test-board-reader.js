'use strict';

// tools/board.js: NUL-stripped, read-only filtering of messageboard.txt.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {readBoard, parseEntries, filterEntries, parseArgs} = require('../tools/board');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-'));
const file = path.join(dir, 'messageboard.txt');
const board = [
  '2026-08-01T10:00:00+00:00 old CLAIM a',
  '\0\0\0\0',
  '2026-10-22T23:00:00+00:00 agentA CLAIM b',
  '[2026-10-23 coordinator] note after midnight',
  '2026-10-23T07:10:00+00:00 agentB DONE c',
  'continuation line without a stamp',
  '[2026-10-23 coordinator] date-only note posted after 07:10',
  '2026-10-23T07:30:00Z agentA RELEASE b',
  '',
].join('\n');
fs.writeFileSync(file, board);
const before = fs.readFileSync(file);

const text = readBoard(file);
assert.ok(!text.includes('\0'), 'NULs stripped');
const entries = parseEntries(text);
assert.equal(entries.length, 8);

// Unstamped and date-only lines inherit the clock instead of rewinding it.
assert.deepEqual(filterEntries(entries, {since: '2026-10-23T07:00:00Z'}), [
  '2026-10-23T07:10:00+00:00 agentB DONE c',
  'continuation line without a stamp',
  '[2026-10-23 coordinator] date-only note posted after 07:10',
  '2026-10-23T07:30:00Z agentA RELEASE b',
]);
// A date-only stamp on a new day does advance the clock to that midnight.
assert.deepEqual(filterEntries(entries, {since: '2026-10-23T00:00:00Z', grep: 'midnight'}),
  ['[2026-10-23 coordinator] note after midnight']);

assert.deepEqual(filterEntries(entries, {grep: 'agenta', ignoreCase: true, tail: 1}),
  ['2026-10-23T07:30:00Z agentA RELEASE b']);
assert.deepEqual(filterEntries(entries, {grep: 'agenta'}), []);
assert.equal(filterEntries(entries, {tail: 3}).length, 3);
assert.throws(() => filterEntries(entries, {since: 'yesterday'}), /ISO/);

assert.deepEqual(parseArgs([]), {tail: 40});
assert.deepEqual(parseArgs(['--grep=CLAIM', '-i']), {grep: 'CLAIM', ignoreCase: true});
assert.throws(() => parseArgs(['--tail=x']), /unknown argument/);

// CLI end to end, and the board is never modified.
const out = execFileSync(process.execPath,
  [path.join(__dirname, '..', 'tools', 'board.js'), '--file=' + file, '--grep=CLAIM', '--tail=1'],
  {encoding: 'utf8'});
assert.equal(out, '2026-10-22T23:00:00+00:00 agentA CLAIM b\n');
assert.ok(fs.readFileSync(file).equals(before), 'board bytes unchanged');

fs.rmSync(dir, {recursive: true});
console.log('test-board-reader: OK');
