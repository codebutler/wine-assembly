#!/usr/bin/env node
'use strict';

// Read a game's SHIPPED default key bindings, for touch layouts that have to
// press the keys the game itself expects (MOBILE-L1-FPS-20261011).
//
//   node tools/game-default-binds.js DIR [--json]
//
// Looks under DIR for the config files a game ships with -- loose, inside a
// Quake .pak (PACK) or inside a Quake III / Unreal-era .pk3 (zip) -- and
// reports:
//   * Quake-family `bind KEY "command"` lines (default.cfg, config.cfg,
//     autoexec.cfg, *.cfg), resolved to the actions a touch layout needs
//     (move/strafe/attack/jump/crouch/use/weapon) with the Windows VK or mouse
//     button each key means;
//   * Unreal-family [Engine.Input] / [*.PlayerPawn] `Key=Action` lines from
//     User.ini / Default.ini / DefUser.ini;
//   * any other config file whose lines look like key bindings, verbatim, for
//     a human to map (LithTech autoexec.cfg, game-specific .ini).
//
// A layout should cite this output (or the game's manual) for every binding;
// guessing a game's keys is how a phone ends up with a Fire button that jumps.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CONFIG_NAME = /(^|\/)(default|config|autoexec|keys?|controls?|user|defuser|defaults?)[^/]*\.(cfg|ini|con|txt)$|\.cfg$/i;

// Quake key names -> Windows VK (mouse buttons are reported separately).
const QUAKE_KEYS = {
  TAB: 0x09, ENTER: 0x0D, ESCAPE: 0x1B, SPACE: 0x20, BACKSPACE: 0x08,
  UPARROW: 0x26, DOWNARROW: 0x28, LEFTARROW: 0x25, RIGHTARROW: 0x27,
  ALT: 0x12, CTRL: 0x11, SHIFT: 0x10, INS: 0x2D, DEL: 0x2E,
  PGDN: 0x22, PGUP: 0x21, HOME: 0x24, END: 0x23, PAUSE: 0x13,
  KP_UPARROW: 0x68, KP_DOWNARROW: 0x62, KP_LEFTARROW: 0x64, KP_RIGHTARROW: 0x66,
  KP_HOME: 0x67, KP_END: 0x61, KP_PGUP: 0x69, KP_PGDN: 0x63, KP_5: 0x65,
  KP_INS: 0x60, KP_DEL: 0x6E, KP_ENTER: 0x0D, KP_SLASH: 0x6F, KP_MINUS: 0x6D, KP_PLUS: 0x6B,
  SEMICOLON: 0xBA, '`': 0xC0, '~': 0xC0, '-': 0xBD, '=': 0xBB, '[': 0xDB, ']': 0xDD,
  '\\': 0xDC, "'": 0xDE, ',': 0xBC, '.': 0xBE, '/': 0xBF,
};
// Unreal-engine EInputKey names that differ from Quake's.
Object.assign(QUAKE_KEYS, {
  UP: 0x26, DOWN: 0x28, LEFT: 0x25, RIGHT: 0x27, ESCAPE: 0x1B, CAPSLOCK: 0x14,
  PAGEUP: 0x21, PAGEDOWN: 0x22, INSERT: 0x2D, DELETE: 0x2E, COMMA: 0xBC, PERIOD: 0xBE,
  SLASH: 0xBF, SINGLEQUOTE: 0xDE, BACKSLASH: 0xDC, TILDE: 0xC0, EQUALS: 0xBB, MINUS: 0xBD,
  LEFTBRACKET: 0xDB, RIGHTBRACKET: 0xDD, GREYPLUS: 0x6B, GREYMINUS: 0x6D,
});
// Kingpin's spellings.
Object.assign(QUAKE_KEYS, { U_ARROW: 0x26, D_ARROW: 0x28, L_ARROW: 0x25, R_ARROW: 0x27, ESC: 0x1B });
for (let i = 0; i < 10; i++) QUAKE_KEYS[`NUMPAD${i}`] = 0x60 + i;
QUAKE_KEYS.NUMPADPERIOD = 0x6E;
const MOUSE = { MOUSE1: 0, MOUSE2: 2, MOUSE3: 1, LEFTMOUSE: 0, RIGHTMOUSE: 2, MIDDLEMOUSE: 1 };

// DirectInput scancode -> Windows VK, for LithTech's `rangebind "##Keyboard"
// "##N"` lines (Blood 2, Die Hard Nakatomi, ...).
const DIK_VK = {
  0x01: 0x1B, 0x0C: 0xBD, 0x0D: 0xBB, 0x0E: 0x08, 0x0F: 0x09, 0x1A: 0xDB, 0x1B: 0xDD,
  0x1C: 0x0D, 0x1D: 0x11, 0x27: 0xBA, 0x28: 0xDE, 0x29: 0xC0, 0x2A: 0x10, 0x2B: 0xDC,
  0x33: 0xBC, 0x34: 0xBE, 0x35: 0xBF, 0x36: 0x10, 0x38: 0x12, 0x39: 0x20,
  0x47: 0x67, 0x48: 0x68, 0x49: 0x69, 0x4B: 0x64, 0x4C: 0x65, 0x4D: 0x66, 0x4F: 0x61,
  0x50: 0x62, 0x51: 0x63, 0x52: 0x60, 0x53: 0x6E, 0x57: 0x7A, 0x58: 0x7B,
  0x9C: 0x0D, 0x9D: 0x11, 0xB8: 0x12, 0xC7: 0x24, 0xC8: 0x26, 0xC9: 0x21, 0xCB: 0x25,
  0xCD: 0x27, 0xCF: 0x23, 0xD0: 0x28, 0xD1: 0x22, 0xD2: 0x2D, 0xD3: 0x2E,
};
'1234567890'.split('').forEach((c, i) => { DIK_VK[0x02 + i] = c.charCodeAt(0); });
['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach((row, r) => row.split('').forEach((c, i) => {
  DIK_VK[[0x10, 0x1E, 0x2C][r] + i] = c.charCodeAt(0);
}));
for (let i = 0; i < 10; i++) DIK_VK[0x3B + i] = 0x70 + i;

function dikTarget(code) {
  return code in DIK_VK ? { vk: DIK_VK[code], dik: code } : null;
}

function keyTarget(name) {
  const up = String(name).toUpperCase();
  if (up in MOUSE) return { mouseButton: MOUSE[up] };
  if (up in QUAKE_KEYS) return { vk: QUAKE_KEYS[up] };
  if (/^F([1-9]|1[0-2])$/.test(up)) return { vk: 0x6F + Number(up.slice(1)) };
  if (/^[A-Z0-9]$/.test(up)) return { vk: up.charCodeAt(0) };
  if (name.length === 1 && name in QUAKE_KEYS) return { vk: QUAKE_KEYS[name] };
  return null;
}

// Which touch action a Quake command serves.
function quakeAction(cmd) {
  const c = cmd.toLowerCase().replace(/^\+/, '+');
  const table = [
    [/^\+forward$/, 'forward'], [/^\+back$/, 'back'],
    [/^\+moveleft$/, 'strafeLeft'], [/^\+moveright$/, 'strafeRight'],
    [/^\+left$/, 'turnLeft'], [/^\+right$/, 'turnRight'],
    [/^\+attack$/, 'attack'], [/^\+(jump|moveup)$/, 'jump'],
    [/^\+(movedown|crouch|duck)$/, 'crouch'], [/^\+(use|activate|button2)$/, 'use'],
    [/^(weapnext|impulse 10|weapon_next)$/, 'weaponNext'], [/^\+(speed)$/, 'run'],
    [/^\+(strafe)$/, 'strafe'], [/^\+(mlook|klook)$/, 'look'],
    [/^(inven|invuse|invnext|\+invuse)$/, 'inventory'], [/^(togglemenu|menu_main)$/, 'menu'],
  ];
  for (const [re, action] of table) if (re.test(c)) return action;
  return null;
}

function readPak(buf, out, base) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'PACK') return;
  const dirofs = buf.readUInt32LE(4), dirlen = buf.readUInt32LE(8);
  for (let p = dirofs; p + 64 <= dirofs + dirlen && p + 64 <= buf.length; p += 64) {
    const name = buf.toString('latin1', p, p + 56).replace(/\0.*$/, '');
    const pos = buf.readUInt32LE(p + 56), len = buf.readUInt32LE(p + 60);
    if (CONFIG_NAME.test(name) && pos + len <= buf.length) out.push({ file: `${base}:${name}`, text: buf.toString('latin1', pos, pos + len) });
  }
}

function readZip(buf, out, base) {
  // End of central directory: scan back for PK\5\6.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 0x10016); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('latin1', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!CONFIG_NAME.test(name) || local + 30 > buf.length) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    try {
      const text = (method === 0 ? data : zlib.inflateRawSync(data)).toString('latin1');
      out.push({ file: `${base}:${name}`, text });
    } catch (_) { /* unsupported method: skip */ }
  }
}

function collect(dir) {
  const out = [];
  const walk = (d, depth) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(d, e.name), rel = path.relative(dir, full);
      if (e.isDirectory()) { if (depth < 5) walk(full, depth + 1); continue; }
      const lower = e.name.toLowerCase();
      if (lower.endsWith('.pak')) readPak(fs.readFileSync(full), out, rel);
      else if (lower.endsWith('.pk3')) readZip(fs.readFileSync(full), out, rel);
      else if (lower.endsWith('.ctl') && /(^|\/)controls\//i.test(rel.replace(/\\/g, '/'))) {
        out.push({ file: rel, text: fs.readFileSync(full, 'latin1') });
      }
      else if (CONFIG_NAME.test(rel.replace(/\\/g, '/')) && fs.statSync(full).size < 512 * 1024) {
        out.push({ file: rel, text: fs.readFileSync(full, 'latin1') });
      }
    }
  };
  walk(dir, 0);
  return out;
}

function analyse(files) {
  const quake = [], unreal = [], lithtech = [], serious = [], other = [];
  for (const { file, text } of files) {
    // Serious Engine Controls/*.ctl: "Button / Name: X / Key1: K / Key2: K".
    if (/\.ctl$/i.test(file)) {
      for (const block of text.split(/^Button\s*$/m)) {
        const name = (block.match(/^\s*Name:\s*(.+)$/m) || [])[1];
        if (!name) continue;
        const keys = ['Key1', 'Key2'].map(k => ((block.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'm')) || [])[1] || '').trim())
          .filter(k => k && k !== 'None');
        serious.push({ file, command: name.replace(/^TTRS /, '').trim(), keys });
      }
      continue;
    }
    let section = '';
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      const sec = line.match(/^\[(.+)\]$/);
      if (sec) { section = sec[1]; continue; }
      const range = line.match(/^rangebind\s+"##(Keyboard|Mouse)"\s+"##(button\s+)?(\d+)"\s+\S+\s+\S+\s+"([^"]+)"/i);
      if (range) {
        const [, device, buttonWord, num, action] = range;
        const n = Number(num);
        // "##button N" counts buttons; a bare "##N" counts DirectInput mouse
        // objects, where 0-2 are the X/Y/wheel axes and buttons start at 3.
        // DirectInput button 1 is the RIGHT button, our mouseButton 2.
        let target = null, key = `${device.toLowerCase()} ${n}`;
        if (/mouse/i.test(device)) {
          const b = buttonWord ? n : n - 3;
          target = b >= 0 ? { mouseButton: [0, 2, 1][b] ?? b } : null;
          key = b >= 0 ? `mouse button ${b}` : `mouse axis ${n}`;
        } else target = dikTarget(n);
        lithtech.push({ file, key, command: action, target });
        continue;
      }
      const bind = line.match(/^bind\s+("?)([^"\s]+)\1\s+"?([^"]+?)"?\s*(\/\/.*)?$/i);
      if (bind) {
        const [, , key, cmd] = bind;
        quake.push({ file, key, command: cmd, action: quakeAction(cmd), target: keyTarget(key) });
        continue;
      }
      if (/Input|PlayerPawn|Console/i.test(section) && /^[A-Za-z0-9]+=.+/.test(line)) {
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
        if (value && !/^\s*$/.test(value)) unreal.push({ file, section, key, command: value, target: keyTarget(key) });
        continue;
      }
      if (/\b(key|bind|button|fire|jump|forward|strafe)\b/i.test(line) && line.length < 200) other.push({ file, line });
    }
  }
  return { quake, unreal, lithtech, serious, other };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: node tools/game-default-binds.js DIR [--json]'); process.exit(2); }
  const files = collect(dir);
  const result = analyse(files);
  if (args.includes('--json')) { console.log(JSON.stringify({ files: files.map(f => f.file), ...result }, null, 1)); return; }
  console.log(`config files: ${files.map(f => f.file).join(', ') || '(none)'}`);
  const show = t => t ? (t.mouseButton !== undefined ? `mouse${t.mouseButton}` : `vk 0x${t.vk.toString(16).toUpperCase()}`) : '?';
  const acted = result.quake.filter(b => b.action);
  if (acted.length) {
    console.log('\nQuake binds (touch actions):');
    for (const b of acted) console.log(`  ${b.action.padEnd(12)} ${b.key.padEnd(12)} ${show(b.target).padEnd(10)} ${b.command}   [${b.file}]`);
  }
  if (result.unreal.length) {
    console.log('\nUnreal-style input lines:');
    for (const b of result.unreal.filter(b => /Move|Strafe|Fire|Jump|Duck|Use|Turn|Look|Walk|Weapon/i.test(b.command)).slice(0, 60)) {
      console.log(`  ${b.key.padEnd(12)} ${show(b.target).padEnd(10)} ${b.command}   [${b.file} ${b.section}]`);
    }
  }
  if (result.lithtech.length) {
    console.log('\nLithTech rangebind lines:');
    const seen = new Set();
    for (const b of result.lithtech) {
      const k = `${b.key}=${b.command}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`  ${b.command.padEnd(14)} ${b.key.padEnd(14)} ${show(b.target).padEnd(10)}   [${b.file}]`);
    }
  }
  if (result.serious.length) {
    console.log('\nSerious Engine controls (.ctl):');
    for (const b of result.serious.filter(b => b.keys.length && /default/i.test(b.file))) {
      console.log(`  ${b.command.padEnd(28)} ${b.keys.join(' | ').padEnd(30)} [${b.file}]`);
    }
  }
  if (!acted.length && !result.unreal.length && !result.lithtech.length && !result.serious.length && result.other.length) {
    console.log('\nOther binding-like lines (map by hand):');
    for (const o of result.other.slice(0, 60)) console.log(`  ${o.line}   [${o.file}]`);
  }
}

if (require.main === module) main();
module.exports = { collect, analyse, keyTarget, quakeAction };
