#!/usr/bin/env node
'use strict';

// Which registered games a phone can actually play, and what each still needs.
//
//   node tools/mobile-controls-census.js [--runs=DIR] [--binaries=ROOT[,ROOT...]] [--all] [--tsv=OUT]
//
// A phone produces taps and drags and nothing else, so a game with no
// `touchControls` is only playable there if a tap on the picture is all it
// asks for. This joins three things per registry app:
//
//   * the phone settings lib/apps.js ships: touchControls (which widget kinds),
//     relativeMouse, mobileTouch;
//   * reviewed gameplay: the newest scratch/runs/*/result.json for the app
//     with outcome "passed" and verification "reviewed" (by candidateId);
//   * input evidence: which input APIs the app's modules name (a byte search,
//     like tools/gfx-app-census.js: proof the name is present, NOT that the
//     game polls it in play), plus the input words of its re-notes file.
//
// From those it proposes an input style and a status. The style is a lead for
// a person to confirm, not a verdict: a keyboard game reached through
// WM_KEYDOWN imports nothing special, and DirectInput may only read the mouse.
// By default only apps with reviewed gameplay are listed; --all lists every
// registry app.

const fs = require('fs');
const path = require('path');
const { APPS, DESKTOP_APPS } = require('../lib/apps.js');

const ROOT = path.join(__dirname, '..');

// Name -> what its presence suggests. Searched as latin1 substrings; DLL names
// case-insensitively, because import tables spell them as the linker liked.
const INPUT_APIS = [
  ['dinput', 'dll', 'dinput.dll'],
  ['dinput8', 'dll', 'dinput8.dll'],
  ['GetAsyncKeyState', 'name', 'GetAsyncKeyState'],
  ['GetKeyState', 'name', 'GetKeyState'],
  ['GetKeyboardState', 'name', 'GetKeyboardState'],
  ['joyGetPos', 'name', 'joyGetPos'],
  ['SetCursorPos', 'name', 'SetCursorPos'],
  ['ClipCursor', 'name', 'ClipCursor'],
  ['SetCapture', 'name', 'SetCapture'],
];

const NOTE_WORDS = [
  ['directinput', /directinput|getdevicestate|dimousestate|dikeyboard/i],
  ['arrows', /arrow keys?|\bvk_(left|right|up|down)\b|cursor keys/i],
  ['wasd', /\bwasd\b/i],
  ['mouselook', /mouse[- ]?look|relative mouse|pointer lock|relmousemove/i],
  ['mouse', /\bclick|mousedown|\bdrag/i],
  ['keyboard', /keydown|keypress|\bkey\b|hotkey/i],
  ['joystick', /joystick|gamepad/i],
];

function flag(argv, name) {
  const hit = argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
}

// --binaries=ROOT,... reads the guest binaries from other checkouts' roots (a
// sparse worktree has none of its own, and a box keeps fixtures where it can);
// the first root that has the file wins.
let BIN_ROOTS = [ROOT];
function resolveRel(rel) {
  const under = root => rel.startsWith('binaries/') ? path.join(root, 'test', rel) : path.join(root, rel);
  return BIN_ROOTS.map(under).find(p => fs.existsSync(p)) || under(BIN_ROOTS[0]);
}

function modulesOf(app) {
  return [app.exe, ...(app.dlls || [])].filter(Boolean).map(resolveRel);
}

function scanInput(app) {
  const found = new Set();
  let scanned = 0;
  for (const abs of modulesOf(app)) {
    let buffer;
    try { buffer = fs.readFileSync(abs); } catch { continue; }
    if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5a4d) continue;
    scanned++;
    const lower = buffer.toString('latin1').toLowerCase();
    for (const [key, how, needle] of INPUT_APIS) {
      if (how === 'dll' ? lower.includes(needle) : buffer.indexOf(needle, 0, 'latin1') >= 0) found.add(key);
    }
  }
  return { scanned, apis: [...found] };
}

function touchSummary(app) {
  const tc = app.touchControls;
  if (!tc) return '';
  const kinds = [];
  if (tc.dpad) kinds.push(`dpad${tc.dpad.ways ? tc.dpad.ways : ''}`);
  if (tc.mouseJoystick) kinds.push('mouseJoystick');
  if (Array.isArray(tc.buttons) && tc.buttons.length) kinds.push(`buttons${tc.buttons.length}`);
  if (Array.isArray(tc.zones) && tc.zones.length) kinds.push(`zones${tc.zones.length}`);
  if (tc.swipe || tc.swipes) kinds.push('swipe');
  for (const key of Object.keys(tc)) {
    if (!['dpad', 'mouseJoystick', 'buttons', 'zones', 'swipe', 'swipes'].includes(key)) kinds.push(key);
  }
  return kinds.join('+');
}

function reviewedRuns(runsDir) {
  const best = new Map();
  let dirs = [];
  try { dirs = fs.readdirSync(runsDir); } catch { return best; }
  for (const dir of dirs) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(runsDir, dir, 'result.json'), 'utf8')); } catch { continue; }
    if (!raw || raw.outcome !== 'passed' || raw.verification !== 'reviewed') continue;
    const id = raw.candidateId;
    if (typeof id !== 'string' || !APPS[id]) continue;
    const at = String(raw.finishedAt || raw.startedAt || '');
    const prev = best.get(id);
    if (prev && prev.at >= at) continue;
    const shots = Array.isArray(raw.gameplayScreenshots) && raw.gameplayScreenshots.length
      ? raw.gameplayScreenshots : [raw.screenshot].filter(Boolean);
    best.set(id, { at, dir, shot: shots[0] || '', route: String(raw.route || '').slice(0, 80) });
  }
  return best;
}

let _notes;
function notesFor(id, app) {
  if (!_notes) {
    const dir = path.join(ROOT, 'docs', 're-notes');
    _notes = [];
    try {
      for (const name of fs.readdirSync(dir)) {
        if (name.endsWith('.md')) _notes.push([name, fs.readFileSync(path.join(dir, name), 'utf8')]);
      }
    } catch { /* sparse checkout without docs */ }
  }
  const exe = app.exe ? path.basename(app.exe).toLowerCase() : null;
  const hit = _notes.find(([, text]) => text.includes(`\`${id}\``))
    || _notes.find(([name]) => name.replace(/\.md$/, '').replace(/-/g, '_') === id)
    || (exe && _notes.find(([, text]) => text.toLowerCase().includes(exe)));
  if (!hit) return { file: '', words: [] };
  return { file: hit[0], words: NOTE_WORDS.filter(([, re]) => re.test(hit[1])).map(([k]) => k) };
}

// A proposal from the evidence, in the order a person would reason.
function proposeStyle(app, apis, words) {
  if (app.relativeMouse === true || words.includes('mouselook')) return 'mouse-look';
  const keys = apis.includes('GetAsyncKeyState') || apis.includes('GetKeyboardState') ||
    words.includes('arrows') || words.includes('wasd');
  const di = apis.includes('dinput') || apis.includes('dinput8') || words.includes('directinput');
  if (keys && di) return 'keyboard+directinput';
  if (keys) return 'keyboard';
  if (di) return 'directinput';
  return 'mouse/unknown';
}

function status(app, style) {
  if (app.touchControls) return 'has-layout';
  if (/\.scr$/i.test(app.exe || '')) return 'none-needed:screensaver';
  if (style === 'mouse/unknown') return 'check:tap-only?';
  return 'needs-layout';
}

function main(argv) {
  const runsDir = path.resolve(ROOT, flag(argv, 'runs') || 'scratch/runs');
  const all = !!flag(argv, 'all');
  if (typeof flag(argv, 'binaries') === 'string') BIN_ROOTS = flag(argv, 'binaries').split(',').map(p => path.resolve(p));
  const runs = reviewedRuns(runsDir);
  const rows = [];
  for (const [id, app] of Object.entries(APPS)) {
    const run = runs.get(id);
    if (!all && !run) continue;
    const { scanned, apis } = scanInput(app);
    const notes = notesFor(id, app);
    const style = proposeStyle(app, apis, notes.words);
    rows.push({
      id, name: app.name || app.title || '', public: DESKTOP_APPS.includes(id) ? 'yes' : 'no',
      localOnly: app.localOnly ? 'yes' : '', touch: touchSummary(app),
      relativeMouse: app.relativeMouse === undefined ? '' : String(app.relativeMouse),
      mobileTouch: app.mobileTouch || '', modules: scanned ? String(scanned) : 'missing',
      apis: apis.join(','), notes: notes.file, words: notes.words.join(','),
      style, status: status(app, style),
      reviewedRun: run ? run.dir : '', shot: run ? run.shot : '',
    });
  }
  rows.sort((a, b) => a.status.localeCompare(b.status) || a.id.localeCompare(b.id));
  const cols = Object.keys(rows[0] || { id: 1 });
  const tsv = [cols.join('\t'), ...rows.map(r => cols.map(c => r[c]).join('\t'))].join('\n') + '\n';
  const out = flag(argv, 'tsv');
  if (typeof out === 'string') fs.writeFileSync(out, tsv);
  else process.stdout.write(tsv);
  const count = {};
  for (const r of rows) count[r.status] = (count[r.status] || 0) + 1;
  console.error(`[mobile-controls-census] ${rows.length} apps (${all ? 'all' : 'reviewed gameplay'}): ` +
    Object.entries(count).map(([k, v]) => `${k} ${v}`).join(', '));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scanInput, touchSummary, proposeStyle, reviewedRuns };
