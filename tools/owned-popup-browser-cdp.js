#!/usr/bin/env node
'use strict';
// Invoked by test-owned-popup-browser-cdp.py, which owns resource admission,
// wall/aggregate CPU bounds and subreaper cleanup (including detached helpers).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const [output, rendererPath, mutation = 'none'] = process.argv.slice(2);
if (!output || !rendererPath || !['none', 'gpu-offset', 'single-clip'].includes(mutation))
  throw new Error('Use the Python supervisor: OUTPUT RENDERER [none|gpu-offset|single-clip]');
const root = path.resolve(__dirname, '..');
let renderer = fs.readFileSync(rendererPath, 'utf8');
const sourceHash = crypto.createHash('sha256').update(renderer).digest('hex');
function replaceOnce(needle, replacement) {
  assert.equal(renderer.split(needle).length, 2, 'mutation must match exactly once');
  renderer = renderer.replace(needle, replacement);
}
if (mutation === 'gpu-offset') replaceOnce('_frameLayerOffset(win, layer) {',
  '_frameLayerOffset(win, layer) { return {x:0,y:0};');
if (mutation === 'single-clip') replaceOnce('const y = pos.y - topPos.y;\n      const clip = this._clipRectForChildSurface(child);',
  'const y = pos.y - topPos.y;\n      const clip = null;');
const executedHash = crypto.createHash('sha256').update(renderer).digest('hex');
const profile = path.join(output, 'profile');
fs.mkdirSync(profile, { recursive: true });
const log = fs.openSync(path.join(output, 'chrome.log'), 'w');
const chrome = spawn(process.env.CHROME || '/opt/google/chrome/chrome', [
  '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  // Installed BetterChromium otherwise launches a timezone network probe.
  // Pin ordinary locale configuration; retain its sandbox/security controls.
  '--bw-timezone=Etc/UTC',
  '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--disk-cache-size=1048576', '--media-cache-size=1048576', '--js-flags=--max-old-space-size=256',
  'about:blank',
], { stdio: ['ignore', log, log], env: { ...process.env, TMPDIR: output, XDG_CONFIG_HOME: path.join(output, 'config') } });
let spawnError;
chrome.on('error', e => { spawnError = e; });
const delay = ms => new Promise(r => setTimeout(r, ms));
async function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data), p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  const rejectAll = () => { for (const p of pending.values()) p.reject(new Error('CDP disconnected')); pending.clear(); };
  ws.addEventListener('close', rejectAll);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return { close: () => ws.close(), send(method, params = {}) {
    const n = ++id;
    return new Promise((resolve, reject) => { pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  } };
}
let cdp;
async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  const start = Date.now();
  while (!fs.existsSync(portFile)) {
    if (spawnError) throw spawnError;
    if (chrome.exitCode !== null || chrome.signalCode) throw new Error(`Chrome exited before CDP: ${chrome.exitCode}/${chrome.signalCode}; see chrome.log`);
    if (Date.now() - start > 20000) throw new Error('Chrome CDP startup timed out');
    await delay(50);
  }
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  assert(port > 0 && port <= 65535);
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  assert(response.ok);
  const targets = await response.json();
  const page = targets.find(t => t.type === 'page' && t.url === 'about:blank');
  assert(page, 'Expected blank page target');
  const url = new URL(page.webSocketDebuggerUrl);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'CDP must stay local');
  cdp = await connect(url.href);
  async function evaluate(expression) {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  await evaluate(fs.readFileSync(path.join(root, 'lib/surface.js'), 'utf8'));
  await evaluate(renderer);
  const result = await evaluate(fs.readFileSync(path.join(root, 'test/fixtures/owned-popup-browser-pixels.js'), 'utf8'));
  assert(Array.isArray(result.checks) && result.checks.length >= 30, 'Missing pixel assertions');
  for (const img of result.images) {
    assert(/^[a-z-]+$/.test(img.name));
    const png = Buffer.from(img.png, 'base64');
    assert(png.length < 65536, 'PNG exceeds fixture bound');
    fs.writeFileSync(path.join(output, `${img.name}.png`), png);
  }
  delete result.images;
  Object.assign(result, { sourceHash, executedHash, mutation, rendererPath: path.resolve(rendererPath),
    browser: await evaluate('navigator.userAgent'), node: process.version });
  fs.writeFileSync(path.join(output, 'pixels.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, failed: result.failed, mutation,
    failures: result.checks.filter(c => !c.pass).map(c => c.name) }));
  process.exitCode = result.failed ? 1 : 0;
}
main().catch(e => { console.error(e.stack); process.exitCode = 2; }).finally(async () => {
  if (cdp) cdp.close();
  chrome.kill('SIGTERM');
  await Promise.race([new Promise(r => chrome.once('exit', r)), delay(1000)]);
  // The supervisor subsequently reaps every helper and verifies /proc cleanup.
  fs.closeSync(log);
});
