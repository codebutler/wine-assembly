'use strict';
// Exact production module smoke: no compiler, transforms or test-only exports.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
(async () => {
  const file = option('wasm'), expected = option('sha256');
  assert(file); assert.match(expected || '', /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected);
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  // The file/loader path uses real host implementations. Any unrelated missing
  // dependency must fail loudly if reached, never simulate successful work.
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name]) {
      imports.host[item.name] = () => { throw Error('Unexpected host dependency: ' + item.name); };
    }
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  ctx.exports = e;
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const wa = p => e.guest_to_wasm(p) >>> 0, dv = new DataView(memory.buffer);
  const stack = e.guest_alloc(65536) + 65520;
  const put = text => {
    const p = e.guest_alloc(text.length + 1); assert(p);
    new Uint8Array(memory.buffer).set(Buffer.from(text + '\0'), wa(p)); return p;
  };
  const call = (address, args) => {
    e.set_esp(stack); e.call_func(address, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const before = e.get_esp() >>> 0;
    for (let i = 4; i < args.length; i++) dv.setUint32(wa(before + 4 * (i + 1)), args[i] >>> 0, true);
    for (let n = 0; n < 20000 && e.get_eip(); n++) {
      e.run(100); assert.equal(e.get_yield_reason(), 0, 'nonblocking file API');
    }
    assert.equal(e.get_eip(), 0); assert.equal(e.get_esp() >>> 0, before + 4 * (args.length + 1));
    return e.get_eax() >>> 0;
  };
  const api = (name, args) => call(dv.getUint32(wa(iat(name)), true), args);
  const kernel = api('GetModuleHandleA', [put('kernel32.dll')]); assert(kernel && kernel !== 0x400000);
  const lock = api('GetProcAddress', [kernel, put('LockFile')]);
  const unlock = api('GetProcAddress', [kernel, put('UnlockFile')]); assert(lock && unlock && lock !== unlock);
  assert.equal(api('GetProcAddress', [kernel, 591]), lock);
  assert.equal(api('GetProcAddress', [kernel, 592]), unlock);
  const a = ctx.vfs.createFile('c:\\public-lock.bin', 0xc0000000, 2);
  const b = ctx.vfs.createFile('c:\\public-lock.bin', 0xc0000000, 3);
  assert.equal(call(lock, [a, 3, 0x200000, 4, 1]), 1);
  assert.equal(call(lock, [b, 4, 0x200001, 1, 0]), 0); assert.equal(api('GetLastError', []), 33);
  assert.equal(call(unlock, [b, 3, 0x200000, 4, 1]), 0); assert.equal(api('GetLastError', []), 158);
  assert.equal(call(unlock, [a, 3, 0x200000, 4, 1]), 1);
  assert.equal(call(lock, [b, 4, 0x200001, 1, 0]), 1);
  assert.equal(call(unlock, [b, 4, 0x200001, 1, 0]), 1);
  ctx.vfs.closeAllDiskHandles();
  console.log('LockFile exact production binary public API: PASS ' + expected);
})().catch(error => { console.error(error); process.exitCode = 1; });
