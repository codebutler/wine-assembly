#!/usr/bin/env node

'use strict';

// Run the original Homeworld demo installer (HWDemo.exe, a Wise package) inside
// the emulator and export what it installs. The host never opens the Wise
// archive; it only exports the install directory from the VFS after setup.
//
// Route (docs/re-notes/homeworld-demo.md): Welcome, licence, destination
// (C:\Sierra\Homeworld Downloadable), program group, start copying -- Next is
// at (366,382) on every page -- then wait until the payload is in the VFS.
//
//   node tools/install-homeworld-demo.js --installer=HWDemo.exe --output=DIR [--screenshot=PNG]
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
const INSTALLER_SHA1 = '27fd4faf192b06c8520e8b25284711f6a5824e87';
const INSTALL_DIR = 'c:\\sierra\\homeworld downloadable\\';
const PAYLOAD = ['homeworld.exe', 'homeworlddl.big', 'rglsw.dll'];

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
  await stepTotal(session, 5);
  await session.send(`mousedown:${x}:${y}`);
  await stepTotal(session, 5);
  await session.send(`mouseup:${x}:${y}`);
  await stepTotal(session, 300);
}

// The payload is complete when every file is present and the total size has
// stopped growing between two checks (Wise writes the .big archive in pieces).
const payloadBytes = `(() => {
  let total = 0;
  for (const name of ${JSON.stringify(PAYLOAD)}) {
    const entry = ctx.vfs.files.get(${JSON.stringify(INSTALL_DIR)} + name);
    if (!entry || !entry.data) return -1;
    total += entry.data.length;
  }
  return total;
})()`;

async function waitForPayload(session) {
  let last = -1;
  for (let attempt = 0; attempt < 60; attempt++) {
    await stepTotal(session, 500);
    const bytes = await session.send({ action: 'eval', code: payloadBytes });
    if (bytes > 0 && bytes === last) return bytes;
    last = bytes;
  }
  throw new Error(`Homeworld setup did not finish writing its payload\n${session.output().slice(-8000)}`);
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
  ], { cwd: ROOT, idPrefix: 'hwi-' });
  try {
    await stepTotal(session, 2050);
    for (let page = 0; page < 5; page++) await click(session, 366, 382);
    const bytes = await waitForPayload(session);
    console.log(`Homeworld install: payload complete in the VFS (${bytes} bytes)`);
    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await session.send({ action: 'png', path: screenshot });
    }
    const code = await session.quit();
    assert.strictEqual(code, 0, `Homeworld setup exited ${code}\n${session.output().slice(-8000)}`);
    assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(session.output()),
      `Homeworld setup hit a compatibility failure\n${session.output().slice(-8000)}`);
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
    console.error('usage: node tools/install-homeworld-demo.js --installer=HWDemo.exe --output=DIR [--screenshot=PNG]');
    process.exit(2);
  }
  assert(fs.existsSync(installer), `Homeworld installer is missing: ${installer}`);
  assert.strictEqual(sha1(installer), INSTALLER_SHA1, 'HWDemo.exe does not match the pinned demo');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-homeworld-installer-'));
  const installVfs = path.join(temp, 'installed-vfs');
  try {
    console.log('Homeworld install: driving the original Wise setup...');
    await runSetup(installer, installVfs, screenshot);
    const installed = path.join(installVfs, 'sierra', 'homeworld downloadable');
    for (const name of PAYLOAD) {
      assert(fs.existsSync(path.join(installed, name)), `setup did not install ${name}`);
    }
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.cpSync(installed, output, { recursive: true });
    const manifest = spawnSync(process.execPath,
      [path.join(ROOT, 'tools', 'gen-installed-manifest.js'), output, 'homeworld.exe'],
      { cwd: ROOT, stdio: 'inherit' });
    if (manifest.error) throw manifest.error;
    assert.strictEqual(manifest.status, 0, 'gen-installed-manifest failed');
    console.log(`PASS  Homeworld demo installed to ${output}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`FAIL  Homeworld demo installer: ${error.stack || error.message}`);
  process.exit(1);
});
