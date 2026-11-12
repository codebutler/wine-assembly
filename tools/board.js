#!/usr/bin/env node
'use strict';

// Read-only view of the shared-agent message board.
//
// messageboard.txt has carried NUL bytes since August, so grep and tail treat
// it as binary ("Binary file matches") unless given -a. This reads it as text,
// strips the NULs and filters entries; it never opens the board for writing.
// Appends still go through `echo ... >> messageboard.txt` (see CLAUDE.md).
//
//   node tools/board.js [--tail=N] [--grep=PATTERN] [-i] [--since=ISO] [--file=PATH]
//
// Filters apply in order since -> grep -> tail. With no filter it prints the
// last 40 lines; with --grep or --since alone it prints every match.

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const ISO_STAMP = /^\[?(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?)/;

function readBoard(file) {
  return fs.readFileSync(file, 'utf8').replace(/\0/g, '').replace(/\r/g, '');
}

// One record per line, each with the time it was posted. A line with a full
// timestamp sets the clock; a date-only stamp ("[2026-10-23 coordinator]")
// cannot move it backwards inside that day; an unstamped line inherits the
// previous entry's time, so --since never drops a continuation line.
function parseEntries(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let clock = NaN;
  return lines.map(line => {
    const m = ISO_STAMP.exec(line);
    if (m) {
      const dateOnly = m[1].length === 10;
      const t = Date.parse(dateOnly ? m[1] + 'T00:00:00Z' : m[1].replace(' ', 'T'));
      if (!Number.isNaN(t) && (!dateOnly || Number.isNaN(clock) || t > clock)) clock = t;
    }
    return {line, time: clock};
  });
}

function filterEntries(entries, {since, grep, ignoreCase, tail} = {}) {
  let out = entries;
  if (since !== undefined) {
    const t = Date.parse(since);
    if (Number.isNaN(t)) throw new Error('--since is not an ISO time: ' + since);
    out = out.filter(e => e.time >= t);
  }
  if (grep !== undefined) {
    const re = new RegExp(grep, ignoreCase ? 'i' : '');
    out = out.filter(e => re.test(e.line));
  }
  if (tail !== undefined) out = tail > 0 ? out.slice(-tail) : [];
  return out.map(e => e.line);
}

// A worktree has no board of its own: the file is gitignored and lives in the
// main checkout, which is the parent of the shared git directory.
function defaultBoard() {
  const local = path.join(__dirname, '..', 'messageboard.txt');
  if (fs.existsSync(local)) return local;
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    return path.join(path.dirname(common), 'messageboard.txt');
  } catch { return local; }
}

function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/s.exec(arg);
    if (arg === '-i' || arg === '--ignore-case') opts.ignoreCase = true;
    else if (m && m[1] === 'tail' && /^\d+$/.test(m[2] || '')) opts.tail = Number(m[2]);
    else if (m && m[2] !== undefined && ['grep', 'since', 'file'].includes(m[1])) opts[m[1]] = m[2];
    else throw new Error('unknown argument: ' + arg +
      '\nusage: node tools/board.js [--tail=N] [--grep=PATTERN] [-i] [--since=ISO] [--file=PATH]');
  }
  if (opts.tail === undefined && opts.grep === undefined && opts.since === undefined) opts.tail = 40;
  return opts;
}

if (require.main === module) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const lines = filterEntries(parseEntries(readBoard(opts.file || defaultBoard())), opts);
    if (lines.length) process.stdout.write(lines.join('\n') + '\n');
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

module.exports = {readBoard, parseEntries, filterEntries, parseArgs};
