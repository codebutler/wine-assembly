// Before-load probe for the pinned original executable. Changes only the
// existing diagnostic trace switch; never writes guest bytes or registers.
(function (root) {
  'use strict';
  const state = root.__kkriegerAudio = {armed: false, records: [], errors: [], scope: 'main-thread block-entry snapshots; no gameplay/audio qualification'};
  const points = new Map([[0x80483a, 'DirectSoundCreate return'], [0x804855, 'SetCooperativeLevel return'],
    [0x80488c, 'primary CreateSoundBuffer return'], [0x8048d7, 'primary SetFormat return'],
    [0x80490d, 'secondary CreateSoundBuffer return'], [0x804927, 'Buffer8 QueryInterface return'],
    [0x804932, 'base interface Release return'], [0x8049f8, 'initializer failure exit']]);
  const previous = root.__waProfileEipHit;
  root.__waProfileEipHit = function (eip, tid) {
    if (previous) previous(eip, tid);
    if (tid || !points.has(eip) || state.records.length >= 32) return;
    try {
      const wine = root.wineShell?.currentWine, ex = wine.instance.exports;
      const buffer = wine.memory.buffer;
      const words = (guest, count) => {
        if (!guest) return null;
        return Array.from({length: count}, (_, i) => {
          const at = ex.guest_to_wasm((guest + i * 4) >>> 0) >>> 0;
          if (at === 0xf0 || at + 4 > buffer.byteLength) throw Error('unmapped guest read');
          return new DataView(buffer).getUint32(at, true);
        });
      };
      const regs = Object.fromEntries(['eax','ebx','ecx','edx','esp','ebp','eip'].map(k => [k, ex['get_' + k]() >>> 0]));
      const row = {at: performance.now(), eip, label: points.get(eip), regs, hresult: regs.eax,
        secondaryLocal: words(regs.ebp - 4, 1), globals: words(0x83f890, 2), primary: words(0x83f8c8, 1),
        requestedIID: words(0x81f0dc, 4), descriptor: words(regs.ebp - 0x4c, 9)};
      row.interfaces = [row.secondaryLocal[0], row.globals[0]].map(pointer => {
        try {
          const object = words(pointer, 4);
          return {pointer, object, vtable: object ? words(object[0], pointer === row.globals[0] ? 24 : 21) : null};
        } catch (error) {return {pointer, error: String(error)};}
      });
      state.records.push(row);
      console.log('kkrieger-audio ' + JSON.stringify(row));
    } catch (error) {if (state.errors.length < 16) state.errors.push(String(error));}
  };
  const started = performance.now();
  const timer = setInterval(() => {
    const ex = root.wineShell?.currentWine?.instance?.exports;
    if (ex?.set_trace_eip_range) {
      ex.set_trace_eip_range(1, 0x804800, 0x804a00);
      state.armed = true; state.armedAt = performance.now(); state.armedEip = ex.get_eip() >>> 0;
      clearInterval(timer);
    } else if (performance.now() - started > 600000) clearInterval(timer);
  }, 10);
})(globalThis);
