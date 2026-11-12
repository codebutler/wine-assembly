// Opt-in diagnostic for the pinned original .kkrieger beta. Captures the first
// rejected draw's declaration metadata and original guest table, then rethrows
// the IDENTICAL error. Never translates, repairs, or writes guest data.
(function (root) {
  'use strict';
  function originalDeclarations(root) {
    const wine = root.wineShell?.currentWine;
    const memory = wine?.memory?.buffer, region = root.RegionMap?.REGIONS?.GUEST_BASE;
    if (!memory || !region) throw Error('guest memory/layout unavailable');
    const imageBase = wine.instance.exports.get_image_base() >>> 0;
    const copy = (guest, length) => {
      const at = guest - imageBase + region.base;
      if (!Number.isInteger(guest) || at < region.base || at + length > region.end || at + length > memory.byteLength)
        throw Error('original declaration pointer outside direct image region: ' + guest.toString(16));
      return new Uint8Array(memory, at, length).slice();
    };
    // Original unpacked instruction0x803cef creates declarations from this
    // table, index12..72 in steps12. These are guest VAs, not WASM bases.
    const tableGuest = 0x008210e0, table = copy(tableGuest, 84);
    const view = new DataView(table.buffer), rows = [];
    for (let index = 12; index < 84; index += 12) {
      const pointer = view.getUint32(index + 4, true);
      const row = {index, pointer, handle: view.getUint32(index + 8, true)};
      try {
        const bytes = copy(pointer, 136), values = new DataView(bytes.buffer);
        row.bytes = Array.from(bytes); row.elements = []; row.terminated = false;
        for (let offset = 0; offset < 136; offset += 8) {
          const element = {stream: values.getUint16(offset, true), offset: values.getUint16(offset + 2, true),
            type: values.getUint8(offset + 4), method: values.getUint8(offset + 5),
            usage: values.getUint8(offset + 6), usageIndex: values.getUint8(offset + 7)};
          row.elements.push(element);
          if (element.stream === 255 && element.type === 17) {row.terminated = true; break;}
        }
      } catch (error) {row.error = String(error);}
      rows.push(row);
    }
    return {imageBase, tableGuest, tableBytes: Array.from(table), rows,
      atomicSnapshot: false, scope: 'original direct-image declarations only;136-byte cap per pointer'};
  }
  function install(api, root, publish) {
    const original = api?.Device?.prototype?.draw;
    if (typeof original !== 'function') throw Error('D3D9 draw unavailable');
    let captured = false;
    api.Device.prototype.draw = function (draw) {
      try {return original.apply(this, arguments);} catch (error) {
        if (!captured && String(error?.message).startsWith('D3D9 draw: unsupported vertex declaration element')) {
          captured = true;
          try {
            const packet = {at: new Date().toISOString(), error: String(error.message),
              stride: draw.stride, primitive: draw.primitive, primitiveCount: draw.primitiveCount,
              attributes: (draw.attributes || []).slice(0, 32).map(a => ({...a})),
              attributeCount: draw.attributes?.length, vertexByteLength: draw.vertices?.byteLength,
              vertexPrefix: Array.from(draw.vertices?.subarray(0, 256) || []),
              indexCount: draw.indices?.length, indexPrefix: Array.from(draw.indices?.subarray(0, 32) || []),
              scope: 'first rejected draw metadata plus bounded vertex/index prefixes, not a complete replay'};
            try {packet.original = originalDeclarations(root);} catch (failure) {packet.originalError = String(failure);}
            publish(packet);
          } catch (failure) {
            // Diagnostic failure must never replace or swallow the guest's
            // original rendering error.
            try {publish({error: String(error.message), captureError: String(failure)});} catch (_) {}
          }
        }
        throw error;
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) {module.exports = {install, originalDeclarations}; return;}
  const publish = packet => {
    root.__kkriegerDeclaration = packet;
    console.log('kkrieger-declaration ' + JSON.stringify(packet));
  };
  if (root.D3D9Backend) install(root.D3D9Backend, root, publish);
  else Object.defineProperty(root, 'D3D9Backend', {configurable: true, enumerable: true,
    set(api) {
      Object.defineProperty(root, 'D3D9Backend', {value: api, writable: true, configurable: true, enumerable: true});
      install(api, root, publish);
    }});
})(typeof globalThis !== 'undefined' ? globalThis : this);
