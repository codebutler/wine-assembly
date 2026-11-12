#!/usr/bin/env node
'use strict';

// Actual PE GetProcAddress -> QT_Thunk -> NE imported far CALL fail-fast.
// Keep stdin open so the child's own exceptional cleanup must retire it.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { neQtFixture } = require('./helpers/ne-qt-fixture');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

function asyncLoaderFixture() {
  const dll = neQtFixture().pe;
  const raw = rva => rva - 0x1000 + 0x200, optional = 0x80 + 24;
  dll.writeUInt16LE(0x210e, 0x80 + 22);
  // QT fixture instructions contain absolute PE addresses. Give the ordinary
  // loader real HIGHLOW relocations instead of assuming its next DLL base.
  const fixups = [];
  for (let rva = 0x2000; rva < 0x2600 - 3; rva++) {
    const word = dll.readUInt32LE(raw(rva));
    if (word >= 0x400000 && word < 0x403000) {
      fixups.push(0x3000 | (rva & 0xfff)); rva += 3;
    }
  }
  if (fixups.length % 2) fixups.push(0); // ABSOLUTE padding, DWORD block size
  dll.writeUInt32LE(0x2c00, optional + 136);
  dll.writeUInt32LE(8 + fixups.length * 2, optional + 140);
  dll.writeUInt32LE(0x2000, raw(0x2c00));
  dll.writeUInt32LE(8 + fixups.length * 2, raw(0x2c04));
  fixups.forEach((value, i) => dll.writeUInt16LE(value, raw(0x2c08) + i * 2));
  const exe = makeFixture();
  exe.write('CALLER.DLL\0', raw(0x2840));
  const code = Buffer.from([0x68, 0x40, 0x28, 0x40, 0, 0xff, 0x15, 0, 0, 0, 0, 0xc3]);
  code.writeUInt32LE(iat('LoadLibraryA'), 7);
  code.copy(exe, raw(0x2000));
  return { exe, dll };
}

async function main() {
  const wasm = process.env.WA_TEST_WASM;
  assert(wasm && fs.existsSync(wasm), 'WA_TEST_WASM must pin an existing module; no build permitted');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-cli-failure-drain-'));
  let child;
  try {
    const asyncDll = process.argv.includes('--async-dll');
    const normal = process.argv.includes('--normal');
    assert(!(normal && asyncDll), 'normal control uses the direct QT fixture');
    const fixture = asyncDll ? asyncLoaderFixture() : { exe: neQtFixture().pe };
    fs.writeFileSync(path.join(dir, 'caller.exe'), fixture.exe);
    if (fixture.dll) fs.writeFileSync(path.join(dir, 'CALLER.DLL'), fixture.dll);
    fs.writeFileSync(path.join(dir, 'DEMO.DLL'), normal ? neQtFixture().ne : neLifecycleImage({
      importEntry: { module: 'KERNEL', symbol: 65535 }, importInValue: true,
    }));
    child = spawn(process.execPath, [path.join(__dirname, 'run.js'),
      `--exe=${path.join(dir, 'caller.exe')}`, `--wasm=${path.resolve(wasm)}`,
      '--no-build', '--control-stdin', '--quiet-api', '--quiet-blocks',
      '--trace-from=1000', // failure output must survive a closed trace window
      '--max-batches=100', '--batch-size=1000', '--max-seconds=10', '--no-close',
    ], { cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[fixture] child=${child.pid} asyncDll=${asyncDll} normal=${normal}`);
    let stdout = '', stderr = '', timedOut = false, overflow = false;
    const collect = which => data => {
      if (stdout.length + stderr.length + data.length > 1024 * 1024) {
        overflow = true; child.kill('SIGKILL'); return;
      }
      if (which === 'stdout') stdout += data; else stderr += data;
    };
    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 20000);
    let code, signal;
    try {
      [code, signal] = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve([code, signal]));
      });
    } finally { clearTimeout(timer); }
    const output = stdout + stderr;
    console.log(`[fixture] child=${child.pid} code=${code} signal=${signal} timedOut=${timedOut}`);
    assert(!overflow && !timedOut, `CLI failed to retire promptly:\n${output}`);
    assert.strictEqual(signal, null, output);
    assert.strictEqual(code, normal ? 0 : 1, output);
    if (normal) {
      assert(!/RuntimeError|KERNEL\.65535/.test(output), output);
      console.log('PASS normal CLI QT completion exits 0 with stdin open');
      return;
    }
    assert.strictEqual((stdout.match(/\[win16\] KERNEL\.65535 \(no exported name\)  ret=0x[0-9a-f]{8}/g) || []).length,
      1, `missing or duplicate decoded import diagnostic:\n${output}`);
    assert.match(stderr, /RuntimeError: unreachable/, output);
    if (asyncDll) {
      assert.match(stderr, /DLL initializer did not return/, output);
      assert.match(stderr, /fault: RuntimeError: unreachable/, output);
      assert.match(stderr, /handleLoadLibraryYield/, output);
    }
    console.log('PASS CLI QT fail-fast drains decoded import once and exits 1 with stdin open');
  } finally {
    if (child) {
      child.stdin.destroy();
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await new Promise(resolve => child.once('close', resolve));
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
