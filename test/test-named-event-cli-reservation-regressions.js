'use strict';
// Replay the historical scheduler fixtures with the new transport ABI and
// reservation expectation. The original diagnostic/evidence stays untouched.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const file = path.join(__dirname, 'test-named-event-finite-single.js');
let text = fs.readFileSync(file, 'utf8');
function replace(old, value) { assert(text.includes(old), old); text = text.replace(old, value); }
replace("cli.indexOf('    wh.wait_single = (handle, timeout) => {')", "cli.indexOf('    wh.wait_single = (handle, timeout, entry) => {')");
replace('broker.serveRpc(m.slot)', 'broker.serveRpc(m.slot,m.waitEntry)');
replace('const h=RPC.createWorkerImports', 'const built=RPC.createWorkerImports');
replace('{slot:0,getSyncMsgDepth:()=>0}).imports.host;', '{slot:0,getSyncMsgDepth:()=>0}); const h=built.imports.host;');
replace('waitHandle:d.handle,waitTimeout:d.timeout,', 'namedWaitSequence:built.getNamedWaitSequence(),waitHandle:d.handle,waitTimeout:d.timeout,');
replace("assert.equal(p.tm.checkMainYield(),true,'Reset before poll cancels manual signal');",
  "assert.equal(p.tm.checkMainYield(),false,'registered reservation survives Reset before poll');");
const replay = new Module(__filename, module);
// Child forks execute this NEW adapter, never change the historical suite.
replay.filename = __filename; replay.paths = Module._nodeModulePaths(__dirname);
replay._compile(text, __filename);
