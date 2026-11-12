'use strict';
// Explicit Node capture-harness adapter. Nothing installs this by default.
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const Observer = require('./d3d9-layout-observer');
const Regions = require('../lib/region-map.generated');

function identity({moduleBytes, repository, runId}) {
  if (!(moduleBytes instanceof Uint8Array)) throw new TypeError('exact loaded module bytes required');
  const git = args => execFileSync('git', args, {cwd: repository, encoding:'utf8'}).trim();
  return {moduleSHA256:createHash('sha256').update(moduleBytes).digest('hex'),
    sourceCommit:git(['rev-parse','HEAD']),
    sourceDirty:git(['status','--porcelain','--untracked-files=normal']).length > 0,
    runId:runId ?? null};
}

function create({identity: pinnedIdentity, getMemory, getExports, capacity = 128}) {
  let origin = null;
  const recorders = [], cleanup = [];
  function adapters(exportsFor) {
    // Use the executing module's translator, including its selected sparse mode.
    // No affine fallback: a missing export is an observation error.
    const g2w = address => {
      if (!Number.isInteger(address) || address < 0 || address > 0xfffffffc)
        throw new RangeError('invalid guest word');
      const e = exportsFor(), wa = e.guest_to_wasm(address) >>> 0;
      if (wa < 256 || wa + 4 > getMemory().byteLength ||
          (e.guest_to_wasm(address + 3) >>> 0) !== wa + 3)
        throw new RangeError('unmapped or split guest word');
      return wa;
    };
    const resolveProgram = device => {
      if (!device) return 0;
      const view = new DataView(getMemory());
      const slot = view.getUint32(g2w(device + 4), true);
      if (slot >= Regions.SIZE.DX_OBJECTS / 32) return 0;
      const entry = Regions.BASE.DX_OBJECTS + slot * 32;
      return view.getUint32(entry, true) === 20 ? view.getUint32(entry + 20, true) : 0;
    };
    return {getMemory, g2w, resolveProgram};
  }
  function recorder(placement, exportsFor, getThread) {
    const observer = Observer.create({...adapters(exportsFor), capacity, getThread,
      identity:{moduleSHA256:null, sourceCommit:null, sourceDirty:null, runId:null,
        ...pinnedIdentity, placement}});
    recorders.push(observer);
    return observer;
  }
  const host = recorder('host-consumer', getExports, () => origin);
  return {
    // Install only after the final import overrides, BEFORE instantiation.
    installWorker(imports, apiTable, exportsFor, slot) {
      const worker = recorder('guest-issue', exportsFor, () => ({slot,
        id:exportsFor().get_current_thread_id() >>> 0}));
      worker.installAPI(imports, apiTable, exportsFor);
      worker.installGPU(imports, 'gpu_gl_call', 'draw-issue');
      return worker;
    },
    // Pass slot => capture.brokerTable(tableFor(slot), slot) to createMainBroker.
    // Slot comes from the broker's real request. No request identity exists in
    // its current protocol; do not manufacture one from a local counter.
    brokerTable(table, slot, getThreadId = () => null) {
      const original = table.gpu_gl_call;
      if (typeof original !== 'function') throw new TypeError('missing gpu_gl_call');
      const scoped = Object.create(table);
      scoped.gpu_gl_call = function(...args) {
        const previous = origin;
        // Keep observational context failure from replacing the original call.
        let id = null;
        try { id = getThreadId(); } catch (_) {}
        origin = {slot, id};
        try { return Reflect.apply(original, this, args); }
        finally { origin = previous; }
      };
      return scoped;
    },
    attachHost(bridge) {
      const options = bridge.options;
      const descriptor = Object.getOwnPropertyDescriptor(options, 'onLayoutRead');
      const previous = options.onLayoutRead;
      function onLayoutRead(values) {
        host.hostRead(values); // actual locals supplied by production Bridge.call
        if (typeof previous === 'function') return previous.call(this, values);
      }
      options.onLayoutRead = onLayoutRead;
      const restore = () => {
        if (options.onLayoutRead !== onLayoutRead) return false;
        if (descriptor) Object.defineProperty(options, 'onLayoutRead', descriptor);
        else delete options.onLayoutRead;
        return true;
      };
      try { host.installGPU(bridge, 'call', 'host-entry'); }
      catch (error) { restore(); throw error; }
      cleanup.push(restore);
      return host;
    },
    snapshot() {
      return {schema:1, crossBoundaryPairingQualified:false,
        producerAttributionQualified:false,
        limitation:'Broker protocol has no shared request identity; correlation is null.',
        observers:recorders.map(observer => observer.snapshot())};
    },
    dispose() {
      return [...recorders.flatMap(observer => observer.dispose()),
        ...cleanup.reverse().map(restore => restore())];
    },
  };
}
module.exports = {identity, create};
