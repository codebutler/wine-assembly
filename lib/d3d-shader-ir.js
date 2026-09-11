// Read-only JS projection of the WAT-owned shader IR. No guest token parser.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.D3DShaderIR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAGIC = 0x44534952, VERSION = 1, HEADER_BYTES = 32, INSTRUCTION_BYTES = 128;
  function read(memory, address) {
    if (!Number.isInteger(address) || address < 0 || address % 4
        || address + HEADER_BYTES > memory.byteLength) throw new RangeError('shader IR header bounds');
    const view = new DataView(memory), u32 = p => view.getUint32(p, true);
    if (u32(address) !== MAGIC || u32(address + 4) !== VERSION) throw new Error('shader IR ABI mismatch');
    const stage = u32(address + 8), version = u32(address + 12), count = u32(address + 16),
      length = u32(address + 20), bytes = u32(address + 24), flags = u32(address + 28);
    if (stage > 1 || !(stage ? [0xffff0101,0xffff0102,0xffff0103,0xffff0104] : [0xfffe0101]).includes(version)
        || count > 65536 || length < 2 || length > 65536
        || bytes !== HEADER_BYTES + count * INSTRUCTION_BYTES || address + bytes > memory.byteLength)
      throw new RangeError('shader IR layout bounds');
    const instructions = [];
    for (let i = 0; i < count; i++) {
      const p = address + HEADER_BYTES + i * INSTRUCTION_BYTES;
      const opcode = u32(p), offset = u32(p + 4), operands = u32(p + 8), coissue = u32(p + 12);
      if (operands > 5 || offset < 1 || offset >= length || coissue > 1)
        throw new RangeError('shader IR instruction bounds');
      const args = [];
      for (let j = 0; j < operands; j++) {
        const q = p + 16 + j * 16, bank = u32(q), index = u32(q + 4),
          selector = u32(q + 8), modifier = u32(q + 12);
        if (bank === 255) { args.push(index); continue; }
        if (bank === 254) { args.push((0x80000000 | index | selector << 16) >>> 0); continue; }
        if (bank > 31 || index > 2047) throw new RangeError('shader IR register bounds');
        const base = 0x80000000 | (bank & 7) << 28 | (bank & 24) << 8 | index;
        // Retain the existing GLSL lowering's operand encoding internally.
        // These fields came from normalized IR, not unvalidated guest tokens.
        const dest = j === 0 || opcode === 31;
        if (dest) {
          if (selector > 15) throw new RangeError('shader IR write mask');
          args.push((base | selector << 16 | (modifier & 1) << 20 |
            ((modifier >>> 8) & 15) << 24) >>> 0);
        } else {
          if (selector > 255) throw new RangeError('shader IR swizzle');
          args.push((base | selector << 16 | (modifier & 15) << 24 |
            ((modifier >>> 8) & 1) << 13) >>> 0);
        }
      }
      instructions.push(Object.freeze({ opcode, offset, coissue: !!coissue, args: Object.freeze(args) }));
    }
    return Object.freeze({ irVersion: VERSION, stage: stage ? 'pixel' : 'vertex', version,
      length, flags, instructions: Object.freeze(instructions),
      // Executor handoff retains the validated native form, not reconstructed
      // guest bytecode. This copy survives freeing/reusing the WAT IR allocation.
      nativeBytes: new Uint8Array(memory,address,bytes).slice() });
  }
  class Compiler {
    constructor({ getExports, getMemory, maxBytes = 1024 * 1024, maxEntries = 64 }) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1)
        throw new RangeError('shader IR cache budget');
      this.getExports = getExports; this.getMemory = getMemory;
      this.maxBytes = maxBytes; this.maxEntries = maxEntries; this.bytes = 0;
      this.entries = new Map();
    }
    compile(address, wordCount) {
      const memory = this.getMemory(), ex = this.getExports();
      if (!Number.isInteger(address) || address < 0 || address % 4
          || !Number.isInteger(wordCount) || wordCount < 2 || wordCount > 65536
          || address + wordCount * 4 > memory.byteLength) throw new RangeError('shader source bounds');
      const words = new Uint32Array(memory,address,wordCount);
      const previous = this.entries.get(address);
      if (previous && previous.words.length === wordCount && words.every((v,i) => v === previous.words[i])) {
        this.entries.delete(address); this.entries.set(address,previous);
        return previous.ir;
      }
      // Pointer identity is not content identity: released guest allocations can
      // be reused. Compare immutable words before reusing a compiled view.
      if (previous) { this.entries.delete(address); this.bytes -= previous.bytes; }
      const ownedWords = words.slice();
      const pointer = ex.d3d_shader_ir_compile(address,wordCount) >>> 0;
      if (!pointer) throw new Error(`D3D shader IR validation ${ex.d3d_shader_ir_error()} at DWORD ${ex.d3d_shader_ir_error_offset()}`);
      let ir;
      try { ir = read(this.getMemory(),pointer); }
      finally { ex.d3d_shader_ir_free(pointer); }
      // Account for serialized IR and retained source; JS object overhead is
      // additionally bounded by maxEntries and the validated instruction limit.
      const bytes = HEADER_BYTES + ir.instructions.length * INSTRUCTION_BYTES + ownedWords.byteLength;
      if (bytes <= this.maxBytes) {
        while (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries) {
          const key = this.entries.keys().next().value;
          this.bytes -= this.entries.get(key).bytes; this.entries.delete(key);
        }
        this.entries.set(address,{words:ownedWords,ir,bytes}); this.bytes += bytes;
      }
      return ir;
    }
    clear() { this.entries.clear(); this.bytes = 0; }
  }
  return { read, Compiler, MAGIC, VERSION, HEADER_BYTES, INSTRUCTION_BYTES };
});
