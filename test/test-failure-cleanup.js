#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const { withCliFailureCleanup } = require('../lib/cli-failure-cleanup');

async function main() {
  let cleaned = false;
  assert.strictEqual(await withCliFailureCleanup(async onFailure => {
    onFailure(() => { cleaned = true; });
    return 23;
  }), 23);
  assert.strictEqual(cleaned, false, 'normal completion retains normal cleanup ownership');

  const original = new Error('original loader rejection');
  const order = [];
  const oldError = console.error;
  const cleanupErrors = [];
  console.error = (...args) => cleanupErrors.push(args);
  try {
    await assert.rejects(withCliFailureCleanup(async onFailure => {
      onFailure(() => order.push('drain'));
      onFailure(async () => { order.push('summary'); throw new Error('cleanup fault'); });
      onFailure(() => order.push('control'));
      await Promise.resolve();
      throw original;
    }), error => error === original);
  } finally { console.error = oldError; }
  assert.deepStrictEqual(order, ['control', 'summary', 'drain']);
  assert.strictEqual(cleanupErrors.length, 1);
  assert.strictEqual(cleanupErrors[0][1].message, 'cleanup fault');

  // Keep the parent's write end OPEN throughout: EOF must not be what lets
  // this child exit. Exercise real readline/stdin retirement after an async
  // rejection, with buffered diagnostic output and a nonzero exit status.
  const child = spawn(process.execPath, ['-e', `
    const { withCliFailureCleanup } = require(${JSON.stringify(require.resolve('../lib/cli-failure-cleanup'))});
    withCliFailureCleanup(async onFailure => {
      const logs = ['[win16] TEST.7  ret=0x12345678'];
      onFailure(() => { for (const line of logs) console.log(line); logs.length = 0; });
      onFailure(() => logs.push('  (x3)'));
      const rl = require('readline').createInterface({ input: process.stdin, terminal: false });
      onFailure(() => { rl.close(); process.stdin.unref(); });
      await Promise.resolve();
      throw new Error('loader callback failed');
    }).catch(error => { process.exitCode = 1; console.error(error); });
  `], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 5000);
  try {
    const [code, signal] = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve([code, signal]));
    });
    assert.strictEqual(timedOut, false, 'open stdin kept rejected run alive');
    assert.strictEqual(signal, null);
    assert.strictEqual(code, 1, stderr);
    assert.strictEqual(stdout, '[win16] TEST.7  ret=0x12345678\n  (x3)\n');
    assert.match(stderr, /Error: loader callback failed/);
  } finally {
    clearTimeout(timer);
    child.stdin.destroy();
  }
  console.log('PASS failure cleanup preserves rejection, drains diagnostics, and retires open stdin');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
