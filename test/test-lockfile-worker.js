'use strict';
// Real OS Workers, compiled production import declarations and production RPC.
// No guest game, transport mocks or replacement file operations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { VirtualFS, createFilesystemImports } = require('../lib/filesystem');
const RPC = require('../lib/guest-rpc');
const { compileClosure } = require('../tools/watx-closure');

(async () => {
  const names = ['fs_lock_file', 'fs_duplicate_handle', 'fs_close_handle'];
  const all = require('../lib/host-import-sigs.generated.json').sigs;
  const sigs = Object.fromEntries(names.map(name => [name, all[name]]));
  assert.equal(sigs.fs_lock_file.params.length, 6);
  assert.equal(sigs.fs_duplicate_handle.params.length, 5);
  const header = fs.readFileSync(path.join(__dirname, '../src/01-header.wat'), 'utf8');
  const declarations = header.split('\n').filter(line => names.some(name =>
    line.includes(`(import "host" "${name}"`))).join('\n');
  const source = `(import "host" "memory" (memory 8192 8192 shared))
    ${declarations}
    (export "lock" (func $host_fs_lock_file))
    (export "duplicate" (func $host_fs_duplicate_handle))
    (export "close" (func $host_fs_close_handle))`;
  const compiled = compileClosure({ source, vfs: new Map() },
    { tailCalls: !process.argv.includes('--compat') });
  assert(compiled.success, compiled.error);
  const module = await WebAssembly.compile(compiled.wasmBinary);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const vfs = new VirtualFS();
  const a = vfs.createFile('c:\\worker-lock.bin', 0xc0000000, 2);
  const b = vfs.createFile('c:\\worker-lock.bin', 0xc0000000, 3);
  const host = createFilesystemImports({ vfs, getMemory: () => memory.buffer });
  const errors = [];
  const broker = RPC.createMainBroker(memory, host, sigs,
    { onError: (name, error) => errors.push([name, String(error)]) });
  const workers = [];
  const pending = new Map();
  let serial = 0;
  try {
    for (const slot of [1, 2]) {
      const worker = new Worker(`
        const { parentPort, workerData: d } = require('node:worker_threads');
        const rpc = require(d.rpc).createWorkerImports(d.memory, d.sigs,
          message => parentPort.postMessage(message), { slot: d.slot });
        const e = new WebAssembly.Instance(d.module, rpc.imports).exports;
        parentPort.on('message', ({ id, method, args }) => {
          try { parentPort.postMessage({ id, result: e[method](...args) }); }
          catch (error) { parentPort.postMessage({ id, error: error.stack }); }
        });
      `, { eval: true, workerData: { module, memory, sigs, slot,
        rpc: require.resolve('../lib/guest-rpc') } });
      workers.push(worker);
      const fail = error => {
        for (const item of pending.values()) if (item.worker === worker) item.finish(error);
      };
      worker.on('error', fail);
      worker.on('exit', code => fail(Error(`Worker exited before reply: ${code}`)));
      worker.on('message', message => {
        if (message.t === 'rpc') broker.serveRpc(message.slot);
        else if (pending.has(message.id)) pending.get(message.id).finish(
          message.error ? Error(message.error) : null, message.result);
      });
    }
    const ask = (worker, method, ...args) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => finish(Error('LockFile Worker reply exceeded 10 seconds')), 10000);
      const finish = (error, result) => {
        clearTimeout(timer); pending.delete(id); error ? reject(error) : resolve(result);
      };
      pending.set(id, { worker, finish }); worker.postMessage({ id, method, args });
    });
    const lock = (worker, h, lo, hi, len, lenHi = 0, unlock = 0) =>
      ask(worker, 'lock', h, lo, hi, len, lenHi, unlock);
    // High words, sixth unlock argument, and return values all cross the RPC.
    assert.equal(await lock(workers[0], a, 3, 0x200000, 4, 1), 0);
    assert.equal(await lock(workers[1], b, 4, 0x200001, 1), 33);
    assert.equal(await lock(workers[1], b, 3, 0x200000, 4, 1, 1), 158);
    const duplicate = await ask(workers[1], 'duplicate', a, 0, 0, 2, 1);
    assert(duplicate > 0);
    assert.equal(await lock(workers[1], duplicate, 3, 0x200000, 4, 1, 1), 0);
    assert.equal(await lock(workers[1], b, 4, 0x200001, 1), 0);
    assert.equal(await lock(workers[1], b, 4, 0x200001, 1, 0, 1), 0);
    assert.equal(await lock(workers[0], a, 0, 0, 8), 0);
    // Fifth sameProcess argument must not be dropped: failed transfer closes
    // source while the surviving duplicate retains ownership.
    assert.equal(await ask(workers[0], 'duplicate', a, 0, 0, 3, 0), -6);
    assert.equal(await lock(workers[0], a, 0, 0, 8), 6);
    assert.equal(await lock(workers[1], b, 0, 0, 8), 33);
    assert.equal(await ask(workers[0], 'close', duplicate), 1);
    assert.equal(await lock(workers[1], b, 0, 0, 8), 0);
    assert.equal(await ask(workers[1], 'duplicate', b, 0, 0, 3, 0), -6);
    const c = vfs.createFile('c:\\worker-lock.bin', 0xc0000000, 3);
    assert.equal(await lock(workers[0], c, 0, 0, 8), 0, 'final close releases owner');
    assert.deepEqual(errors, []);
    console.log('LockFile real Worker RPC: PASS (contention, unlock, duplicate, final close)');
  } finally {
    await Promise.all(workers.map(worker => worker.terminate()));
    vfs.closeAllDiskHandles();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
