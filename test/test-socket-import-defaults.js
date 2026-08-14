#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');

async function main() {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer });

  assert.strictEqual(imports.host.sock_socket(2, 1, 6), -1);
  assert.strictEqual(imports.host.sock_last_error(), 10050);

  imports.host.sock_api(3, 12345, 0, 0, 0, 0);
  assert.strictEqual(imports.host.sock_last_error(), 12345);

  const addressPtr = 0x1000;
  Buffer.from('127.0.0.1\0').copy(Buffer.from(memory.buffer), addressPtr);
  assert.strictEqual(imports.host.sock_inet_addr(addressPtr) >>> 0, 0x0100007f);

  const resultPtr = 0x1100;
  assert.strictEqual(imports.host.sock_api(15, 2, 0x1234, resultPtr, 0, 0), 0);
  assert.strictEqual(new DataView(memory.buffer).getUint16(resultPtr, true), 0x3412);

  const wasm = fs.readFileSync(path.join(__dirname, '..', 'build', 'wine-assembly.wasm'));
  const module = await WebAssembly.compile(wasm);
  for (const spec of WebAssembly.Module.imports(module)) {
    if (spec.module === 'host' && spec.kind === 'function' &&
        typeof imports.host[spec.name] !== 'function') {
      imports.host[spec.name] = () => 0;
    }
  }
  imports.host.memory = memory;
  await WebAssembly.instantiate(module, imports);

  console.log('PASS  optional socket defaults instantiate and fail compatibly');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
