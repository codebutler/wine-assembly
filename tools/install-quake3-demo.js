#!/usr/bin/env node

'use strict';

// Run the original Quake III Arena demo installer (Q3ADemo.exe, an Installer
// VISE package) inside the emulator and export what it installs. The host never
// opens the VISE archive; it only exports c:\Q3Ademo from the VFS after setup.
//
// Route (w4's, docs/re-notes/quake3-demo.md): Next on the welcome page, Yes on
// the licence, Next on the destination (c:\Q3Ademo), Next to copy -- all four
// buttons sit at (452,393) -- then wait until the payload is in the VFS.
//
//   node tools/install-quake3-demo.js --installer=Q3ADemo.exe --output=DIR [--screenshot=PNG]
//
// Writes DIR (the installed tree) and DIR/.wine-assembly-browser.json.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { startControlSession } = require('../test/control-session');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');
// test/candidate-corpus/manifest.json pins the download by SHA-1; this pins
// the same file by content so the tool is safe to run on any path.
const INSTALLER_SHA1 = '95fb0e8f595506dd30b57635db151f2e0762be02';
const PAYLOAD = ['quake3.exe', 'demoq3/pak0.pk3'];

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
  return arg ? path.resolve(arg.slice(prefix.length)) : null;
}

const sha1 = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

async function stepTotal(session, count, chunk = 5000) {
  for (let remaining = count; remaining > 0; remaining -= chunk) {
    const n = Math.min(chunk, remaining);
    const reply = await session.send({ action: 'step', n });
    assert.strictEqual(reply.ran, n,
      `requested ${n} frozen steps, ran ${reply.ran}\n${session.output().slice(-8000)}`);
  }
}

async function click(session, x, y) {
  await session.send(`mousemove:${x}:${y}`);
  await stepTotal(session, 2);
  await session.send(`mousedown:${x}:${y}`);
  await stepTotal(session, 2);
  await session.send(`mouseup:${x}:${y}`);
  await stepTotal(session, 300);
}

// The payload is complete when every file is present and the total size has
// stopped growing between two checks (VISE writes pak0.pk3 in pieces).
const payloadBytes = `(() => {
  let total = 0;
  for (const rel of ${JSON.stringify(PAYLOAD)}) {
    const entry = ctx.vfs.files.get('c:\\\\q3ademo\\\\' + rel.split('/').join('\\\\'));
    if (!entry || !entry.data) return -1;
    total += entry.data.length;
  }
  return total;
})()`;

async function waitForPayload(session) {
  let last = -1;
  for (let attempt = 0; attempt < 60; attempt++) {
    await stepTotal(session, 2500);
    const bytes = await session.send({ action: 'eval', code: payloadBytes });
    if (bytes > 0 && bytes === last) return bytes;
    last = bytes;
  }
  throw new Error(`Quake III setup did not finish writing its payload\n${session.output().slice(-8000)}`);
}

async function runSetup(installer, installVfs, screenshot) {
  const session = startControlSession([RUN,
    `--exe=${installer}`,
    '--vfs-include=**/*',
    '--batch-size=10000',
    '--max-batches=100000000',
    '--max-seconds=1500',
    '--stuck-after=100000000',
    '--quiet-api',
    '--quiet-blocks',
    '--no-build',
    '--no-close',
    '--control-stdin',
    '--frozen',
    `--save-vfs=${installVfs}`,
  ], { cwd: ROOT, idPrefix: 'q3i-' });
  try {
    await stepTotal(session, 1800);
    await click(session, 452, 393);   // welcome: Next
    await click(session, 452, 393);   // licence: Yes
    await click(session, 452, 393);   // destination c:\Q3Ademo: Next
    await click(session, 452, 393);   // ready: Next (copy)
    const bytes = await waitForPayload(session);
    console.log(`Quake III install: payload complete in the VFS (${bytes} bytes)`);
    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await session.send({ action: 'png', path: screenshot });
    }
    const code = await session.quit();
    assert.strictEqual(code, 0, `Quake III setup exited ${code}\n${session.output().slice(-8000)}`);
    assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(session.output()),
      `Quake III setup hit a compatibility failure\n${session.output().slice(-8000)}`);
  } catch (error) {
    const detail = session.output().slice(-12000);
    await session.quit({ ignoreReplyError: true }).catch(() => {});
    throw new Error(`${error.message}\n${detail}`);
  }
}

async function main() {
  const installer = getArg('installer');
  const output = getArg('output');
  const screenshot = getArg('screenshot');
  if (!installer || !output) {
    console.error('usage: node tools/install-quake3-demo.js --installer=Q3ADemo.exe --output=DIR [--screenshot=PNG]');
    process.exit(2);
  }
  assert(fs.existsSync(installer), `Quake III installer is missing: ${installer}`);
  assert.strictEqual(sha1(installer), INSTALLER_SHA1, 'Q3ADemo.exe does not match the pinned 1.11 demo');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-q3-installer-'));
  const installVfs = path.join(temp, 'installed-vfs');
  try {
    console.log('Quake III install: driving the original Installer VISE setup...');
    await runSetup(installer, installVfs, screenshot);
    const installed = path.join(installVfs, 'q3ademo');
    for (const rel of PAYLOAD) {
      assert(fs.existsSync(path.join(installed, ...rel.split('/'))), `setup did not install ${rel}`);
    }
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.cpSync(installed, output, { recursive: true });
    const manifest = spawnSync(process.execPath,
      [path.join(ROOT, 'tools', 'gen-installed-manifest.js'), output, 'quake3.exe'],
      { cwd: ROOT, stdio: 'inherit' });
    if (manifest.error) throw manifest.error;
    assert.strictEqual(manifest.status, 0, 'gen-installed-manifest failed');
    console.log(`PASS  Quake III Arena demo installed to ${output}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`FAIL  Quake III demo installer: ${error.stack || error.message}`);
  process.exit(1);
});
