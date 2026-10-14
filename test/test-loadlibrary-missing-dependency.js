#!/usr/bin/env node
'use strict';

// LoadLibrary of a DLL whose vendor dependency is not installed must fail, as
// on Windows (ERROR_MOD_NOT_FOUND), instead of binding the missing imports to
// fail-fast stubs. Monster Truck Madness 2 probes Trirend.dll, which imports
// VL_OpenVerite from redline.dll (Rendition's runtime); Windows refuses the
// load and the game drops that renderer. Dependencies the emulator answers
// for (any imported name is a known API) and ordinal-only imports still pass.

const assert = require('assert');
const { importsByDll, isWindowsSystemDll } = require('../lib/dll-loader');
const { loadLibraryDependencies } = require('../lib/process-boot');

// A minimal PE32 image: one section at RVA 0x1000 holding the import table.
function makePe(imports) {
  const sect = [];
  const put32 = (arr, off, v) => { for (let i = 0; i < 4; i++) arr[off + i] = (v >>> (8 * i)) & 0xFF; };
  const descSize = (imports.length + 1) * 20;
  let cursor = descSize;
  const layout = imports.map(imp => {
    const ilt = cursor; cursor += (imp.names.length + (imp.ordinals || 0) + 1) * 4;
    const names = imp.names.map(n => { const at = cursor; cursor += 2 + n.length + 1; return at; });
    const dll = cursor; cursor += imp.dll.length + 1;
    return { ilt, names, dll };
  });
  const data = new Array(cursor).fill(0);
  imports.forEach((imp, i) => {
    const l = layout[i];
    put32(data, i * 20, 0x1000 + l.ilt);         // OriginalFirstThunk
    put32(data, i * 20 + 12, 0x1000 + l.dll);    // Name
    put32(data, i * 20 + 16, 0x1000 + l.ilt);    // FirstThunk
    let t = l.ilt;
    imp.names.forEach((n, k) => {
      put32(data, t, 0x1000 + l.names[k]); t += 4;
      [...n].forEach((c, j) => { data[l.names[k] + 2 + j] = c.charCodeAt(0); });
    });
    for (let k = 0; k < (imp.ordinals || 0); k++) { put32(data, t, 0x80000000 | (k + 1)); t += 4; }
    [...imp.dll].forEach((c, j) => { data[l.dll + j] = c.charCodeAt(0); });
  });
  const raw = 0x200, size = Math.ceil(data.length / 0x200) * 0x200 || 0x200;
  const bytes = new Uint8Array(raw + size);
  const hdr = [];
  put32(hdr, 0, 0);
  bytes[0] = 0x4D; bytes[1] = 0x5A;
  const peOff = 0x40;
  const w32 = (off, v) => { for (let i = 0; i < 4; i++) bytes[off + i] = (v >>> (8 * i)) & 0xFF; };
  const w16 = (off, v) => { bytes[off] = v & 0xFF; bytes[off + 1] = (v >>> 8) & 0xFF; };
  w32(0x3C, peOff);
  w32(peOff, 0x00004550);
  w16(peOff + 4, 0x14C);           // Machine
  w16(peOff + 6, 1);               // NumberOfSections
  w16(peOff + 20, 0xE0);           // SizeOfOptionalHeader
  w16(peOff + 24, 0x10B);          // PE32 magic
  w32(peOff + 128, 0x1000);        // import directory RVA
  w32(peOff + 132, descSize);
  const sec = peOff + 24 + 0xE0;
  w32(sec + 8, data.length);       // VirtualSize
  w32(sec + 12, 0x1000);           // VirtualAddress
  w32(sec + 16, size);             // SizeOfRawData
  w32(sec + 20, raw);              // PointerToRawData
  bytes.set(data, raw);
  return bytes;
}

// Drive the dependency walk the way handleLoadLibraryYield does.
function walk(bytes, apiKnown, files) {
  const it = loadLibraryDependencies(bytes, 'trirend.dll', new Set(), apiKnown);
  const asked = [];
  for (let step = it.next(); ; ) {
    if (step.done) return { deps: step.value, asked };
    asked.push(step.value);
    step = it.next(files[step.value] || null);
  }
}

const known = new Set(['GetTickCount', 'MessageBoxA']);
const apiKnown = name => known.has(name);
const trirend = makePe([
  { dll: 'KERNEL32.dll', names: ['GetTickCount'] },
  { dll: 'redline.dll', names: ['VL_OpenVerite', 'VL_CloseVerite'] },
  { dll: 'sgl.dll', names: [], ordinals: 2 },
]);

assert.deepStrictEqual(importsByDll(trirend), [
  { dll: 'kernel32.dll', names: ['GetTickCount'], ordinals: 0 },
  { dll: 'redline.dll', names: ['VL_OpenVerite', 'VL_CloseVerite'], ordinals: 0 },
  { dll: 'sgl.dll', names: [], ordinals: 2 },
], 'importsByDll reads each DLL with its by-name imports and ordinal count');

let r = walk(trirend, apiKnown, {});
assert.deepStrictEqual(r.asked, ['redline.dll'],
  'an emulated system DLL and an ordinal-only import are not looked up; the vendor DLL is');
assert.deepStrictEqual(r.deps, [{ fileName: 'redline.dll', bytes: null, fatal: true }],
  'a vendor dependency that is not installed fails the load');

const redline = makePe([{ dll: 'KERNEL32.dll', names: ['MessageBoxA'] }]);
r = walk(trirend, apiKnown, { 'redline.dll': redline });
assert.strictEqual(r.deps.length, 1);
assert.strictEqual(r.deps[0].fileName, 'redline.dll');
assert.strictEqual(r.deps[0].fatal, false, 'an installed vendor dependency loads normally');
assert(r.deps[0].bytes instanceof Uint8Array);

// A Windows system DLL is present on every install even when no name imported
// from it is emulated: Daikatana's world.dll imports StackWalk/Sym* from
// imagehlp.dll, and refusing it failed every new game.
const world = makePe([
  { dll: 'KERNEL32.dll', names: ['GetTickCount'] },
  { dll: 'IMAGEHLP.dll', names: ['StackWalk', 'SymInitialize'] },
]);
r = walk(world, apiKnown, {});
assert.deepStrictEqual(r, { deps: [], asked: [] },
  'an unemulated Windows system DLL binds to the stubs instead of failing the load');
assert.strictEqual(isWindowsSystemDll('IMAGEHLP.dll'), true);
assert.strictEqual(isWindowsSystemDll('winspool.drv'), true);
assert.strictEqual(isWindowsSystemDll('redline.dll'), false);

r = walk(trirend, null, {});
assert.deepStrictEqual(r, { deps: [], asked: [] },
  'without the api_name_known export every unregistered dependency stays on the stubs');

// The running EXE counts as loaded. Soldier of Fortune's defsnd.dll imports
// 20 functions from SoF.exe; with only DLL_TABLE in loadedModuleNames() the
// walk mapped a second copy of the EXE as a DLL and ran its entry point as
// DllMain, which crashed the game at boot.
{
  const { loadedModuleNames } = require('../lib/dll-loader');
  const IMAGE_BASE = 0x400000, EXPORT_RVA = 0x2000, NAME_RVA = 0x2100;
  const mem = new ArrayBuffer(0x4000);
  const at = guest => guest - IMAGE_BASE;
  new DataView(mem).setUint32(at(IMAGE_BASE + EXPORT_RVA) + 12, NAME_RVA, true);
  new Uint8Array(mem).set([...'SoF.exe\0'].map(c => c.charCodeAt(0)), at(IMAGE_BASE + NAME_RVA));
  const fakeExports = {
    get_dll_count: () => 0, get_dll_table: () => 0, get_image_base: () => IMAGE_BASE,
    get_exe_export_rva: () => EXPORT_RVA, guest_to_wasm: at,
  };
  const loaded = loadedModuleNames(fakeExports, mem);
  assert(loaded.has('sof.exe'), 'the EXE is named by its export directory');
  const defsnd = makePe([{ dll: 'SoF.exe', names: ['Sys_Error'] }]);
  const steps = loadLibraryDependencies(defsnd, 'defsnd.dll', loaded, () => false);
  const first = steps.next();
  assert.strictEqual(first.done, true, 'nothing is looked up for the EXE');
  assert.deepStrictEqual(first.value, [], 'and no second copy of it is mapped');
}

console.log('PASS LoadLibrary fails on a missing vendor dependency; emulated, ordinal-only and installed dependencies still load; the EXE is never mapped again as a dependency');
