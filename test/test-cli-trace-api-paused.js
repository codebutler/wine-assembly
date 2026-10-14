#!/usr/bin/env node
'use strict';

// --trace-api-paused keeps the quiet-API fast path until a control command
// switches the trace on. Any --trace-api used to turn every Win32 call into
// three host calls from the first instruction, which slowed Black & White 2
// about 4x and moved its route's timing out from under the inputs; paused, the
// run is full speed up to the moment worth tracing.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { startControlSession } = require('./control-session');

const ROOT = path.join(__dirname, '..');
// SkiFree's timer keeps it calling APIs every frame; an idle GetMessage app
// (winmine) makes no calls at all while it waits, so it proves nothing here.
const EXE = path.join(__dirname, 'binaries', 'entertainment-pack', 'ski32.exe');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  ski32.exe not found at ' + EXE);
  process.exit(0);
}

const session = startControlSession([
  'test/run.js', '--exe=' + EXE, '--control-stdin', '--frozen',
  '--max-seconds=30', '--quiet-api', '--quiet-blocks', '--no-build',
  '--trace-api', '--trace-api-paused',
], { cwd: ROOT, idPrefix: 'tap-' });

const apiLines = text => (text.match(/^\[API #/gm) || []).length;

(async () => {
  try {
    await session.step(30);
    const before = apiLines(session.output());
    assert.strictEqual(before, 0, 'a paused trace logs no API calls');

    const on = await session.send({ action: 'trace-api', on: true });
    assert.strictEqual(on.traceApi, true);
    await session.step(30);
    const during = apiLines(session.output());
    assert.ok(during > 0, 'switching the trace on logs the calls that follow');

    const off = await session.send({ action: 'trace-api', on: false });
    assert.strictEqual(off.traceApi, false);
    await session.step(30);
    const code = await session.quit();
    assert.strictEqual(code, 0, session.output().slice(-3000));
    const out = session.output();
    assert.match(out, /\[trace-api\] on at batch \d+/);
    assert.match(out, /\[trace-api\] paused at batch \d+/);
    const afterPause = out.slice(out.indexOf('[trace-api] paused'));
    assert.strictEqual(apiLines(afterPause), 0, 'pausing again stops the log');
    // The API total stays one count per call across both switches.
    const total = out.match(/Stats: (\d+) API calls/);
    assert.ok(total && Number(total[1]) >= during, 'the API total includes the untraced stretches');
    console.log(`PASS  --trace-api-paused: 0 lines paused, ${during} while on, 0 after pausing; total ${total[1]}`);
  } catch (error) {
    await session.quit({ ignoreReplyError: true });
    throw error;
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
