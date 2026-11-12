'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => digest(fs.readFileSync(file));
function inventory(base) {
  base = fs.realpathSync(base);
  const records = [], seen = new Set();
  function visit(file) {
    const real = fs.realpathSync(file);
    assert(real === base || real.startsWith(base + '/'), 'dependency escapes supplied directory: ' + file);
    if (seen.has(real)) return;
    seen.add(real);
    if (fs.statSync(real).isDirectory()) for (const name of fs.readdirSync(real).sort()) visit(path.join(real, name));
    else { assert(fs.statSync(real).isFile()); records.push({ path: real, sha256: hash(real) }); }
  }
  visit(base);
  assert(records.length, 'empty dependencies');
  return records;
}
function processIdentity(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  return { pid, startTime: stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19],
    command: fs.readFileSync(`/proc/${pid}/cmdline`).toString().replace(/\0/g, ' ').trim() };
}
function validateConfig(config, knownHashes) {
  assert.equal(config.version, 1);
  assert(path.isAbsolute(config.dependencies || ''), 'absolute dependencies required');
  assert(Array.isArray(config.donors) && config.donors.length, 'explicit donor inventory required');
  for (const item of config.donors) {
    assert(path.isAbsolute(item.path || ''));
    assert(knownHashes.includes(item.sha256), 'unreviewed donor hash');
    assert.equal(hash(item.path), item.sha256, item.path);
  }
  assert(Array.isArray(config.infrastructure), 'explicit infrastructure identities required');
  for (const item of config.infrastructure) {
    assert(Number.isSafeInteger(item.pid) && item.pid > 1);
    assert.match(item.startTime || '', /^\d+$/);
    assert.match(item.role || '', /^(dashboard|watchdog|codex)$/);
    assert.equal(typeof item.command, 'string');
    const patterns = {
      dashboard: /(?:^|\s)(?:\S*\/)?ops\/(?:server|hosting\/public-server)\.js(?:\s|$)/,
      watchdog: /(?:^|\s)(?:\S*\/)?ops\/(?:telegram|telegram-watchdog|work-watchdog)\.js(?:\s|$)/,
      codex: /(?:^|\s)\S*\bcodex(?:\s|$)/,
    };
    assert(patterns[item.role].test(item.command), 'unrecognized infrastructure command');
  }
  return config;
}
function admit(rows, infrastructure, self, identity = processIdentity) {
  const active = [];
  for (const row of rows) {
    if (row.pid === self) continue;
    // Build shells and browsers are never exempt, even if listed as infrastructure.
    const forbidden = /(?:^|[\s/])(?:chrome(?:-headless-shell)?|chromium|firefox|wat2wasm)(?:[\s/]|$)|(?:tools\/build(?:-\S+)?\.(?:sh|js)|test\/run\.js)/.test(row.command);
    const runtime = /^(node|MainThread|chrome.*|chromium.*|firefox|wat2wasm)$/.test(row.comm);
    if (!forbidden && !runtime) continue;
    const allowed = infrastructure.find(item => item.pid === row.pid);
    if (forbidden || !allowed) { active.push(row); continue; }
    const actual = identity(row.pid);
    if (actual.startTime !== allowed.startTime || actual.command !== allowed.command) active.push(row);
  }
  assert.deepEqual(active, [], 'sole runtime lane: competing or unrecognized process');
}
module.exports = { inventory, processIdentity, validateConfig, admit };
