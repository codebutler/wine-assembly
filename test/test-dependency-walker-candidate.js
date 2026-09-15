#!/usr/bin/env node

'use strict';

// Authentic Dependency Walker 2.2 launch gate. Its MFC frame imports the ANSI
// MDI defaults directly: the old build trapped at DefFrameProcA, and a wrapper
// alone merely moved the crash to CreateWindowExA("mdiclient") trying to run
// the WNDPROC_BUILTIN sentinel as x86 code.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const EXE = path.join(__dirname, 'binaries', 'candidates', 'dependency-walker', 'depends.exe');
const SHA256 = '56e5d9e239424662aa21809f286fac746000b1612318d202aaaa1dcaeb6f3436';

if (!fs.existsSync(EXE)) {
  console.log('SKIP Dependency Walker candidate: depends.exe fixture is absent');
  process.exit(0);
}

const bytes = fs.readFileSync(EXE);
assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), SHA256,
  'Dependency Walker fixture identity changed');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-depends-mdi-'));
const wasmPath = path.join(temp, 'depends-mdi.wasm');
try {
  const wasm = compileSrcWasm();
  fs.writeFileSync(wasmPath, wasm);
  const result = spawnSync(process.execPath, [
    RUN,
    `--exe=${EXE}`,
    `--wasm=${wasmPath}`,
    '--no-build',
    '--no-close',
    '--quiet-api',
    '--quiet-blocks',
    '--trace-api=DefFrameProcA,CreateWindowExA,GetMessageA',
    '--batch-size=25000',
    '--max-batches=40',
    '--max-seconds=20',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.strictEqual(result.status, 0, output.slice(-8000));
  assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError|LinkError/i.test(output),
    `Dependency Walker hit a compatibility failure:\n${output.slice(-8000)}`);
  assert(/DefFrameProcA\(0x00010001, 0x00000000, 0x00000081/.test(output),
    'authentic MFC frame did not enter DefFrameProcA for WM_NCCREATE');
  assert(/class="mdiclient"/.test(output),
    'authentic MFC frame did not create its MDICLIENT window');
  assert(/\[CreateWindow\] hwnd=0x10002/.test(output),
    'MDICLIENT creation did not return a real window handle');
  assert(/GetMessageA\(/.test(output),
    'Dependency Walker did not reach its normal message loop');
  assert(/Stats: 7\d{3} API calls/.test(output),
    'Dependency Walker did not sustain its full startup path');
  console.log('PASS  authentic Dependency Walker clears DefFrameProcA + MDICLIENT and reaches GetMessageA');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
